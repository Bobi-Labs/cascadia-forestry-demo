/**
 * GET /api/expenses/cron-import
 *
 * Weekly cron endpoint — runs the same expense import as the admin
 * "Import from Sheet" button, but unattended. Scheduled via vercel.json
 * (see repo root).
 *
 * Auth: Vercel cron invokes with header `Authorization: Bearer ${CRON_SECRET}`.
 * We verify that to prevent anyone else from triggering imports.
 *
 * The import itself uses the same POST /api/expenses/import logic — this
 * endpoint just looks up the configured spreadsheet ID, calls it, and logs
 * the result. No duplication of the parse/dedup/auto-match pipeline.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes — big imports can take a while

export async function GET(req: NextRequest) {
  // Vercel cron sends this header with CRON_SECRET (set in Vercel env vars).
  // Reject anything else.
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const spreadsheetId = process.env.NEXT_PUBLIC_EXPENSE_SHEET_ID;
  if (!spreadsheetId) {
    return NextResponse.json({ ok: false, error: "NEXT_PUBLIC_EXPENSE_SHEET_ID not set" }, { status: 500 });
  }

  // Call the existing import endpoint. Use absolute URL since we're
  // server-side. VERCEL_URL is set automatically on Vercel; fall back to
  // localhost for dev.
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  try {
    const res = await fetch(`${base}/api/expenses/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spreadsheetId, importedBy: "cron" }),
    });
    const data = await res.json();
    console.log("[cron-import]", JSON.stringify({
      ok: data.ok,
      imported: data.imported,
      skipped: data.skipped,
      autoMatched: data.autoMatched,
      errors: data.errors,
    }));
    return NextResponse.json({
      ok: data.ok,
      triggeredAt: new Date().toISOString(),
      imported: data.imported,
      skipped: data.skipped,
      autoMatched: data.autoMatched,
      errors: data.errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron-import] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
