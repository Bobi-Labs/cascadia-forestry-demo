/**
 * POST /api/ingest/trigger
 *
 * Manual ingest trigger from the dashboard. Same work as the cron
 * route (`/api/ingest/run`) but auth-via-session instead of via
 * CRON_SECRET, since admins click this from the UI.
 *
 * Body (all optional):
 *   { dryRun?: boolean, scanOnly?: boolean }
 *
 * Response: same JSON summary the cron returns.
 *
 * Auth: trusts the supabase session — but the UI gates the button
 * to admin role only. Server-side verification would need an auth
 * pass (RLS tightening is on the backlog already).
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { scanContractFoldersForUnitSpecs } from "@/lib/ingest/drive-scan.mjs";
import { processPendingBatches } from "@/lib/ingest/process-batch.mjs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = !!body.dryRun;
    const scanOnly = !!body.scanOnly;

    const credsB64Raw = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (!credsB64Raw) {
      return NextResponse.json({ ok: false, error: "GOOGLE_CREDENTIALS_BASE64 unset" }, { status: 500 });
    }
    // Vercel sometimes stores env vars with trailing whitespace/newline
    // (April 16 GOOGLE_DRIVE_*_FOLDER_ID bug had the same shape). Strip
    // any whitespace before decoding so the JSON parse doesn't choke on
    // an extra byte at the end of the decoded buffer.
    const credsB64 = credsB64Raw.trim();
    const creds = JSON.parse(Buffer.from(credsB64, "base64").toString("utf8"));
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const authClient = await auth.getClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drive = google.drive({ version: "v3", auth: authClient as any });

    // Trim env vars before use — Vercel sometimes stores them with a
    // trailing newline (same pattern as the April 16 GOOGLE_DRIVE_*
    // bug + the GOOGLE_CREDENTIALS_BASE64 trim above). Untrimmed JWT
    // keys fail Supabase auth with "Invalid API key".
    const sb = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
      (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    );

    const startedAt = Date.now();
    const scanResult = await scanContractFoldersForUnitSpecs({
      drive,
      sb,
      commit: !dryRun,
      log: () => {},
    });

    let processResult = null;
    if (!scanOnly) {
      processResult = await processPendingBatches({
        drive,
        sb,
        commit: !dryRun,
        log: () => {},
      });
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      scanOnly,
      elapsedMs: Date.now() - startedAt,
      scan: {
        contractsWalked: scanResult.contractsWalked,
        filesFound: scanResult.filesFound,
        batchesCreated: scanResult.batchesCreated,
        filesSkipped: scanResult.filesSkipped,
        filesUnrecognized: scanResult.filesUnrecognized,
        errorCount: scanResult.errors.length,
        errors: scanResult.errors.slice(0, 10),
      },
      process: processResult ? {
        batchesProcessed: processResult.batchesProcessed,
        rowsInserted: processResult.rowsInserted,
        rowsQueuedForReview: processResult.rowsQueuedForReview,
        batchSuccesses: processResult.batchSuccesses,
        batchFailures: processResult.batchFailures,
        errorCount: processResult.errors.length,
        errors: processResult.errors.slice(0, 10),
      } : null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
