/**
 * Auto-match engine — reads suggested contract assignments from the
 * v_expense_auto_matches view, applies them to expense rows, and writes
 * audit log entries.
 *
 * The matching logic itself lives in SQL (see scripts/archive/migrate-expenses-phase-c.mjs).
 * This file is the thin orchestrator around it.
 *
 * Safe to re-run: the view only surfaces expenses with contract_id IS NULL,
 * so previously-assigned rows are never touched. If the office manually
 * assigns an expense and we later re-run auto-match, that manual assignment
 * is preserved.
 *
 * Not exposed directly — called from app/api/expenses/auto-match/route.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DB = SupabaseClient<Database>;

export type AutoMatchOptions = {
  /** Only match expenses from this import batch. If omitted, match all unassigned. */
  batchId?: string;
  /** User id (or string identifier) credited as the one applying the auto-match. */
  userId?: string | null;
  /** Dry run: read the view but do not write anything. Useful for previews. */
  dryRun?: boolean;
};

export type AutoMatchApplied = {
  expenseId: string;
  contractId: string;
  contractName: string | null;
  method: string;
  confidence: number;
};

export type AutoMatchSummary = {
  candidates: number;
  applied: number;
  skipped: number;
  byMethod: Record<string, number>;
  errors: Array<{ expenseId: string; message: string }>;
  applied_rows: AutoMatchApplied[];
};

/**
 * Read suggested matches from the view and apply them to expenses.
 */
export async function autoMatchExpenses(
  sb: DB,
  options: AutoMatchOptions = {},
): Promise<AutoMatchSummary> {
  const { batchId, userId = "auto-match", dryRun = false } = options;

  // ──────────────────────────────────────────────────────
  // 1. Fetch candidate matches from the view
  // ──────────────────────────────────────────────────────
  let query = sb
    .from("v_expense_auto_matches")
    .select(
      "expense_id, contract_id, contract_name, method, confidence, total_hours, winning_hours",
    );

  if (batchId) {
    query = query.eq("import_batch_id", batchId);
  }

  const { data: matches, error: viewErr } = await query;
  if (viewErr) {
    throw new Error(`Failed to read v_expense_auto_matches: ${viewErr.message}`);
  }

  const rows = matches || [];
  const summary: AutoMatchSummary = {
    candidates: rows.length,
    applied: 0,
    skipped: 0,
    byMethod: {},
    errors: [],
    applied_rows: [],
  };

  if (rows.length === 0) {
    return summary;
  }

  if (dryRun) {
    // Don't write, just report what would happen
    for (const m of rows) {
      if (!m.expense_id || !m.contract_id || !m.method) {
        summary.skipped++;
        continue;
      }
      summary.byMethod[m.method] = (summary.byMethod[m.method] || 0) + 1;
      summary.applied_rows.push({
        expenseId: m.expense_id,
        contractId: m.contract_id,
        contractName: m.contract_name,
        method: m.method,
        confidence: Number(m.confidence ?? 0),
      });
    }
    summary.applied = summary.applied_rows.length;
    return summary;
  }

  // ──────────────────────────────────────────────────────
  // 2. Apply matches — UPDATE expense + insert audit log
  // ──────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const assignedBy = userId || "auto-match";

  for (const m of rows) {
    if (!m.expense_id || !m.contract_id || !m.method) {
      summary.skipped++;
      continue;
    }

    // Update the expense row. We double-check contract_id IS NULL here to
    // avoid a race where a manual assignment snuck in between the view
    // read and this write.
    const { error: updErr } = await sb
      .from("expenses")
      .update({
        contract_id: m.contract_id,
        match_method: m.method,
        match_confidence: Number(m.confidence ?? 0),
        assigned_by: assignedBy,
        assigned_at: now,
      } as never)
      .eq("id", m.expense_id)
      .is("contract_id", null);

    if (updErr) {
      summary.errors.push({
        expenseId: m.expense_id,
        message: `Update failed: ${updErr.message}`,
      });
      continue;
    }

    // Audit log — one entry per auto-assignment
    const { error: auditErr } = await sb.from("expense_audit_log").insert({
      expense_id: m.expense_id,
      user_id: userId || null,
      action: "auto_matched",
      field_changed: "contract_id",
      old_value: null,
      new_value: m.contract_id,
    } as never);

    if (auditErr) {
      // Don't fail the match if audit write fails — log and move on.
      // The expense is already updated; better to have the data than to abort.
      summary.errors.push({
        expenseId: m.expense_id,
        message: `Audit log failed: ${auditErr.message}`,
      });
    }

    summary.applied++;
    summary.byMethod[m.method] = (summary.byMethod[m.method] || 0) + 1;
    summary.applied_rows.push({
      expenseId: m.expense_id,
      contractId: m.contract_id,
      contractName: m.contract_name,
      method: m.method,
      confidence: Number(m.confidence ?? 0),
    });
  }

  return summary;
}
