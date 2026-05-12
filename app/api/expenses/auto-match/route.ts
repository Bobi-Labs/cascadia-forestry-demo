/**
 * POST /api/expenses/auto-match
 *
 * Runs the auto-match engine against unassigned expenses. Uses the
 * v_expense_auto_matches view to find candidate timesheet-based contract
 * assignments, then writes them to the expenses table with audit log entries.
 *
 * Body:
 *   {
 *     batchId?: string,     // optional: only match expenses from this import batch
 *     userId?: string,      // optional: id of user running the match (for audit)
 *     dryRun?: boolean      // optional: report matches without applying them
 *   }
 *
 * Response:
 *   {
 *     ok: boolean,
 *     candidates: number,
 *     applied: number,
 *     skipped: number,
 *     byMethod: Record<string, number>,
 *     errors: Array<{ expenseId: string, message: string }>,
 *     sample: AutoMatchApplied[]      // first 10 applied rows
 *   }
 *
 * Safe to call repeatedly: only matches expenses where contract_id IS NULL.
 * Previously-matched (manual or auto) rows are never touched.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { autoMatchExpenses } from "@/lib/expenses/auto-match";

export async function POST(req: NextRequest) {
  let batchId: string | undefined;
  let userId: string | null = null;
  let dryRun = false;

  try {
    // Allow empty body: default behavior is "match all unassigned"
    const text = await req.text();
    if (text) {
      const body = JSON.parse(text);
      batchId = body.batchId || undefined;
      userId = body.userId || null;
      dryRun = body.dryRun === true;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const sb = createAdminClient();

  try {
    const summary = await autoMatchExpenses(sb, {
      batchId,
      userId,
      dryRun,
    });

    return NextResponse.json({
      ok: true,
      candidates: summary.candidates,
      applied: summary.applied,
      skipped: summary.skipped,
      byMethod: summary.byMethod,
      errors: summary.errors,
      sample: summary.applied_rows.slice(0, 10),
      dryRun,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[expenses/auto-match] Fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
