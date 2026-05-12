/**
 * Test: Supabase connectivity + key tables return expected shapes.
 *
 * Read-only. Catches: dead DB, expired/rotated keys, schema drift on
 * critical tables, unexpected empty states.
 */
import type { TestContext, TestModule } from "./_types";
import { serviceRoleClient, anonClient } from "./_supabase";

const EXPECTED_MIN_ROWS: Record<string, number> = {
  companies: 2,
  work_types: 12,
  contracts: 20,
  employees: 20,
  units: 100,
};

const mod: TestModule = {
  name: "supabase-connectivity",
  description: "Supabase is reachable; core tables return expected shapes",
  severity: "critical",

  async run(ctx: TestContext) {
    const svc = serviceRoleClient();
    const anon = anonClient();
    const failures: string[] = [];

    // Service role round-trip
    try {
      const { error } = await svc.from("companies").select("id").limit(1);
      if (error) throw new Error(error.message);
      ctx.step("service_role.reachable", true);
    } catch (e: any) {
      ctx.step("service_role.reachable", false, e.message);
      failures.push(`service_role: ${e.message}`);
    }

    // Anon round-trip (uses dev_anon_read policies while they exist)
    try {
      const { error } = await anon.from("companies").select("id").limit(1);
      if (error) throw new Error(error.message);
      ctx.step("anon.reachable", true);
    } catch (e: any) {
      ctx.step("anon.reachable", false, e.message);
      failures.push(`anon: ${e.message}`);
    }

    // Row count sanity checks
    for (const [table, minRows] of Object.entries(EXPECTED_MIN_ROWS)) {
      try {
        const { count, error } = await svc.from(table).select("*", { count: "exact", head: true });
        if (error) throw new Error(error.message);
        const ok = (count ?? 0) >= minRows;
        ctx.step(`${table}.row_count`, ok, { count, minExpected: minRows });
        if (!ok) failures.push(`${table}: ${count} rows < expected ${minRows}`);
      } catch (e: any) {
        ctx.step(`${table}.row_count`, false, e.message);
        failures.push(`${table} query: ${e.message}`);
      }
    }

    if (failures.length === 0) return { ok: true, steps: [], cleanup_ok: true };
    return {
      ok: false,
      error: `${failures.length} check(s) failed: ${failures.join("; ")}`,
      steps: [],
      cleanup_ok: true,
    };
  },
};

export default mod;
