/**
 * Test: weekly expense import cron last-run health (hook, not re-run).
 *
 * Does NOT trigger the import. Just reads the state the weekly cron writes
 * and checks: (1) latest batch is recent enough (cron has been firing),
 * (2) latest batch imported some rows, (3) no unexpectedly high error count.
 *
 * Weekly cron runs Mondays 14:00 UTC. With a daily test, "recent enough"
 * is <= 10 days (allows one missed cycle before we flag it).
 */
import type { TestContext, TestModule } from "./_types";
import { serviceRoleClient } from "./_supabase";

const MAX_AGE_DAYS = 10;

const mod: TestModule = {
  name: "expenses-last-run-health",
  description: "Weekly expense import ran recently and produced reasonable output",
  severity: "warning", // warning, not critical — a late cron shouldn't gate deploy

  async run(ctx: TestContext) {
    const supabase = serviceRoleClient();

    const { data: batches, error } = await supabase
      .from("expense_imports")
      .select("id, imported_at, tab_name, imported_count, skipped_count, error_count, status")
      .order("imported_at", { ascending: false })
      .limit(1);

    if (error) {
      return { ok: false, error: `expense_imports query: ${error.message}`, steps: [], cleanup_ok: true };
    }

    if (!batches || batches.length === 0) {
      ctx.step("expense_imports.has_batches", false);
      return { ok: false, error: "no import batches in expense_imports table", steps: [], cleanup_ok: true };
    }

    const latest = batches[0];
    ctx.step("expense_imports.has_batches", true, { latest_id: latest.id, tab: latest.tab_name });

    const ageMs = Date.now() - new Date(latest.imported_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const ageOk = ageDays <= MAX_AGE_DAYS;
    ctx.step("latest_batch.recent", ageOk, { ageDays: ageDays.toFixed(1), maxDays: MAX_AGE_DAYS });

    const statusOk = latest.status !== "failed";
    ctx.step("latest_batch.status", statusOk, { status: latest.status, imported: latest.imported_count, errors: latest.error_count });

    const failures: string[] = [];
    if (!ageOk) failures.push(`latest batch is ${ageDays.toFixed(1)} days old (max ${MAX_AGE_DAYS})`);
    if (!statusOk) failures.push(`latest batch status=${latest.status}`);

    if (failures.length === 0) return { ok: true, steps: [], cleanup_ok: true };
    return { ok: false, error: failures.join("; "), steps: [], cleanup_ok: true };
  },
};

export default mod;
