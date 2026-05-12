import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/tracker/telegram";
import { parseMentions, notifyMentionedUsers } from "@/lib/tracker/mentions";
import { channelForOpsProjectId, sendMessage as sendOpsMessage } from "@/lib/ops-bots";

/**
 * GET /api/tracker/chat?projectId=...&limit=50&before=...
 * Fetch recent chat messages for a project.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const before = searchParams.get("before"); // ISO timestamp for pagination

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  let query = admin
    .from("tracker_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return in ascending order for display
  return NextResponse.json({ messages: (data ?? []).reverse() });
}

/**
 * POST /api/tracker/chat
 * Send a chat message (inserts into DB + forwards to Telegram group).
 * Body: { projectId, author, authorId?, content }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, author, authorId, content } = body;

    if (!projectId || !author || !content) {
      return NextResponse.json(
        { error: "projectId, author, and content are required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Insert message
    const { data: message, error: insertError } = await admin
      .from("tracker_messages")
      .insert({
        project_id: projectId,
        author,
        author_id: authorId ?? null,
        content,
        source: "web",
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Forward to Telegram — fire-and-forget. The DB insert above is the
    // source of truth for the dashboard; the TG send is best-effort.
    // Awaiting the TG round-trip (200-800ms) was adding visible lag to
    // every send while the user waited for the dashboard echo. By
    // returning the API response as soon as the DB insert lands and
    // running the TG send in the background, the dashboard refresh-after-
    // send becomes nearly instant. Failures get logged server-side; the
    // user already sees their message in the dashboard mirror.
    //
    // Two routing paths:
    //   1. Ops projects (admin_office, foreman, updates, watercooler) —
    //      env-based ops bots via lib/ops-bots.ts.
    //   2. Other projects — tracker_telegram_config (Site Build / per-
    //      project flow, including bees_jaime).
    const tgText = `${author}: ${content}`;
    const opsChannel = channelForOpsProjectId(projectId);
    if (opsChannel) {
      void sendOpsMessage(opsChannel, tgText, undefined)
        .then((sent) => {
          console.log(`TG forward ${sent ? "OK" : "FAILED"} → ops channel=${opsChannel}, project=${projectId}`);
        })
        .catch((err) => {
          console.error(`TG forward error → ops channel=${opsChannel}:`, err);
        });
    } else {
      void admin
        .from("tracker_telegram_config")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle()
        .then(({ data: config, error: configError }) => {
          if (configError) {
            console.error("TG config lookup failed:", configError.message);
            return;
          }
          if (config?.chat_id && config?.bot_token) {
            return sendTelegramMessage(config.chat_id, config.bot_token, tgText)
              .then((sent) => {
                console.log(`TG forward ${sent ? "OK" : "FAILED"} → chat_id=${config.chat_id}, project=${projectId}`);
              });
          }
          console.log(`No TG config for project ${projectId}`);
        })
        .then(() => undefined);
    }

    // Handle @mentions (fire and forget)
    const mentions = parseMentions(content);
    if (mentions.length > 0) {
      notifyMentionedUsers(projectId, author, content, "chat").catch(() => {});
    }

    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/tracker/chat?messageId=<uuid>
 * Removes a message from tracker_messages AND attempts to delete the
 * corresponding Telegram message via the bot.
 *
 * Routing for TG delete (same as send):
 *   - Ops project IDs (3000…0001-0004 + 1000…0001) → env-based bots
 *   - Other project IDs → tracker_telegram_config (per-project bot)
 *
 * TG limitations (documented at:
 *   https://core.telegram.org/bots/api#deletemessage):
 *   - A bot can always delete its OWN messages within 48 hours of send.
 *   - A bot can delete messages from OTHER users only if it's a chat
 *     admin AND only within 48 hours.
 *   - After 48 hours, no deletes are possible from the bot side.
 *   - Channel posts have different rules — N/A for our group chats.
 *
 * The DB row is always deleted (source of truth for the dashboard
 * mirror). TG delete is best-effort; failures are logged but don't fail
 * the request — the dashboard view is gone, which is the user's intent.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");
    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch the message so we know which TG chat + message to delete
    const { data: msg, error: fetchError } = await admin
      .from("tracker_messages")
      .select("id, project_id, telegram_message_id")
      .eq("id", messageId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Delete the DB row first — that's the user-visible action and the
    // source of truth for the dashboard mirror.
    const { error: deleteError } = await admin
      .from("tracker_messages")
      .delete()
      .eq("id", messageId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Attempt TG delete — best-effort, fire-and-forget.
    if (msg.telegram_message_id) {
      void deleteFromTelegram(admin, msg.project_id, Number(msg.telegram_message_id))
        .then((result) => {
          console.log(`TG delete ${result.ok ? "OK" : "FAILED"} → project=${msg.project_id}, tg_msg=${msg.telegram_message_id}: ${result.note ?? ""}`);
        })
        .catch((err) => {
          console.error(`TG delete error → project=${msg.project_id}, tg_msg=${msg.telegram_message_id}:`, err);
        });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/** Helper: send a TG deleteMessage request via the right bot. */
async function deleteFromTelegram(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  tgMessageId: number,
): Promise<{ ok: boolean; note?: string }> {
  // Resolve bot token + chat ID — two routing paths (mirror of POST).
  let botToken = "";
  let chatId = "";

  const opsChannel = channelForOpsProjectId(projectId);
  if (opsChannel) {
    botToken =
      opsChannel === "admin_office" ? process.env.TG_ADMIN_OFFICE_BOT_TOKEN || "" :
      opsChannel === "foreman"      ? process.env.TG_FOREMAN_BOT_TOKEN      || "" :
      opsChannel === "updates"      ? process.env.TG_UPDATES_BOT_TOKEN      || "" :
      opsChannel === "watercooler"  ? process.env.TG_WATERCOOLER_BOT_TOKEN  || "" :
      "";
    chatId =
      opsChannel === "admin_office" ? process.env.TG_ADMIN_OFFICE_CHAT_ID || "" :
      opsChannel === "foreman"      ? process.env.TG_FOREMAN_CHAT_ID      || "" :
      opsChannel === "updates"      ? process.env.TG_UPDATES_CHAT_ID      || "" :
      opsChannel === "watercooler"  ? process.env.TG_WATERCOOLER_CHAT_ID  || "" :
      "";
  } else {
    const { data: config } = await admin
      .from("tracker_telegram_config")
      .select("bot_token, chat_id")
      .eq("project_id", projectId)
      .maybeSingle();
    botToken = config?.bot_token ?? "";
    chatId = config?.chat_id ?? "";
  }

  if (!botToken || !chatId) {
    return { ok: false, note: "no bot config" };
  }

  // Avoid using global fetch via ops-bots — call TG directly here so we
  // can read the response body to surface meaningful errors (e.g.
  // "message can't be deleted" when 48h has passed).
  const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: tgMessageId }),
  });
  const data = await res.json();
  return data.ok
    ? { ok: true }
    : { ok: false, note: data.description || "unknown TG error" };
}
