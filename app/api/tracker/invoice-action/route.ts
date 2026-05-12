import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/tracker/telegram";
import type { Database } from "@/lib/supabase/database.types";

/**
 * POST /api/tracker/invoice-action
 *
 * Server-side handler for the Sent? / Paid? buttons in the Work Tracker's
 * Ongoing Work tab. Replaces the previous client-direct supabase update.
 *
 * Why server-side:
 *   1. Audit log — every status change goes into deliverable_invoice_log
 *      with the actor's email. We can answer "who clicked this and when".
 *   2. Telegram alert — when Jaime (or anyone other than Bees) flips a
 *      status, fire a message to TG_UPDATES_CHAT_ID so Bees knows
 *      without polling the tracker.
 *
 * Body: { itemId: string, half: 'kickoff' | 'final', newStatus: 'sent' | 'paid', actorEmail: string | null }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { itemId, half, newStatus, actorEmail } = body as {
      itemId: string;
      half: "kickoff" | "final";
      newStatus: "sent" | "paid";
      actorEmail: string | null;
    };

    if (!itemId || !half || !newStatus) {
      return NextResponse.json(
        { error: "Missing required fields: itemId, half, newStatus" },
        { status: 400 },
      );
    }
    if (!["kickoff", "final"].includes(half)) {
      return NextResponse.json({ error: "half must be 'kickoff' or 'final'" }, { status: 400 });
    }
    if (!["sent", "paid"].includes(newStatus)) {
      return NextResponse.json({ error: "newStatus must be 'sent' or 'paid'" }, { status: 400 });
    }

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Fetch current state for the audit log
    const { data: item, error: getErr } = await supabase
      .from("deliverable_items")
      .select("id, item_key, title, invoice_kickoff_status, invoice_final_status, invoice_number")
      .eq("id", itemId)
      .single();
    if (getErr || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const column = half === "kickoff" ? "invoice_kickoff_status" : "invoice_final_status";
    const oldStatus = half === "kickoff" ? item.invoice_kickoff_status : item.invoice_final_status;

    // Update
    const { error: upErr } = await supabase
      .from("deliverable_items")
      .update({ [column]: newStatus, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Audit log
    await supabase.from("deliverable_invoice_log").insert({
      item_id: itemId,
      invoice_field: half,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: actorEmail,
    });

    // Telegram alert — fire only when actor != Bees (Bees doesn't need a
    // ping for clicks he made himself). If we can't tell, send anyway.
    const isBees = actorEmail === "mietsko@gmail.com";
    if (!isBees) {
      const botToken = process.env.TG_UPDATES_BOT_TOKEN;
      const chatId = process.env.TG_UPDATES_CHAT_ID;
      if (botToken && chatId) {
        const halfLabel = half === "kickoff" ? "1st ½ (kickoff)" : "2nd ½ (final)";
        const actionLabel =
          newStatus === "sent"
            ? "marked PAYMENT SENT (awaiting receipt)"
            : "marked PAID (received)";
        const text =
          `💰 Invoice update on *${item.title}*\n` +
          `${halfLabel} — ${actionLabel}\n` +
          `Invoice: ${item.invoice_number ?? "—"}\n` +
          `By: ${actorEmail ?? "(unknown)"}`;
        // Fire-and-forget — don't fail the action if TG hiccups
        sendTelegramMessage(chatId, botToken, text).catch((e) =>
          console.error("Invoice TG notify failed:", e),
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("invoice-action error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
