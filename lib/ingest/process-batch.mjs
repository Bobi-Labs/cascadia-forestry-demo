/**
 * Pending-batch orchestrator — bridge between watcher (Stage 2) and
 * parsers (Stage 3+). Consumes pending unit_ingest_batches rows, runs
 * the right parser on the downloaded file, and writes results either
 * directly into `units` or into the `unit_pending_review` queue for
 * office triage.
 *
 * Conflict policy (per Item 7 / April 26 deep-dive):
 *   - Unit data is ADDITIVE — we never auto-overwrite existing units.
 *   - Match key is (contract_id, name) case-insensitive.
 *   - New unit + clean parse  → insert into `units`
 *   - Existing unit (same key) → queue in `unit_pending_review`
 *     with reason='unit_changed' for office to reconcile.
 *   - Parser warnings on a row → queue in `unit_pending_review`
 *     with reason='unmapped_columns'.
 *   - Excluded landowner/contract/unit (per `unit_ingest_excludes`)
 *     → skip; record audit row with action='excluded'.
 *
 * The orchestrator is idempotent at the batch level — a batch in
 * status='pending' or 'failed' can be re-run; rows already inserted
 * are detected via the (contract_id, name) match and queued for
 * review on the second pass instead of double-creating.
 *
 * Usage: scripts/ingest/process-batches.mjs (CLI runner) or the cron
 * route once Stage 8 ships.
 */

import { parseManulifeAwardedUnits } from "./parsers/manulife-awarded-units.mjs";
import { parseManulifeDataSheetPdf } from "./parsers/manulife-data-sheet-pdf.mjs";
import { parseManulifeExhibitCPlanting } from "./parsers/manulife-exhibit-c-planting.mjs";
import { parseManulifePaymentSummary } from "./parsers/manulife-payment-summary.mjs";
import {
  parseWeyerhaeuserPlantationExam,
  parseWeyerhaeuserPlantationExamPhoto,
} from "./parsers/weyerhaeuser-plantation-exam.mjs";
import { parseDnrReforContract } from "./parsers/dnr-refor-contract.mjs";
import { parseUsaceTaskOrder } from "./parsers/usace-task-order.mjs";
import { parseHoodRiverVegetationControl } from "./parsers/hood-river-vegetation-control.mjs";
import { diffUnits } from "./canonicalize.mjs";

/**
 * Format-tag → parser function. Each parser takes (buffer, context)
 * and returns a parse result. `context` carries the filename + parent
 * folder name for parsers that need them (e.g. WY PlantationExam,
 * which extracts the unit ID from the filename).
 *
 * Add new entries as parsers ship.
 * @type {Record<string, (buffer: Buffer, context: object) => any>}
 */
const PARSER_REGISTRY = {
  "manulife-awarded-units-xlsx":   (buf) => parseManulifeAwardedUnits(buf),
  "manulife-data-sheet-pdf":       (buf) => parseManulifeDataSheetPdf(buf),
  "manulife-exhibit-c-planting":   (buf) => parseManulifeExhibitCPlanting(buf),
  "manulife-payment-summary":      (buf) => parseManulifePaymentSummary(buf),
  "wy-plantation-exam-unit":     (buf, ctx) => parseWeyerhaeuserPlantationExam(buf, ctx),
  "wy-plantation-exam-photo":    (buf, ctx) => parseWeyerhaeuserPlantationExamPhoto(buf, ctx),
  "dnr-refor-contract":          (buf) => parseDnrReforContract(buf),
  "usace-task-order":            (buf) => parseUsaceTaskOrder(buf),
  "hr-vegetation-control-bid":   (buf) => parseHoodRiverVegetationControl(buf),
};

/**
 * @typedef {object} ProcessOptions
 * @property {import("googleapis").drive_v3.Drive} drive
 * @property {import("@supabase/supabase-js").SupabaseClient} sb
 * @property {boolean} [commit]  Default false (dry-run). When false, no DB writes.
 * @property {string} [batchId]  Process a specific batch instead of all pending.
 * @property {number} [maxBatches]  Safety bound. Default 25.
 * @property {(msg: string) => void} [log]
 */

/**
 * @param {ProcessOptions} opts
 */
export async function processPendingBatches(opts) {
  const { drive, sb, commit = false, batchId, maxBatches = 25 } = opts;
  const log = opts.log ?? ((m) => console.log(m));

  const summary = {
    batchesProcessed: 0,
    rowsInserted: 0,
    rowsQueuedForReview: 0,
    rowsSkippedExcluded: 0,
    rowsSkippedUnknownFormat: 0,
    batchSuccesses: 0,
    batchFailures: 0,
    errors: /** @type {Array<{batchId?:string,message:string}>} */ ([]),
  };

  // Pull pending batches
  let q = sb
    .from("unit_ingest_batches")
    .select("id, contract_id, drive_file_id, drive_file_name, landowner, format_tag, parser_mode, status")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(maxBatches);
  if (batchId) {
    q = sb
      .from("unit_ingest_batches")
      .select("id, contract_id, drive_file_id, drive_file_name, landowner, format_tag, parser_mode, status")
      .eq("id", batchId);
  }
  const { data: batches, error: batchErr } = await q;
  if (batchErr) {
    summary.errors.push({ message: `batches query failed: ${batchErr.message}` });
    return summary;
  }
  if (!batches || batches.length === 0) {
    log("No pending batches.");
    return summary;
  }

  // Pre-load excludes once — small table, easier than per-batch lookup
  const { data: excludes } = await sb
    .from("unit_ingest_excludes")
    .select("scope_type, scope_id");
  const excluded = {
    landowner: new Set((excludes ?? []).filter((e) => e.scope_type === "landowner").map((e) => e.scope_id)),
    contract:  new Set((excludes ?? []).filter((e) => e.scope_type === "contract").map((e) => e.scope_id)),
    unit:      new Set((excludes ?? []).filter((e) => e.scope_type === "unit").map((e) => e.scope_id)),
  };

  for (const batch of batches) {
    summary.batchesProcessed += 1;
    log(`\n▶ batch ${batch.id.slice(0, 8)} :: ${batch.format_tag} :: ${batch.drive_file_name}`);

    // Skip if landowner is excluded
    if (batch.landowner && excluded.landowner.has(batch.landowner)) {
      log(`  excluded landowner=${batch.landowner}; skipping batch`);
      if (commit) {
        await sb.from("unit_ingest_batches").update({
          status: "success",
          rows_skipped: 1,
          finished_at: new Date().toISOString(),
        }).eq("id", batch.id);
        await sb.from("unit_ingest_audit").insert({
          batch_id: batch.id,
          action: "excluded",
          source_file: batch.drive_file_name,
        });
      }
      continue;
    }

    // Skip if contract is excluded
    if (batch.contract_id && excluded.contract.has(batch.contract_id)) {
      log(`  excluded contract=${batch.contract_id}; skipping batch`);
      if (commit) {
        await sb.from("unit_ingest_batches").update({
          status: "success",
          rows_skipped: 1,
          finished_at: new Date().toISOString(),
        }).eq("id", batch.id);
      }
      continue;
    }

    // Resolve parser
    const parser = PARSER_REGISTRY[batch.format_tag ?? ""];
    if (!parser) {
      log(`  no parser for format_tag=${batch.format_tag}; marking failed`);
      summary.rowsSkippedUnknownFormat += 1;
      summary.batchFailures += 1;
      if (commit) {
        await sb.from("unit_ingest_batches").update({
          status: "failed",
          error_log: { reason: "no_parser", format_tag: batch.format_tag },
          finished_at: new Date().toISOString(),
        }).eq("id", batch.id);
      }
      continue;
    }

    // Mark batch as processing + clear any stale pending_review rows
    // that landed on prior runs of this same batch. Without this step,
    // when a batch gets reset (e.g. parser was upgraded and we re-run
    // to pick up better field extraction), the old pending_review rows
    // remain in the queue alongside the freshly-inserted units row —
    // confusing the office triage view with stale entries. Caught
    // 2026-05-14 after the WY OCR end-to-end test landed a clean unit
    // but the May-10 pre-OCR pending row was still queued.
    if (commit) {
      await sb.from("unit_pending_review")
        .delete()
        .eq("batch_id", batch.id)
        .eq("status", "pending");
      await sb.from("unit_ingest_batches").update({
        status: "processing",
        started_at: new Date().toISOString(),
      }).eq("id", batch.id);
    }

    // Download the file from Drive
    let fileBuffer;
    try {
      const res = await drive.files.get(
        { fileId: batch.drive_file_id, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" },
      );
      fileBuffer = Buffer.from(res.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log(`  download failed: ${message}`);
      summary.errors.push({ batchId: batch.id, message: `download: ${message}` });
      summary.batchFailures += 1;
      if (commit) {
        await sb.from("unit_ingest_batches").update({
          status: "failed",
          error_log: { reason: "download_failed", message },
          finished_at: new Date().toISOString(),
        }).eq("id", batch.id);
      }
      continue;
    }

    // Run the parser. Some parsers (WY PlantationExam) need filename
    // context to extract the unit ID; pass it along uniformly.
    let parseResult;
    try {
      const ctx = { filename: batch.drive_file_name ?? "" };
      parseResult = await parser(fileBuffer, ctx);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log(`  parse failed: ${message}`);
      summary.errors.push({ batchId: batch.id, message: `parse: ${message}` });
      summary.batchFailures += 1;
      if (commit) {
        await sb.from("unit_ingest_batches").update({
          status: "failed",
          error_log: { reason: "parse_failed", message },
          finished_at: new Date().toISOString(),
        }).eq("id", batch.id);
      }
      continue;
    }

    log(`  parsed ${parseResult.rowCount} row(s); ${parseResult.parsed.length} retained after filter`);

    // Pre-load existing units for this contract to detect conflicts
    /** @type {Map<string, string>} normalized name → unit id */
    const existingUnitsByName = new Map();
    // Pull the comparable fields too — diffUnits needs them to decide
    // whether a name match is actually a change. Without this we'd
    // queue every re-import of an unchanged unit as 'unit_changed'.
    if (batch.contract_id) {
      const { data: contractUnits } = await sb
        .from("units")
        .select("id, name, state, county, work_type, amount, amount_type, notes")
        .eq("contract_id", batch.contract_id);
      for (const u of contractUnits ?? []) {
        existingUnitsByName.set(normalizeName(u.name), u);
      }
    }

    // Process each parsed row
    let rowsCreated = 0;
    let rowsQueuedReview = 0;
    let rowsSkipped = 0;
    let rowsFlagged = 0;

    for (const p of parseResult.parsed) {
      const canonical = p.canonicalRow;
      const unitName = String(canonical.name ?? "").trim();
      if (!unitName) {
        rowsSkipped += 1;
        continue;
      }
      const normalized = normalizeName(unitName);

      const existing = existingUnitsByName.get(normalized);

      // Existing unit (matched by name)? Run diffUnits — only queue
      // when at least one comparable field actually differs. A name
      // match alone isn't a change. This is what kills the "23 false
      // unit_changed flags" problem when Manulife re-publishes the
      // same data sheet (state/work_type format normalize equal so the
      // proposed and existing are byte-equivalent post-canonicalize).
      if (existing) {
        if (commit && excluded.unit.has(existing.id)) {
          rowsSkipped += 1;
          continue;
        }
        const proposedFull = { ...canonical, contract_id: batch.contract_id };
        const changes = diffUnits(existing, proposedFull);
        if (changes.length === 0) {
          // Existing row is byte-equivalent to the parsed row. Office
          // doesn't need to see this — it's the no-op case for any
          // re-import that didn't bring new info.
          rowsSkipped += 1;
          continue;
        }
        rowsQueuedReview += 1;
        if (commit) {
          await sb.from("unit_pending_review").insert({
            batch_id: batch.id,
            reason: "unit_changed",
            source_row: p.sourceRow,
            // proposed_unit gets the per-field diff stashed under
            // _changes so the Pending Units UI can render which fields
            // actually changed without re-running the comparison.
            proposed_unit: { ...proposedFull, _changes: changes },
            existing_unit_id: existing.id,
            status: "pending",
          });
        }
        continue;
      }

      // New unit — flag if parser had warnings or unmapped fields, else
      // auto-insert. Conservative: any warning queues it for review.
      const hasWarnings = (p.warnings ?? []).length > 0;
      const hasUnmapped = Object.keys(p.unmappedFields ?? {}).length > 0;
      const requiresReview = hasWarnings || hasUnmapped || !batch.contract_id;

      // Smart-skip: master-agreement placeholders (Hood River, future
      // similar formats) emit a single "needs_sow_attachment" row that
      // tells the office "expect a Statement of Work soon." When the
      // contract already has units (whether from a prior SoW upload or
      // manual entry), that reminder is redundant noise. Log to audit
      // only, don't clutter the Pending Units queue.
      //
      // Future state: once OCR + AI parsing can read the prose body of a
      // master agreement and extract referenced unit names, we can take
      // this further — cross-check the master's unit list against
      // existing units and only flag if there's a mismatch (master
      // mentions Unit X but contract doesn't have it). That's the
      // generalized "placeholder detection" version. For now: 1 known
      // pattern, 1 simple skip.
      const isPlaceholderOnly =
        hasWarnings &&
        (p.warnings ?? []).every((w) => /^needs_sow_attachment/.test(w));
      const contractAlreadyHasUnits = existingUnitsByName.size > 0;
      if (isPlaceholderOnly && contractAlreadyHasUnits) {
        rowsSkipped += 1;
        if (commit) {
          await sb.from("unit_ingest_audit").insert({
            batch_id: batch.id,
            action: "skipped",
            source_file: batch.drive_file_name,
            field_changes: {
              reason: "master_agreement_placeholder_skipped",
              note: "Master agreement detected; contract already has units, no SoW reminder needed",
            },
          });
        }
        continue;
      }

      if (requiresReview) {
        rowsQueuedReview += 1;
        if (commit) {
          const reason = !batch.contract_id
            ? "no_contract_attached"
            : hasWarnings
              ? "parse_warnings"
              : "unmapped_columns";
          // Stash _warnings + _unmapped on proposed_unit so the
          // Pending Units UI can show the office WHY a row is queued
          // without forcing them to dig into the source_row JSON
          // collapsible. Underscore-prefixed so they don't clash with
          // real column names.
          const proposed = {
            ...canonical,
            contract_id: batch.contract_id ?? null,
          };
          if (hasWarnings) proposed._warnings = p.warnings;
          if (hasUnmapped) proposed._unmapped = p.unmappedFields;
          await sb.from("unit_pending_review").insert({
            batch_id: batch.id,
            reason,
            source_row: p.sourceRow,
            proposed_unit: proposed,
            existing_unit_id: null,
            status: "pending",
          });
        }
        if (hasWarnings) rowsFlagged += 1;
      } else {
        // Auto-insert — clean parse, no existing unit, contract attached
        rowsCreated += 1;
        if (commit) {
          const insertPayload = {
            ...canonical,
            contract_id: batch.contract_id,
          };
          const { data: inserted, error: insertErr } = await sb
            .from("units")
            .insert(insertPayload)
            .select("id")
            .single();
          if (insertErr) {
            log(`    insert failed for "${unitName}": ${insertErr.message}`);
            summary.errors.push({
              batchId: batch.id,
              message: `insert ${unitName}: ${insertErr.message}`,
            });
            rowsCreated -= 1;
            rowsFlagged += 1;
          } else if (inserted) {
            // The map stores full-row shape (post-canonicalize commit
            // 9a7b64e) so diffUnits can compare on later iterations
            // within the same batch. canonical contains every field
            // diffUnits looks at, plus we tack on the new id.
            existingUnitsByName.set(normalized, { id: inserted.id, ...canonical });
            await sb.from("unit_ingest_audit").insert({
              batch_id: batch.id,
              unit_id: inserted.id,
              action: "created",
              source_file: batch.drive_file_name,
              field_changes: { _all: { before: null, after: canonical } },
            });
          }
        }
      }
    }

    summary.rowsInserted += rowsCreated;
    summary.rowsQueuedForReview += rowsQueuedReview;

    log(
      `  result: ${rowsCreated} created · ${rowsQueuedReview} queued for review · ${rowsSkipped} skipped · ${rowsFlagged} flagged`,
    );

    // Final batch status
    const finalStatus = rowsFlagged > 0 ? "partial" : "success";
    if (commit) {
      await sb.from("unit_ingest_batches").update({
        status: finalStatus,
        rows_processed: parseResult.parsed.length,
        rows_created: rowsCreated,
        rows_skipped: rowsSkipped,
        rows_flagged: rowsFlagged,
        finished_at: new Date().toISOString(),
      }).eq("id", batch.id);
    }
    if (finalStatus === "success") summary.batchSuccesses += 1;
    else summary.batchFailures += 1;
  }

  return summary;
}

/** Lowercase + collapse whitespace + strip trailing punctuation. */
function normalizeName(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;]+$/g, "");
}
