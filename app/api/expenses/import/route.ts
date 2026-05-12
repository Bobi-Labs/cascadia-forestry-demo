/**
 * POST /api/expenses/import
 *
 * Imports expenses from Jaime's Credit Card Master Sheet via the Drive API.
 *
 * Flow:
 *   1. Create an expense_imports row (status: processing) — audit trail entry
 *   2. Fetch the sheet as CSV via Drive API
 *   3. Parse CSV into ParsedExpense records
 *   4. Resolve cardholder_name → employee_id via cardholder_employee_map
 *   5. Check each row's raw_row_hash against existing expenses (dedup)
 *   6. Insert new rows in a batch
 *   7. Create expense_audit_log entries for each insert
 *   8. Update expense_imports row with final counts (status: completed)
 *   9. Return import summary
 *
 * Idempotent: running the same import twice produces zero new rows because
 * the raw_row_hash UNIQUE constraint + our pre-insert dedup catch duplicates.
 *
 * Body:
 *   { spreadsheetId: string, importedBy?: string }
 *
 * Response:
 *   {
 *     ok: boolean,
 *     batchId: string,
 *     totalRows: number,
 *     imported: number,
 *     skipped: number,
 *     errors: number,
 *     errorDetails: Array<{ rowIndex: number, message: string }>
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchSheetAsXlsx, getSheetMetadata } from "@/lib/google-sheets";
import { parseCreditCardCsv, normalizeCardholder, type ExpenseCategory, type ParsedExpense } from "@/lib/expenses/parser";
import { autoMatchExpenses } from "@/lib/expenses/auto-match";

type CategoryMap = Map<string, ExpenseCategory>;
type CardholderMap = Map<string, string>; // normalized name → employee_id

export async function POST(req: NextRequest) {
  const sb = createAdminClient();

  let spreadsheetId: string;
  let importedBy: string | null = null;

  try {
    const body = await req.json();
    spreadsheetId = body.spreadsheetId;
    importedBy = body.importedBy || null;
    if (!spreadsheetId || typeof spreadsheetId !== "string") {
      return NextResponse.json({ ok: false, error: "spreadsheetId is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  // ──────────────────────────────────────────────────────
  // 1. Create import batch record
  // ──────────────────────────────────────────────────────
  let batchId: string;
  let sheetName: string;
  try {
    const meta = await getSheetMetadata(spreadsheetId);
    sheetName = meta.name;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Could not access sheet: ${msg}` }, { status: 500 });
  }

  const { data: batch, error: batchError } = await sb
    .from("expense_imports")
    .insert({
      spreadsheet_id: spreadsheetId,
      tab_name: sheetName, // using sheet name as tab_name since we export the whole sheet
      imported_by: importedBy,
      status: "processing",
    } as never)
    .select("id")
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ ok: false, error: `Failed to create import batch: ${batchError?.message}` }, { status: 500 });
  }
  batchId = (batch as { id: string }).id;

  try {
    // ──────────────────────────────────────────────────────
    // 2. Load lookup maps (category, cardholder)
    // ──────────────────────────────────────────────────────
    const categoryMap: CategoryMap = new Map();
    const { data: catRows } = await sb.from("sheet_category_map").select("sheet_category, expense_category");
    (catRows || []).forEach((r) => {
      categoryMap.set(
        (r as { sheet_category: string; expense_category: string }).sheet_category,
        (r as { sheet_category: string; expense_category: string }).expense_category as ExpenseCategory,
      );
    });

    const cardholderMap: CardholderMap = new Map();
    const { data: chRows } = await sb.from("cardholder_employee_map").select("cardholder_name, employee_id");
    (chRows || []).forEach((r) => {
      const row = r as { cardholder_name: string; employee_id: string };
      cardholderMap.set(normalizeCardholder(row.cardholder_name), row.employee_id);
    });

    // ──────────────────────────────────────────────────────
    // 3. Fetch + parse sheet (ALL tabs — non-expense tabs auto-skipped)
    // ──────────────────────────────────────────────────────
    const xlsxBuffer = await fetchSheetAsXlsx(spreadsheetId);
    const parseResult = parseCreditCardCsv(xlsxBuffer, categoryMap);

    // Log which tabs were processed vs skipped for debugging
    console.log(
      `[expenses/import] Tabs processed: [${parseResult.tabsProcessed.join(", ")}] | Skipped: [${parseResult.tabsSkipped.join(", ")}]`,
    );

    // ──────────────────────────────────────────────────────
    // 4. Resolve employee_ids for each row
    // ──────────────────────────────────────────────────────
    for (const row of parseResult.parsed) {
      const normalized = normalizeCardholder(row.cardholder_name || undefined);
      if (normalized && cardholderMap.has(normalized)) {
        row.employee_id = cardholderMap.get(normalized)!;
      }
    }

    // ──────────────────────────────────────────────────────
    // 4b. Resolve contract_number → contract_id (sheet Project column)
    // ──────────────────────────────────────────────────────
    // Jaime's Project column uses a mix of:
    //   - Contract numbers ("2026A", "93-106253", "ST0626")
    //   - Shorthand names ("Vanessa", "Kirk", "Banzer")
    //   - Full names ("Rabinskey Ranch LLC", "Don Demers")
    //   - Overhead labels ("Overhead Office", "H2b Overhead") — not projects
    //   - Vehicle names ("Chevy express 2013") — not projects
    //
    // Matching strategy (in priority order):
    //   1. Exact match on contract name
    //   2. Exact match on contract_number
    //   3. Keyword match — if the sheet value contains a word that uniquely
    //      identifies one contract (e.g., "Vanessa" only appears in
    //      "Weyerhaeuser Vanessa Planting")
    //   4. No match → goes to pending queue for manual assignment
    const hasProjectValues = parseResult.parsed.some(
      (r) => r.contract_number && !r.contract_id,
    );
    if (hasProjectValues) {
      // Include closed contracts too — Jaime assigns expenses to completed
      // projects (Banzer, Drecksel, etc.). Only exclude archived.
      const { data: contractRows } = await sb
        .from("contracts")
        .select("id, name, contract_number")
        .neq("status", "archived");

      if (contractRows) {
        // Build lookup maps
        const byName = new Map<string, string>(); // lowercase name → id
        const byNumber = new Map<string, string>(); // lowercase contract_number → id
        const allContracts: Array<{ id: string; name: string; keywords: string[] }> = [];

        for (const c of contractRows) {
          const contract = c as { id: string; name: string; contract_number: string | null };
          byName.set(contract.name.toLowerCase().trim(), contract.id);
          if (contract.contract_number) {
            byNumber.set(contract.contract_number.toLowerCase().trim(), contract.id);
          }
          // Extract significant keywords (3+ chars) from contract name for fuzzy matching
          const keywords = contract.name
            .split(/[\s\-_\/]+/)
            .map((w) => w.toLowerCase().trim())
            .filter((w) => w.length >= 3);
          allContracts.push({ id: contract.id, name: contract.name, keywords });
        }

        // Skip patterns — these are overhead, vehicle, or driving entries
        // that should NOT be matched to any contract. They go to the pending
        // queue for manual review or categorization.
        const skipPatterns = [
          /^overhead/i,
          /overhead$/i,
          /^h2b\b/i,
          /\bh2b\b/i,
          /^driving\b/i,
          /^(chevy|ford|gmc|ram|tundra|toyota|dodge)\b/i,
          /\b(express|sierra|e-?\d{3}|f-?\d{3})\b/i,
          /^\d{4}\s+(ram|ford|chevy)/i, // "2016 Ram 5500"
          /\bsilicone\b/i,
          /\b(van|truck|bus|pickup)\b/i,
        ];

        for (const row of parseResult.parsed) {
          if (!row.contract_number || row.contract_id) continue;
          const raw = row.contract_number.trim();
          const lookup = raw.toLowerCase();

          // Skip overhead, vehicle, and driving entries
          if (skipPatterns.some((p) => p.test(raw))) continue;

          // 1. Exact match on contract name
          let matchId = byName.get(lookup);

          // 2. Exact match on contract_number
          if (!matchId) {
            matchId = byNumber.get(lookup);
          }

          // 3. Keyword match — check if sheet value contains a word that
          //    uniquely identifies one contract. "CASCADWTHI202 - Vanessa"
          //    contains "vanessa" which only matches "Weyerhaeuser Vanessa Planting".
          if (!matchId) {
            const lookupWords = lookup
              .split(/[\s\-_\/,]+/)
              .map((w) => w.trim())
              .filter((w) => w.length >= 3);

            const candidates = new Map<string, string>(); // id → name
            for (const word of lookupWords) {
              for (const contract of allContracts) {
                if (contract.keywords.includes(word)) {
                  candidates.set(contract.id, contract.name);
                }
              }
            }
            // Only match if exactly ONE contract matched — ambiguous = skip
            if (candidates.size === 1) {
              matchId = [...candidates.keys()][0];
            }
          }

          if (matchId) {
            row.contract_id = matchId;
          }
        }
      }
    }

    // ──────────────────────────────────────────────────────
    // 5. Dedup against existing expenses by raw_row_hash
    // ──────────────────────────────────────────────────────
    // NOTE: PostgREST encodes .in() values into the URL querystring, which
    // has a practical ~8KB limit. Each SHA-256 hash is 64 chars, so keep
    // chunks small enough that `raw_row_hash=in.(h1,h2,...)` stays well
    // under that. 100 hashes ≈ 6.5KB URL — safe headroom.
    const allHashes = parseResult.parsed.map((r) => r.raw_row_hash);
    const existing = new Set<string>();
    const dedupChunkSize = 100;
    for (let i = 0; i < allHashes.length; i += dedupChunkSize) {
      const chunk = allHashes.slice(i, i + dedupChunkSize);
      const { data: existingRows, error: dedupErr } = await sb
        .from("expenses")
        .select("raw_row_hash")
        .in("raw_row_hash", chunk);
      if (dedupErr) {
        // Fail loudly — a silent dedup failure would cause UNIQUE constraint
        // violations on insert and leave half-imported batches behind.
        throw new Error(`Dedup query failed at chunk ${i}: ${dedupErr.message}`);
      }
      (existingRows || []).forEach((r) => {
        const hash = (r as { raw_row_hash: string }).raw_row_hash;
        if (hash) existing.add(hash);
      });
    }

    const toInsert = parseResult.parsed.filter((r) => !existing.has(r.raw_row_hash));

    // Also dedup within the batch itself (the sheet has 8 internal duplicates)
    const seenInBatch = new Set<string>();
    const uniqueToInsert: ParsedExpense[] = [];
    for (const row of toInsert) {
      if (!seenInBatch.has(row.raw_row_hash)) {
        seenInBatch.add(row.raw_row_hash);
        uniqueToInsert.push(row);
      }
    }

    const skipped = parseResult.parsed.length - uniqueToInsert.length;

    // ──────────────────────────────────────────────────────
    // 6. Generate display_ids (EXP-0001 format) for new rows
    // ──────────────────────────────────────────────────────
    // Use the max existing numeric ID + 1 as the starting point.
    // This avoids the sequence/RPC complexity and is safe because
    // imports don't run concurrently (single Import button, one at a time).
    let nextDisplayId = 1;
    if (uniqueToInsert.length > 0) {
      const { data: maxRows } = await sb
        .from("expenses")
        .select("display_id")
        .not("display_id", "is", null)
        .order("display_id", { ascending: false })
        .limit(1);
      if (maxRows && maxRows.length > 0) {
        const maxStr = (maxRows[0] as { display_id: string }).display_id;
        const maxNum = parseInt(maxStr.replace("EXP-", ""), 10);
        nextDisplayId = (isNaN(maxNum) ? 0 : maxNum) + 1;
      }
    }

    // ──────────────────────────────────────────────────────
    // 7. Transform ParsedExpense → DB insert payload
    // ──────────────────────────────────────────────────────
    const dbRows = uniqueToInsert.map((r, idx) => ({
      // Human-friendly ID for cross-referencing
      display_id: `EXP-${String(nextDisplayId + idx).padStart(4, "0")}`,
      // Core
      amount: r.amount,
      date: r.date,
      vendor: r.vendor,
      description: r.description,
      category: r.category,
      source: r.source,

      // Company + employee
      company_id: r.company_id,
      employee_id: r.employee_id,

      // Raw sheet data
      cardholder_name: r.cardholder_name,
      crew_member: r.crew_member,
      card_company: r.card_company,
      card_last4: r.card_last4,
      payment_method: r.payment_method,

      // Dates
      post_date: r.post_date,
      work_date: r.work_date,
      import_timestamp: r.import_timestamp,

      // Contract — may already be set from sheet's Project column (step 4b).
      // If still null, auto-match (step 9) tries timesheet cross-reference.
      contract_id: r.contract_id,
      contract_number: r.contract_number,
      // If contract was resolved from sheet, record the match method
      match_method: r.contract_id ? "sheet_project" : null,
      match_confidence: r.contract_id ? 1.0 : null,
      assigned_by: r.contract_id ? (importedBy || "sheet_project") : null,
      assigned_at: r.contract_id ? new Date().toISOString() : null,

      // Location
      location_city: r.location_city,
      location_state: r.location_state,
      statement_description: r.statement_description,

      // Categorization
      subcategory: r.subcategory,
      amex_category_raw: r.amex_category_raw,

      // Vehicle / odometer
      odometer_start: r.odometer_start,
      odometer_end: r.odometer_end,

      // Misc
      notes: r.notes,
      source_file: r.source_file,

      // Transaction type — distinguishes real expenses from credit card payments
      transaction_type: r.transaction_type,

      // Quality tracking
      quality_flags: r.quality_flags.length > 0 ? r.quality_flags : [],

      // Audit / dedup
      raw_row_hash: r.raw_row_hash,
      import_batch_id: batchId,
    }));

    // ──────────────────────────────────────────────────────
    // 7. Insert in chunks (avoid massive single INSERT)
    // ──────────────────────────────────────────────────────
    let insertedCount = 0;
    const insertChunkSize = 200;
    const insertedIds: string[] = [];
    const insertErrors: Array<{ message: string }> = [];
    for (let i = 0; i < dbRows.length; i += insertChunkSize) {
      const chunk = dbRows.slice(i, i + insertChunkSize);
      const { data: inserted, error: insertErr } = await sb
        .from("expenses")
        .insert(chunk as never)
        .select("id");
      if (insertErr) {
        insertErrors.push({ message: insertErr.message });
        // Don't abort — try the remaining chunks
      } else if (inserted) {
        insertedCount += inserted.length;
        inserted.forEach((row) => insertedIds.push((row as { id: string }).id));
      }
    }

    // ──────────────────────────────────────────────────────
    // 8. Audit log entries (one per inserted expense)
    // ──────────────────────────────────────────────────────
    if (insertedIds.length > 0) {
      const auditRows = insertedIds.map((expenseId) => ({
        expense_id: expenseId,
        user_id: importedBy,
        action: "created" as const,
        field_changed: null,
        old_value: null,
        new_value: null,
      }));
      // Chunk audit log inserts too
      for (let i = 0; i < auditRows.length; i += insertChunkSize) {
        const chunk = auditRows.slice(i, i + insertChunkSize);
        await sb.from("expense_audit_log").insert(chunk as never);
      }
    }

    // ──────────────────────────────────────────────────────
    // 9. Run auto-match against newly inserted rows
    // ──────────────────────────────────────────────────────
    // Scope to THIS batch only so we don't re-scan all historical expenses
    // every time. If auto-match fails, don't fail the whole import — the
    // rows are still in the DB and can be matched manually or on a later
    // run.
    let autoMatched = 0;
    let autoMatchErrors: Array<{ expenseId: string; message: string }> = [];
    if (insertedCount > 0) {
      try {
        const matchSummary = await autoMatchExpenses(sb, {
          batchId,
          userId: importedBy,
        });
        autoMatched = matchSummary.applied;
        autoMatchErrors = matchSummary.errors;
      } catch (matchErr) {
        const mMsg = matchErr instanceof Error ? matchErr.message : String(matchErr);
        autoMatchErrors = [{ expenseId: "", message: `Auto-match failed: ${mMsg}` }];
      }
    }

    // ──────────────────────────────────────────────────────
    // 10. Update import batch with final status
    // ──────────────────────────────────────────────────────
    const errorCount = parseResult.errors.length + insertErrors.length + autoMatchErrors.length;
    const warningCount = parseResult.warnings.length;
    // Only mark as "failed" when there WERE rows to insert but they ALL
    // failed. A pure dedup run (0 imported, 0 to insert) with parse errors
    // is still "completed" — the parse errors are reported, nothing broke.
    const hadInsertFailures = insertErrors.length > 0 && insertedCount === 0 && uniqueToInsert.length > 0;
    const status = hadInsertFailures ? "failed" : "completed";

    // Store tab info in tab_name so the dashboard can show which tabs
    // were scanned. Format: "TabA, TabB | skipped: UnitTracking"
    const tabSummary = [
      parseResult.tabsProcessed.join(", "),
      parseResult.tabsSkipped.length > 0
        ? `skipped: ${parseResult.tabsSkipped.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    await sb
      .from("expense_imports")
      .update({
        tab_name: tabSummary,
        row_count: parseResult.totalRows,
        imported_count: insertedCount,
        skipped_count: skipped,
        error_count: errorCount,
        status,
        error_log: JSON.stringify({
          errors: [
            ...parseResult.errors.map((e) => ({ rowIndex: e.rowIndex, message: e.message })),
            ...insertErrors.map((e) => ({ rowIndex: null, message: e.message })),
            ...autoMatchErrors.map((e) => ({
              rowIndex: null,
              message: `auto-match: ${e.message}`,
            })),
          ],
          warnings: parseResult.warnings.slice(0, 50),
          tabs: {
            processed: parseResult.tabsProcessed,
            skipped: parseResult.tabsSkipped,
          },
        }),
      } as never)
      .eq("id", batchId);

    return NextResponse.json({
      ok: true,
      batchId,
      totalRows: parseResult.totalRows,
      imported: insertedCount,
      skipped,
      autoMatched,
      errors: errorCount,
      warnings: warningCount,
      errorDetails: parseResult.errors.slice(0, 20),
      warningDetails: parseResult.warnings.slice(0, 20),
      tabsProcessed: parseResult.tabsProcessed,
      tabsSkipped: parseResult.tabsSkipped,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[expenses/import] Fatal:", msg);

    // Mark batch as failed
    await sb
      .from("expense_imports")
      .update({
        status: "failed",
        error_log: JSON.stringify([{ rowIndex: null, message: msg }]),
      } as never)
      .eq("id", batchId);

    return NextResponse.json({ ok: false, error: msg, batchId }, { status: 500 });
  }
}
