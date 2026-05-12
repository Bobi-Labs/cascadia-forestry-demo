/**
 * GET /api/tests/run
 *
 * Daily test suite entry point. Called by Vercel Cron (see vercel.json)
 * with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Also callable manually for on-demand runs — send the same header.
 *
 * Response: the SuiteReport JSON (same as email body in structured form).
 * Side effect: emails the report to TEST_SUITE_RECIPIENTS via Resend.
 */
import { NextRequest, NextResponse } from "next/server";
import { runAllTests } from "@/lib/tests/_runner";
import { sendReportEmail } from "@/lib/tests/_email";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || authHeader !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Optional ?noEmail=1 for manual debugging runs that shouldn't email
  const noEmail = req.nextUrl.searchParams.get("noEmail") === "1";

  // Base URL for in-suite fetch calls (tests hit /api/drive/contract-folders, etc.)
  // Prefer PUBLIC_SITE_URL — the canonical production domain is not behind
  // Vercel Deployment Protection, unlike VERCEL_URL (deployment-specific subdomain).
  const baseUrl =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : "http://localhost:3000");

  const report = await runAllTests(baseUrl);

  let emailResult: { ok: boolean; id?: string; error?: string } | null = null;
  if (!noEmail) {
    emailResult = await sendReportEmail(report);
  }

  return NextResponse.json({ report, email: emailResult });
}
