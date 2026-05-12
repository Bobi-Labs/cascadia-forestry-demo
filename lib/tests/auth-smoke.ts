/**
 * Test: auth smoke — every role account can log in.
 *
 * Credentials come from TEST_ACCOUNTS_JSON env var (JSON array of
 * {label, email, password, role}). Read-only: signs in, gets a session,
 * signs out. Does not touch data.
 *
 * If any account fails, the suite fires warning (not critical) — the
 * auth system is still being hardened; we don't want to gate deploys
 * on a flaky login flow.
 */
import type { TestContext, TestModule } from "./_types";
import { anonClient } from "./_supabase";
import { trimEnv } from "./_drive";

interface TestAccount {
  label: string;
  email: string;
  password: string;
  role: string;
}

const mod: TestModule = {
  name: "auth-smoke",
  description: "All role accounts (admin/owner/foreman×2/office×2) can authenticate",
  severity: "warning",

  async run(ctx: TestContext) {
    const blob = trimEnv("TEST_ACCOUNTS_JSON");
    if (!blob) {
      return { ok: false, error: "TEST_ACCOUNTS_JSON env var missing", steps: [], cleanup_ok: true };
    }

    let accounts: TestAccount[];
    try {
      accounts = JSON.parse(blob);
    } catch (e: any) {
      return { ok: false, error: `TEST_ACCOUNTS_JSON parse: ${e.message}`, steps: [], cleanup_ok: true };
    }

    const failures: string[] = [];

    for (const acct of accounts) {
      const client = anonClient(); // fresh client per account — no session pollution
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: acct.email,
          password: acct.password,
        });
        if (error) throw new Error(error.message);
        const ok = !!data.session?.access_token;
        ctx.step(`auth.${acct.label}`, ok, ok ? { role: acct.role } : undefined);
        if (!ok) failures.push(`${acct.label} (${acct.email}): signed in but no session`);

        // Clean up: sign out
        await client.auth.signOut();
      } catch (e: any) {
        ctx.step(`auth.${acct.label}`, false, e.message);
        failures.push(`${acct.label} (${acct.email}): ${e.message}`);
      }
    }

    if (failures.length === 0) return { ok: true, steps: [], cleanup_ok: true };
    return {
      ok: false,
      error: `${failures.length} of ${accounts.length} accounts failed: ${failures.join("; ")}`,
      steps: [],
      cleanup_ok: true,
    };
  },
};

export default mod;
