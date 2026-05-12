import { NextRequest, NextResponse } from "next/server";
import { sendMessage, generateMorningDigest } from "@/lib/ops-bots";

/**
 * GET /api/ops-bot/digest
 *
 * Sends the morning digest to the Admin/Office channel.
 * Can be triggered by a cron job (Vercel Cron or external) or manually.
 *
 * Optional query params:
 *   ?channel=foreman — also send to foreman channel
 *   ?channel=all — send to all channels
 */
export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get("channel");

  try {
    const digest = await generateMorningDigest();

    // Always send to admin/office
    await sendMessage("admin_office", digest);

    // Optionally send to foreman or all
    if (channel === "foreman" || channel === "all") {
      await sendMessage("foreman", digest);
    }
    if (channel === "all") {
      await sendMessage("updates", digest);
    }

    return NextResponse.json({ ok: true, message: "Digest sent" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ops-bot] Digest error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
