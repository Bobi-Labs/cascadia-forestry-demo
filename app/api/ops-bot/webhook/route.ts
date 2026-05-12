import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  sendMessage,
  handlePending,
  handleOvertime,
  handleStatus,
  handleContacts,
  handleCompliance,
  handleProjects,
  handleDirections,
  handleFiles,
  generateMorningDigest,
  postAnnouncement,
  postSafetyAlert,
  sendInlineKeyboard,
  answerCallbackQuery,
  pinMessage,
  handleTimesheetPhoto,
  handleSickReport,
  isTimesheetCaption,
  sendPhotoCaptionTip,
  MENU_FOR_CHANNEL,
  OPS_PROJECT_IDS,
  type BotChannel,
} from "@/lib/ops-bots";

/**
 * Insert a TG-sourced message into tracker_messages so it shows up on
 * the dashboard Communications page. Dedups on telegram_message_id —
 * if TG retries the webhook, we don't double-insert.
 */
async function mirrorTGMessageToDashboard(
  channel: BotChannel,
  tgMessageId: number,
  authorName: string,
  content: string,
): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const sb = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const projectId = OPS_PROJECT_IDS[channel];

    // Dedup
    const { data: existing } = await sb
      .from("tracker_messages")
      .select("id")
      .eq("project_id", projectId)
      .eq("telegram_message_id", tgMessageId)
      .maybeSingle();
    if (existing) return;

    await sb.from("tracker_messages").insert({
      project_id: projectId,
      author: authorName,
      content,
      source: "telegram",
      telegram_message_id: tgMessageId,
    });
  } catch (err) {
    console.error("[ops-bot] mirror to dashboard failed:", err);
  }
}

/**
 * POST /api/ops-bot/webhook
 *
 * Unified webhook for all 3 operational TG bots.
 * Telegram sends updates here when users type commands in chat.
 * Routing is based on which bot token matches.
 */

const ADMIN_OFFICE_TOKEN = process.env.TG_ADMIN_OFFICE_BOT_TOKEN || "";
const FOREMAN_TOKEN      = process.env.TG_FOREMAN_BOT_TOKEN || "";
const UPDATES_TOKEN      = process.env.TG_UPDATES_BOT_TOKEN || "";
const WATERCOOLER_TOKEN  = process.env.TG_WATERCOOLER_BOT_TOKEN || "";

const ADMIN_OFFICE_CHAT = process.env.TG_ADMIN_OFFICE_CHAT_ID || "";
const FOREMAN_CHAT      = process.env.TG_FOREMAN_CHAT_ID || "";
const UPDATES_CHAT      = process.env.TG_UPDATES_CHAT_ID || "";
const WATERCOOLER_CHAT  = process.env.TG_WATERCOOLER_CHAT_ID || "";

function identifyChannel(chatId: string): BotChannel | null {
  const id = chatId.trim();
  if (id === ADMIN_OFFICE_CHAT.trim()) return "admin_office";
  if (id === FOREMAN_CHAT.trim())      return "foreman";
  if (id === UPDATES_CHAT.trim())      return "updates";
  if (id === WATERCOOLER_CHAT.trim() && WATERCOOLER_CHAT) return "watercooler";
  // Legacy fallback for tracker config chat ID
  if (id === "-1003185162489") return "admin_office";
  return null;
}

// Persistent reply keyboard buttons send literal strings as text messages
// (not commands). Map those strings back to slash commands here so the
// downstream switch doesn't need parallel handling. Keys are case-sensitive
// matches against the button labels in lib/ops-bots.ts → REPLY_KEYBOARD_FOR_CHANNEL.
const REPLY_BUTTON_TO_COMMAND: Record<string, string> = {
  // Foreman keyboard
  "Submit Timesheet": "/menu",  // opens the menu so they tap "Submit Timesheet Photo"
  "Report Sick":      "/sick",
  "My Projects":      "/projects",
  "Get Directions":   "/directions",
  // Admin/Office keyboard
  "Pending TS":       "/pending",
  "OT Monitor":       "/overtime",
  "Compliance":       "/compliance",
  "Morning Digest":   "/mywork",
};

function parseCommand(text: string): { cmd: string; args: string } {
  // Reply-keyboard button labels arrive as plain text — translate first.
  const buttonAlias = REPLY_BUTTON_TO_COMMAND[text.trim()];
  if (buttonAlias) return { cmd: buttonAlias, args: "" };

  // Handle /command@BotName format
  const clean = text.replace(/@\w+/, "").trim();
  const spaceIdx = clean.indexOf(" ");
  if (spaceIdx === -1) return { cmd: clean.toLowerCase(), args: "" };
  return {
    cmd: clean.slice(0, spaceIdx).toLowerCase(),
    args: clean.slice(spaceIdx + 1).trim(),
  };
}

/** True if a text message is recognizable as a command or persistent-keyboard tap. */
function looksLikeCommand(text: string): boolean {
  return text.startsWith("/") || REPLY_BUTTON_TO_COMMAND[text.trim()] !== undefined;
}

/** Send a reply directly to the chat that sent the message */
async function replyToChat(chatId: string, botToken: string, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
  } catch (err) {
    console.error("[ops-bot] Reply failed:", err);
  }
}

/** Determine which bot token to use based on channel */
function getBotTokenForChannel(ch: BotChannel): string {
  switch (ch) {
    case "admin_office": return ADMIN_OFFICE_TOKEN;
    case "foreman":      return FOREMAN_TOKEN;
    case "updates":      return UPDATES_TOKEN;
    case "watercooler":  return WATERCOOLER_TOKEN;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ─── Handle Callback Queries (inline button taps) ───────────────
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message?.chat?.id || "");
      const channel = identifyChannel(chatId);
      const botToken = getBotTokenForChannel(channel || "foreman");
      const data = cb.data || "";
      const user = cb.from;

      await answerCallbackQuery(botToken, cb.id);

      switch (data) {
        // ── Foreman menu callbacks ──
        case "menu_timesheet_photo":
          await replyToChat(chatId, botToken,
            "Send a photo of today's timesheet with caption starting <b><code>ts</code></b>.\n\n" +
            "Example: <i>ts 4/30 Kirk unit 12 — 8 hrs</i>\n\n" +
            "The office will be notified automatically.");
          break;
        case "menu_sick_report":
          await replyToChat(chatId, botToken,
            "Reply with the details:\n\n<b>Employee name</b> + what happened\n\nExample: <i>Carlos M. - injured hand on site, sent home</i>");
          break;
        case "menu_checkin":
          await replyToChat(chatId, botToken,
            `Daily check-in from ${user.first_name} received.`);
          await sendMessage("admin_office",
            `<b>Daily Check-In</b>\n${user.first_name} (@${user.username || "N/A"}) checked in.`);
          break;
        case "menu_projects": {
          const projects = await handleProjects();
          await replyToChat(chatId, botToken, projects);
          break;
        }
        case "menu_contacts":
          await replyToChat(chatId, botToken,
            "Type /contacts [name] to search.\n\nExample: <i>/contacts Adam</i>");
          break;
        case "menu_directions":
          await replyToChat(chatId, botToken,
            "Type /directions [unit name] to get a map link.\n\nExample: <i>/directions Clark Creek</i>");
          break;
        case "menu_files":
          await replyToChat(chatId, botToken,
            "Type /files [project name] to get the Drive link.\n\nExample: <i>/files Chilton</i>");
          break;

        // ── Admin/Office menu callbacks ──
        case "menu_pending":
          await replyToChat(chatId, botToken, await handlePending());
          break;
        case "menu_ot":
          await replyToChat(chatId, botToken, await handleOvertime());
          break;
        case "menu_compliance":
          await replyToChat(chatId, botToken, await handleCompliance());
          break;
        case "menu_mywork":
          await replyToChat(chatId, botToken, await generateMorningDigest());
          break;
        case "menu_status":
          await replyToChat(chatId, botToken,
            "Type /status [project name] for a snapshot.\n\nExample: <i>/status Chilton</i>");
          break;

        // ── Updates menu callbacks ──
        case "menu_announce_help":
          await replyToChat(chatId, botToken,
            "Type /announce [message] to post an announcement.\n\nExample: <i>/announce Office closed Friday</i>");
          break;
        case "menu_safety_help":
          await replyToChat(chatId, botToken,
            "Type /safety [message] to post a safety alert.\n\nExample: <i>/safety High wind warning Stevens County</i>");
          break;
      }
      return NextResponse.json({ ok: true });
    }

    // ─── Handle Photo Messages ──────────────────────────────────────
    // Photos in foreman chat are ONLY treated as timesheet submissions
    // if the caption starts with "ts" (case-insensitive). Without that
    // prefix the bot stays out of the way — the photo is just a regular
    // shared photo. First time we see an uncaptioned photo in foreman
    // chat we send a one-shot tip to teach the convention.
    //
    // Photos in other channels: ignored (no auto-handling).
    const message = body.message;
    if (message?.photo && message.photo.length > 0) {
      const chatId = String(message.chat.id);
      const channel = identifyChannel(chatId);
      if (channel === "foreman") {
        const botToken = getBotTokenForChannel("foreman");
        const photo = message.photo[message.photo.length - 1];
        if (isTimesheetCaption(message.caption)) {
          await handleTimesheetPhoto(
            chatId,
            botToken,
            message.from,
            photo.file_id,
            message.caption,
          );
        } else {
          // Not a timesheet. Just send the gentle tip; don't store anything.
          // Tip is per-message (TG dedups identical messages reasonably).
          await sendPhotoCaptionTip(chatId, botToken);
        }
      }
      // Mirror photos to the Communications page regardless of channel
      // (so dashboard users see the photo was shared, even if just a
      // job-site snap). Content shows the caption + a [photo] marker.
      if (channel) {
        const fromName = message.from.first_name || message.from.username || "TG user";
        const photoNote = message.caption
          ? `[photo] ${message.caption}`
          : "[photo]";
        await mirrorTGMessageToDashboard(channel, message.message_id, fromName, photoNote);
      }
      return NextResponse.json({ ok: true });
    }

    // ─── Handle Text Commands ───────────────────────────────────────
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const channel = identifyChannel(chatId);
    const effectiveChannel = channel || "admin_office";
    const botToken = getBotTokenForChannel(effectiveChannel);

    // Mirror plain-text (non-command) messages from any identified channel
    // into tracker_messages so they show up on the Communications page.
    // Commands and reply-keyboard taps are skipped — those are user→bot,
    // not real chatter. Bot's own replies bubble up via a separate path
    // (sendMessage now also mirrors when called for an ops channel —
    // see lib/ops-bots.ts).
    if (channel && !looksLikeCommand(message.text)) {
      const fromName = message.from.first_name || message.from.username || "TG user";
      await mirrorTGMessageToDashboard(channel, message.message_id, fromName, message.text);
    }

    // Check for sick report replies (non-command text in foreman channel)
    if (effectiveChannel === "foreman" && !looksLikeCommand(message.text)) {
      // Check if this looks like a sick/injury report (contains keywords)
      const lower = message.text.toLowerCase();
      if (lower.includes("sick") || lower.includes("injur") || lower.includes("hurt") || lower.includes("hospital") || lower.includes("sent home")) {
        await handleSickReport(chatId, botToken, message.from, message.text);
        return NextResponse.json({ ok: true });
      }
      // Otherwise ignore non-command messages (chatter already mirrored above)
      return NextResponse.json({ ok: true });
    }

    if (!looksLikeCommand(message.text)) {
      return NextResponse.json({ ok: true });
    }

    const { cmd, args } = parseCommand(message.text);
    let reply = "";

    // ─── /menu — per-channel button set ─────────────────────────────
    // Each chat gets its own menu buttons (foreman vs admin_office vs
    // updates vs watercooler). Used to be a single shared FOREMAN menu
    // that leaked into office + updates chats — fixed.
    if (cmd === "/menu" || cmd === "/m") {
      const menu = MENU_FOR_CHANNEL[effectiveChannel];
      if (!menu || menu.buttons.length === 0) {
        await replyToChat(chatId, botToken, menu?.text || "No menu actions in this channel.");
      } else {
        const msgId = await sendInlineKeyboard(chatId, botToken, menu.text, menu.buttons);
        // Pin only on foreman + admin_office where the menu is high-frequency.
        // Updates / watercooler aren't worth pinning. Persistent reply
        // keyboards (installed via setup script) are the primary anchor;
        // pinning is the backup.
        if (msgId && (effectiveChannel === "foreman" || effectiveChannel === "admin_office")) {
          await pinMessage(chatId, botToken, msgId);
        }
      }
      return NextResponse.json({ ok: true });
    }

    // ─── Admin/Office Commands ──────────────────────────────────────
    if (effectiveChannel === "admin_office") {
      switch (cmd) {
        case "/pending":
          reply = await handlePending();
          break;
        case "/overtime":
        case "/ot":
          reply = await handleOvertime();
          break;
        case "/status":
          reply = await handleStatus(args || undefined);
          break;
        case "/contacts":
        case "/contact":
          if (!args) { reply = "Usage: /contacts [name]"; break; }
          reply = await handleContacts(args);
          break;
        case "/compliance":
          reply = await handleCompliance();
          break;
        case "/mywork":
          reply = await generateMorningDigest();
          break;
        case "/help":
          reply =
            "<b>Admin/Office Commands</b>\n\n" +
            "/menu — Quick action buttons\n" +
            "/pending — Pending timesheets\n" +
            "/overtime — OT risk monitor\n" +
            "/status [project] — Project snapshot\n" +
            "/contacts [name] — Search contacts\n" +
            "/compliance — Compliance due this week\n" +
            "/mywork — Morning digest summary\n" +
            "/help — This message";
          break;
        default:
          reply = `Unknown command: ${cmd}\nType /help for available commands.`;
      }
    }

    // ─── Foreman Channel Commands ───────────────────────────────────
    if (effectiveChannel === "foreman") {
      switch (cmd) {
        case "/projects":
          reply = await handleProjects();
          break;
        case "/status":
          reply = await handleStatus(args || undefined);
          break;
        case "/directions":
        case "/dir":
          if (!args) { reply = "Usage: /directions [unit name]"; break; }
          reply = await handleDirections(args);
          break;
        case "/files":
          if (!args) { reply = "Usage: /files [project name]"; break; }
          reply = await handleFiles(args);
          break;
        case "/contacts":
        case "/contact":
          if (!args) { reply = "Usage: /contacts [name]"; break; }
          reply = await handleContacts(args);
          break;
        case "/sick":
        case "/report":
          if (!args) { reply = "Usage: /sick [employee name] - [details]\n\nExample: <i>/sick Carlos M. - injured hand, sent home</i>"; break; }
          await handleSickReport(chatId, botToken, message.from, args);
          return NextResponse.json({ ok: true });
        case "/help":
          reply =
            "<b>Foreman Commands</b>\n\n" +
            "/menu — Quick action buttons\n" +
            "/projects — Active projects list\n" +
            "/status [project] — Project snapshot\n" +
            "/directions [unit] — GPS / map link\n" +
            "/files [project] — Drive folder link\n" +
            "/contacts [name] — Search contacts\n" +
            "/sick [details] — Report sick/injured\n" +
            "/help — This message\n\n" +
            "<i>To submit a timesheet photo, send the photo with caption starting <code>ts</code>.</i>";
          break;
        default:
          reply = `Unknown command: ${cmd}\nType /help or /menu for options.`;
      }
    }

    // ─── Updates Channel Commands (admin-triggered) ─────────────────
    if (effectiveChannel === "updates") {
      switch (cmd) {
        case "/announce":
          if (!args) { reply = "Usage: /announce [message]"; break; }
          await postAnnouncement(args);
          return NextResponse.json({ ok: true });
        case "/safety":
          if (!args) { reply = "Usage: /safety [message]"; break; }
          await postSafetyAlert(args);
          return NextResponse.json({ ok: true });
        case "/help":
          reply =
            "<b>Updates Channel Commands</b>\n\n" +
            "/announce [message] — Post announcement\n" +
            "/safety [message] — Post safety alert\n" +
            "/help — This message";
          break;
        default:
          reply = `Unknown command: ${cmd}\nType /help for available commands.`;
      }
    }

    // ─── Watercooler Channel ────────────────────────────────────────
    // Casual chat. Bot ignores everything except /help so it doesn't
    // turn into noise. Messages still get mirrored to the dashboard
    // Communications page once TG-2 is live.
    if (effectiveChannel === "watercooler") {
      if (cmd === "/help") {
        reply =
          "<b>Watercooler</b>\n\n" +
          "Casual chat for the team. The bot stays out of the way here — " +
          "no commands beyond /help. Messages mirror to the dashboard's " +
          "Communications page so it's accessible from there too.";
      }
      // Other commands ignored (no "unknown command" reply — keep noise low).
    }

    if (reply) {
      await replyToChat(chatId, botToken, reply);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ops-bot] Webhook error:", err);
    return NextResponse.json({ ok: true }); // Always return 200 to TG
  }
}
