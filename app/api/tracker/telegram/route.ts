import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/tracker/telegram";
import type { Database } from "@/lib/supabase/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Fallback project ID if chat_id lookup fails
const DEFAULT_PROJECT_ID = "10000000-0000-0000-0000-000000000001";

// Known team members for /name commands (lowercase → display name)
const TEAM_MEMBERS: Record<string, string> = {
  bees: "Bees",
  jaime: "Jaime",
};

/** Look up project_id from tracker_telegram_config by chat_id */
async function resolveProjectId(chatId: string): Promise<string> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("tracker_telegram_config")
    .select("project_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  return data?.project_id ?? DEFAULT_PROJECT_ID;
}

function getAdminClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

const PRIORITY_EMOJI: Record<string, string> = {
  high: "🟠",
  medium: "🟡",
  low: "⚪",
};

const STATUS_EMOJI: Record<string, string> = {
  pending: "⏳",
  in_progress: "🔧",
  blocked: "🚫",
};

/**
 * POST /api/tracker/telegram
 *
 * Telegram webhook handler — receives incoming bot commands.
 * Set up webhook via:
 *   https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-domain.vercel.app/api/tracker/telegram
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;

    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true }); // Ignore non-text updates
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const admin = getAdminClient();

    // Resolve project from chat_id (supports multiple TG groups)
    const PROJECT_ID = await resolveProjectId(chatId);

    // Get bot token from config
    const { data: config } = await admin
      .from("tracker_telegram_config")
      .select("bot_token")
      .eq("project_id", PROJECT_ID)
      .maybeSingle();

    if (!config?.bot_token) {
      return NextResponse.json({ ok: true }); // No config, ignore
    }

    const botToken = config.bot_token;

    // Strip @botname suffix from commands (e.g. /status@ForestryBot → /status)
    const command = text.split(" ")[0].split("@")[0].toLowerCase();

    // Parse commands
    if (command === "/status") {
      const { data: items } = await admin
        .from("tracker_items")
        .select("status")
        .eq("project_id", PROJECT_ID);

      if (!items) {
        await sendTelegramMessage(chatId, botToken, "Failed to fetch items.");
        return NextResponse.json({ ok: true });
      }

      const counts: Record<string, number> = {};
      for (const item of items) {
        const s = item.status ?? "pending";
        counts[s] = (counts[s] || 0) + 1;
      }

      const lines = Object.entries(counts)
        .map(([status, count]) => `• ${status}: ${count}`)
        .join("\n");

      await sendTelegramMessage(
        chatId,
        botToken,
        `📊 *Project Status*\n\nTotal: ${items.length}\n${lines}`,
      );
    } else if (command === "/blocking" || command === "/critical") {
      const { data: items } = await admin
        .from("tracker_items")
        .select("title, assigned_to")
        .eq("project_id", PROJECT_ID)
        .eq("priority", "high")
        .neq("status", "done")
        .neq("status", "future_phase");

      if (!items || items.length === 0) {
        await sendTelegramMessage(chatId, botToken, "🟢 No critical items!");
        return NextResponse.json({ ok: true });
      }

      const lines = items
        .map((i) => `🔴 ${i.title} — ${i.assigned_to ?? "unassigned"}`)
        .join("\n");

      await sendTelegramMessage(
        chatId,
        botToken,
        `*Critical Items (${items.length}):*\n\n${lines}`,
      );
    } else if (text.startsWith("/add ")) {
      const title = text.slice(5).trim();
      if (!title) {
        await sendTelegramMessage(chatId, botToken, "Usage: /add <title>");
        return NextResponse.json({ ok: true });
      }

      const { error } = await admin.from("tracker_items").insert({
        project_id: PROJECT_ID,
        category: "task",
        title,
        priority: "medium",
        status: "pending",
        assigned_to: "Jaime",
      });

      if (error) {
        await sendTelegramMessage(chatId, botToken, `Failed to add: ${error.message}`);
      } else {
        await sendTelegramMessage(chatId, botToken, `📋 Added: *${title}*`);
      }
    } else if (command === "/done" && text.trim() === "/done") {
      // Bare /done — list items completed today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: items } = await admin
        .from("tracker_items")
        .select("title, assigned_to, completed_at")
        .eq("project_id", PROJECT_ID)
        .eq("status", "done")
        .gte("completed_at", todayStart.toISOString())
        .order("completed_at", { ascending: false });

      if (!items || items.length === 0) {
        await sendTelegramMessage(chatId, botToken, "📭 Nothing completed today yet!");
        return NextResponse.json({ ok: true });
      }

      const lines = items
        .map((i) => {
          const time = i.completed_at
            ? new Date(i.completed_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : "";
          return `✅ ${i.title}${i.assigned_to ? ` — ${i.assigned_to}` : ""}${time ? ` (${time})` : ""}`;
        })
        .join("\n");

      await sendTelegramMessage(
        chatId,
        botToken,
        `*Completed Today (${items.length}):*\n\n${lines}`,
      );
    } else if (text.startsWith("/done ")) {
      // /done <search> — mark matching item as done
      const search = text.slice(6).trim().toLowerCase();
      if (!search) {
        await sendTelegramMessage(chatId, botToken, "Usage: /done <search term>");
        return NextResponse.json({ ok: true });
      }

      // Find matching item
      const { data: items } = await admin
        .from("tracker_items")
        .select("id, title")
        .eq("project_id", PROJECT_ID)
        .neq("status", "done")
        .neq("status", "future_phase")
        .ilike("title", `%${search}%`)
        .limit(1);

      if (!items || items.length === 0) {
        await sendTelegramMessage(chatId, botToken, `No matching item found for "${search}"`);
        return NextResponse.json({ ok: true });
      }

      const item = items[0];
      const { error } = await admin
        .from("tracker_items")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", item.id);

      if (error) {
        await sendTelegramMessage(chatId, botToken, `Failed to update: ${error.message}`);
      } else {
        await sendTelegramMessage(chatId, botToken, `✅ Done: *${item.title}*`);
      }
    } else if (command === "/due") {
      // /due — list items due today
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      const { data: items } = await admin
        .from("tracker_items")
        .select("title, assigned_to, priority, status")
        .eq("project_id", PROJECT_ID)
        .eq("due_date", today)
        .neq("status", "done")
        .neq("status", "future_phase")
        .order("priority", { ascending: true });

      if (!items || items.length === 0) {
        await sendTelegramMessage(chatId, botToken, "📭 Nothing due today!");
        return NextResponse.json({ ok: true });
      }

      const lines = items
        .map((i) => {
          const pe = PRIORITY_EMOJI[i.priority ?? "medium"] ?? "⚪";
          const se = STATUS_EMOJI[i.status ?? "pending"] ?? "⏳";
          return `${pe} ${se} ${i.title}${i.assigned_to ? ` — ${i.assigned_to}` : ""}`;
        })
        .join("\n");

      await sendTelegramMessage(
        chatId,
        botToken,
        `*Due Today (${items.length}):*\n\n${lines}`,
      );
    } else if (command === "/register") {
      // Register user's personal chat ID for DM notifications
      const fromUser = message.from;
      const username = fromUser?.username ?? "";
      const firstName = fromUser?.first_name ?? "";
      const displayName = firstName || username;

      if (!displayName) {
        await sendTelegramMessage(chatId, botToken, "Could not determine your name. Set a Telegram username first.");
        return NextResponse.json({ ok: true });
      }

      // Try to match by telegram_username or display_name
      const { data: users } = await admin
        .from("tracker_users")
        .select("id, display_name, telegram_username");

      const personalChatId = String(message.from?.id ?? chatId);

      // Match by username or display name (case-insensitive)
      const match = users?.find(
        (u) =>
          (u.telegram_username && u.telegram_username.toLowerCase() === username.toLowerCase()) ||
          u.display_name.toLowerCase() === displayName.toLowerCase(),
      );

      if (match) {
        await admin
          .from("tracker_users")
          .update({ telegram_chat_id: personalChatId, telegram_username: username || null })
          .eq("id", match.id);
        await sendTelegramMessage(chatId, botToken, `✅ Registered! You'll receive @mention notifications as *${match.display_name}*.`);
      } else {
        await sendTelegramMessage(
          chatId,
          botToken,
          `No tracker account found matching "${displayName}" or "@${username}". Ask the admin to set your telegram_username in your tracker profile.`,
        );
      }
    } else if (command === "/help") {
      const memberNames = Object.values(TEAM_MEMBERS).join(", ");
      await sendTelegramMessage(
        chatId,
        botToken,
        `*Work Tracker Bot Commands:*\n\n` +
        `/status — Summary of all items by status\n` +
        `/critical — List all critical-priority items\n` +
        `/done — Items completed today\n` +
        `/done <search> — Mark matching item as done\n` +
        `/due — Items due today\n` +
        `/add <title> — Quick add a new task\n` +
        `/<name> — List tasks assigned to a person (${memberNames})\n` +
        `/register — Register for @mention DM notifications\n` +
        `/help — Show this help`,
      );
    } else if (command.startsWith("/") && TEAM_MEMBERS[command.slice(1)]) {
      // Dynamic /<name> command — list tasks assigned to that person
      const memberName = TEAM_MEMBERS[command.slice(1)];

      const { data: items } = await admin
        .from("tracker_items")
        .select("title, status, priority")
        .eq("project_id", PROJECT_ID)
        .eq("assigned_to", memberName)
        .neq("status", "done")
        .neq("status", "future_phase")
        .order("priority", { ascending: true });

      if (!items || items.length === 0) {
        await sendTelegramMessage(chatId, botToken, `🎉 *${memberName}* has no open tasks!`);
        return NextResponse.json({ ok: true });
      }

      const lines = items
        .map((i) => {
          const pe = PRIORITY_EMOJI[i.priority ?? "medium"] ?? "⚪";
          const se = STATUS_EMOJI[i.status ?? "pending"] ?? "⏳";
          return `${pe} ${se} ${i.title}`;
        })
        .join("\n");

      await sendTelegramMessage(
        chatId,
        botToken,
        `*${memberName}'s Tasks (${items.length}):*\n\n${lines}`,
      );
    } else if (!text.startsWith("/")) {
      // Regular message (not a command) — store as chat message for web mirror
      const fromUser = message.from;
      const authorName = fromUser?.first_name ?? fromUser?.username ?? "Unknown";

      // Dedup check: skip if we already stored this telegram_message_id
      const telegramMessageId = message.message_id;
      if (telegramMessageId) {
        const { data: existing } = await admin
          .from("tracker_messages")
          .select("id")
          .eq("telegram_message_id", telegramMessageId)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({ ok: true }); // Already stored
        }
      }

      // Try to find matching tracker user
      const username = fromUser?.username ?? "";
      const { data: users } = await admin
        .from("tracker_users")
        .select("id, display_name, telegram_username");

      const matchedUser = users?.find(
        (u) =>
          (u.telegram_username && u.telegram_username.toLowerCase() === username.toLowerCase()) ||
          u.display_name.toLowerCase() === authorName.toLowerCase(),
      );

      await admin.from("tracker_messages").insert({
        project_id: PROJECT_ID,
        author: matchedUser?.display_name ?? authorName,
        author_id: matchedUser?.id ?? null,
        content: text,
        source: "telegram",
        telegram_message_id: telegramMessageId ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true }); // Always 200 for Telegram
  }
}
