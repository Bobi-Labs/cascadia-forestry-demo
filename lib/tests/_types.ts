/**
 * Shared types for the daily test suite.
 *
 * Each test exports `{ name, description, severity, run }`. The runner
 * invokes `run()`, captures timing + errors, and aggregates into a report
 * that gets emailed out.
 */

export type TestSeverity = "critical" | "warning";

export interface TestStep {
  name: string;
  ok: boolean;
  detail?: unknown;
}

export interface TestResult {
  /** Stable identifier, matches the test file's export */
  name: string;
  /** Human-readable one-liner for the email */
  description: string;
  severity: TestSeverity;
  ok: boolean;
  /** Milliseconds */
  duration_ms: number;
  /** Steps executed (pass or fail) — useful for debugging flaky tests */
  steps: TestStep[];
  error?: string;
  /** True if cleanup ran cleanly; false means test left residue */
  cleanup_ok?: boolean;
  cleanup_note?: string;
}

export interface TestModule {
  name: string;
  description: string;
  severity: TestSeverity;
  run(ctx: TestContext): Promise<Omit<TestResult, "name" | "description" | "severity" | "duration_ms">>;
}

export interface TestContext {
  /** Base URL for API calls — prod URL on Vercel, localhost for dev */
  baseUrl: string;
  /** Current run ID (timestamp-based) — use in test-data tags for cleanup */
  runId: string;
  /** Allows tests to emit sub-steps into the result */
  step(name: string, ok: boolean, detail?: unknown): void;
}

export interface SuiteReport {
  run_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  total: number;
  passed: number;
  failed: number;
  critical_failures: number;
  cleanup_leaks: number;
  results: TestResult[];
}
