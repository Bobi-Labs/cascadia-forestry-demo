/**
 * Telegram bot integration for the work tracker.
 * Server-side only — bot tokens never exposed to client.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type TrackerItem = Database["public"]["Tables"]["tracker_items"]["Row"];
type TrackerNote = Database["public"]["Tables"]["tracker_notes"]["Row"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Create an admin client that bypasses RLS (server-side only) */
function getAdminClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

/** Send a message via Telegram Bot API */
export async function sendTelegramMessage(
  chatId: string,
  botToken: string,
  text: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      },
    );
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram API error:", data.description);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Telegram send failed:", err);
    return false;
  }
}

/** Format an item notification for Telegram */
export function formatItemNotification(
  event: string,
  item: TrackerItem,
  note?: TrackerNote,
): string {
  const title = item.title;
  const priority = (item.priority ?? "medium").toUpperCase();
  const assigned = item.assigned_to ?? "unassigned";

  switch (event) {
    case "item_done":
      return `✅ *Done:* ${title}\nCompleted — assigned to ${assigned}`;

    case "status_change":
      if (item.status === "done") {
        return `✅ *Done:* ${title}\nMarked complete by ${assigned}`;
      }
      if (item.status === "blocked") {
        return `🔴 *BLOCKED:* ${title}\nNeeds attention — assigned to ${assigned}`;
      }
      return `🔄 *Status changed:* ${title}\nNow: ${item.status} — assigned to ${assigned}`;

    case "new_item":
      return `📋 *New item:* ${title}\nPriority: ${priority} — Assigned: ${assigned}`;

    case "new_note":
      return `💬 *${note?.author ?? "Someone"}* added a note on *${title}*:\n${note?.content ?? ""}`;

    case "priority_change":
      return `⚡ *Priority changed:* ${title}\nNow: ${priority}`;

    case "due_date":
      return `⏰ *Due soon:* ${title}\nDue: ${item.due_date ?? "not set"}`;

    default:
      return `📌 *Update:* ${title}\nEvent: ${event}`;
  }
}

/** Check config and send notification if the event type is enabled.
 *  Also mirrors the notification into tracker_messages so the web chat sees it. */
export async function notifyIfConfigured(
  projectId: string,
  event: string,
  item: TrackerItem,
  note?: TrackerNote,
): Promise<void> {
  try {
    const admin = getAdminClient();
    const { data: config } = await admin
      .from("tracker_telegram_config")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    if (!config?.chat_id || !config?.bot_token) return;

    // Check if this event type is in notify_on array
    const notifyOn = config.notify_on ?? [];
    if (!notifyOn.includes(event)) return;

    const message = formatItemNotification(event, item, note);
    await sendTelegramMessage(config.chat_id, config.bot_token, message);

    // Mirror into tracker_messages so the web chat panel sees it too.
    // Strip Markdown bold markers for cleaner web display.
    const cleanMessage = message.replace(/\*/g, "");
    await admin.from("tracker_messages").insert({
      project_id: projectId,
      author: "System",
      author_id: null,
      content: cleanMessage,
      source: "system",
    }).then(({ error }) => {
      if (error) console.error("Failed to mirror notification to chat:", error.message);
    });
  } catch (err) {
    // Fire-and-forget — don't let notification failures break the app
    console.error("notifyIfConfigured error:", err);
  }
}
