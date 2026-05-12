/**
 * GET /api/ingest/run
 *
 * Item 8 Stage 8a — automated unit ingest pipeline.
 *
 * Runs both halves of the pipeline back-to-back:
 *   1. Drive watcher (scanContractFoldersForUnitSpecs) — scans every
 *      active contract's folder, records new spec files as pending
 *      batches in unit_ingest_batches.
 *   2. Orchestrator (processPendingBatches) — picks up pending
 *      batches, downloads + parses each, writes results to `units`
 *      (auto-insert) or unit_pending_review (office triage).
 *
 * Auth: same Bearer token pattern as /api/tests/run + /api/ops-bot/
 * daily-reminders (CRON_SECRET). Vercel Cron sends it automatically;
 * manual runs need the header too.
 *
 * Query params:
 *   ?dryRun=1     — scan + parse without writing. Useful for prod
 *                   sanity-check before flipping to commit mode.
 *   ?scanOnly=1   — scan only, skip orchestrator (don't process new
 *                   batches yet — useful when you want to see what
 *                   would land before parsing).
 *
 * Response: JSON with the full scan + process summary.
 *
 * Vercel Cron schedule (vercel.json):
 *   "0 12 * * *"  → 4 AM PST / 5 AM PDT, every day. Set per the
 *                   May 8 demo call: Jaime wanted overnight uploads
 *                   processed before he opens the dashboard each
 *                   morning. UTC offset shifts an hour during DST
 *                   (Vercel cron is UTC-only) — that's fine for
 *                   this workflow; office triage can absorb the
 *                   ±1h drift.
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { scanContractFoldersForUnitSpecs } from "@/lib/ingest/drive-scan.mjs";
import { processPendingBatches } from "@/lib/ingest/process-batch.mjs";

export const runtime = "nodejs";
// Allow up to 5 min — full scan + parse on 12 contracts ran <90s in
// dev, but giving headroom for growth.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || authHeader !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const scanOnly = req.nextUrl.searchParams.get("scanOnly") === "1";

  // Drive client (service-account)
  const credsB64Raw = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!credsB64Raw) {
    return NextResponse.json({ ok: false, error: "GOOGLE_CREDENTIALS_BASE64 unset" }, { status: 500 });
  }
  // .trim() defends against trailing whitespace Vercel sometimes adds to
  // env vars — see the matching defensive trim in trigger/route.ts.
  const credsB64 = credsB64Raw.trim();
  const creds = JSON.parse(Buffer.from(credsB64, "base64").toString("utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  // googleapis types lag the runtime — getClient() returns a valid auth
  // client that google.drive accepts at runtime, but the type signatures
  // don't line up cleanly. Cast around it.
  const authClient = await auth.getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drive = google.drive({ version: "v3", auth: authClient as any });

  // Supabase admin client
  // Trim — see matching defensive trim in trigger/route.ts. Vercel sometimes
  // stores env vars with a trailing newline; untrimmed JWT keys fail
  // Supabase auth with "Invalid API key".
  const sb = createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  );

  const startedAt = Date.now();

  // 1) Watch / scan
  const scanResult = await scanContractFoldersForUnitSpecs({
    drive,
    sb,
    commit: !dryRun,
    log: () => {}, // suppress cron output; result has the full picture
  });

  // 2) Orchestrate / parse — skipped on scanOnly
  let processResult = null;
  if (!scanOnly) {
    processResult = await processPendingBatches({
      drive,
      sb,
      commit: !dryRun,
      log: () => {},
    });
  }

  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    ok: true,
    dryRun,
    scanOnly,
    elapsedMs,
    scan: {
      contractsWalked: scanResult.contractsWalked,
      filesFound: scanResult.filesFound,
      batchesCreated: scanResult.batchesCreated,
      filesSkipped: scanResult.filesSkipped,
      filesUnrecognized: scanResult.filesUnrecognized,
      errorCount: scanResult.errors.length,
    },
    process: processResult
      ? {
          batchesProcessed: processResult.batchesProcessed,
          rowsInserted: processResult.rowsInserted,
          rowsQueuedForReview: processResult.rowsQueuedForReview,
          batchSuccesses: processResult.batchSuccesses,
          batchFailures: processResult.batchFailures,
          errorCount: processResult.errors.length,
        }
      : null,
  });
}
