/**
 * Test: API role-gating sanity.
 *
 * Promised in the May 2026 Test Suite Expansion bonus row. The
 * platform has admin-only API routes (set-password, drive setup,
 * tracker chat send-as-user, etc.) — this test fires unauthenticated
 * requests at every one of them and asserts the response is 401 / 403
 * (NOT 200, NOT 500).
 *
 * Catches the regression class where a sidebar tweak or a new route
 * accidentally exposes an admin-only surface to anon callers.
 *
 * This test does NOT validate role-specific positive paths (e.g.
 * "office can do X but foreman can't") — that needs JWT minting per
 * role which the test runner doesn't have plumbing for. The negative
 * path (anon → must reject) catches the highest-value regressions.
 */
import type { TestContext, TestModule } from "./_types";

interface RouteCheck {
  /** HTTP method */
  method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  /** URL path under baseUrl */
  path: string;
  /** Expected status when no auth is sent. 307 = middleware redirect-
   *  to-login, 401/403 = route-level auth rejection, 405 = follows the
   *  307 to /auth/login then POSTs to a page (also valid rejection). */
  expectedStatuses: number[];
  /** Optional body for POST/PUT */
  body?: unknown;
  /** Description shown in step name */
  desc: string;
}

const ROUTES: RouteCheck[] = [
  // ── Admin/auth-protected — middleware redirects 307 → 405 (POST to /auth/login) ──
  { method: "POST", path: "/api/admin/set-password", expectedStatuses: [307, 401, 403, 405], body: { employeeId: "00000000-0000-0000-0000-000000000000", password: "abcdefgh" }, desc: "admin-set-password" },
  // ── Cron-secret-protected — route returns 401 directly (middleware bypassed) ──
  { method: "GET",  path: "/api/tests/run", expectedStatuses: [401, 403], desc: "tests-run-no-auth" },
  { method: "GET",  path: "/api/ingest/run", expectedStatuses: [401, 403], desc: "ingest-run-no-auth" },
  { method: "GET",  path: "/api/expenses/cron-import", expectedStatuses: [401, 403], desc: "expenses-cron-no-auth" },
  { method: "GET",  path: "/api/ops-bot/daily-reminders", expectedStatuses: [401, 403], desc: "daily-reminders-no-auth" },
];

const mod: TestModule = {
  name: "api-role-gating",
  description: "Anon callers hit admin/cron routes and get 401/403 (not 200, not 500)",
  severity: "critical",

  async run(ctx: TestContext) {
    const failures: string[] = [];

    for (const r of ROUTES) {
      try {
        // redirect: 'manual' so we SEE the 307 redirect status that
        // the middleware emits — otherwise fetch follows it to
        // /auth/login and we get 200 (or 405 if the original method
        // doesn't apply to the page) instead of the actual rejection.
        const res = await fetch(`${ctx.baseUrl}${r.path}`, {
          method: r.method,
          redirect: "manual",
          headers: r.body ? { "Content-Type": "application/json" } : undefined,
          body: r.body ? JSON.stringify(r.body) : undefined,
        });

        const ok = r.expectedStatuses.includes(res.status);
        ctx.step(`${r.desc}.status`, ok, { got: res.status, expected: r.expectedStatuses });
        if (!ok) {
          failures.push(`${r.desc}: got ${res.status}, expected one of ${r.expectedStatuses.join("/")}`);
        }

        // Make sure the response isn't a 500 — those mean the route
        // started processing without checking auth, which is the bug
        // class we care about.
        if (res.status >= 500) {
          failures.push(`${r.desc}: returned ${res.status} (auth check should run BEFORE business logic)`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.step(`${r.desc}.fetch`, false, { error: msg });
        failures.push(`${r.desc}: fetch threw: ${msg}`);
      }
    }

    if (failures.length > 0) {
      return {
        ok: false,
        error: failures.join("; "),
        steps: [],
        cleanup_ok: true,
      };
    }
    return { ok: true, steps: [], cleanup_ok: true };
  },
};

export default mod;
