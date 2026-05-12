/**
 * Test suite runner.
 *
 * Imports all test modules, executes each, aggregates results. Designed
 * to run in a Next.js API route context (Vercel serverless) or equivalent.
 *
 * Each test runs sequentially so mutations (like project-creation) don't
 * race each other. Total runtime target: <60s so Vercel's default
 * maxDuration is fine.
 */
import type { TestModule, TestResult, SuiteReport, TestContext } from "./_types";
import projectCreation from "./project-creation";
import unitFolderCreation from "./unit-folder-creation";
import driveEnvHealth from "./drive-env-health";
import supabaseConnectivity from "./supabase-connectivity";
import expensesLastRunHealth from "./expenses-last-run-health";
import authSmoke from "./auth-smoke";
import unitIngestParserHealth from "./unit-ingest-parser-health";
import unitIngestOrchestratorSmoke from "./unit-ingest-orchestrator-smoke";
import apiRoleGating from "./api-role-gating";
import emptyStateDataLayer from "./empty-state-data-layer";

const MODULES: TestModule[] = [
  driveEnvHealth, // cheap + fast — if it fails the others probably will too
  supabaseConnectivity,
  authSmoke,
  expensesLastRunHealth,
  unitIngestParserHealth, // pure parser tests — no DB / API mutation
  emptyStateDataLayer, // read-only — every list query returns [] not throws
  apiRoleGating, // hits /api routes without auth, asserts 401/403 — read-only
  projectCreation, // mutates — put near end
  unitFolderCreation, // mutates + depends on project-creation working
  unitIngestOrchestratorSmoke, // mutates queue tables — full cleanup at end
];

export async function runAllTests(baseUrl: string): Promise<SuiteReport> {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const startedAt = new Date();
  const results: TestResult[] = [];

  for (const m of MODULES) {
    const t0 = Date.now();
    const steps: TestResult["steps"] = [];
    const ctx: TestContext = {
      baseUrl,
      runId,
      step(name, ok, detail) {
        steps.push({ name, ok, detail });
      },
    };

    let result: TestResult;
    try {
      const out = await m.run(ctx);
      result = {
        name: m.name,
        description: m.description,
        severity: m.severity,
        ok: out.ok,
        duration_ms: Date.now() - t0,
        steps,
        error: out.error,
        cleanup_ok: out.cleanup_ok,
        cleanup_note: out.cleanup_note,
      };
    } catch (err) {
      result = {
        name: m.name,
        description: m.description,
        severity: m.severity,
        ok: false,
        duration_ms: Date.now() - t0,
        steps,
        error: err instanceof Error ? err.message : String(err),
        cleanup_ok: false,
        cleanup_note: "test threw before cleanup",
      };
    }
    results.push(result);
  }

  const finishedAt = new Date();
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const criticalFailures = results.filter((r) => !r.ok && r.severity === "critical").length;
  const cleanupLeaks = results.filter((r) => r.cleanup_ok === false).length;

  return {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    total: results.length,
    passed,
    failed,
    critical_failures: criticalFailures,
    cleanup_leaks: cleanupLeaks,
    results,
  };
}
