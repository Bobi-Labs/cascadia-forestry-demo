/**
 * Operational Telegram bots for Cascadia & Ramos.
 *
 * Four channels:
 *   1. Admin/Office — internal ops, task reminders, timesheet notifications
 *   2. Foreman      — field ↔ office, photo timesheet uploads, sick reports
 *   3. Updates      — announcements, weather, safety alerts (low-traffic)
 *   4. Watercooler  — casual chatter (separate from ops to keep noise out)
 *
 * Bot tokens and chat IDs are in env vars. Server-side only.
 *
 * Each channel has:
 *   - its own bot (token + chat_id)
 *   - its own slash-command menu via setMyCommands (always-visible four-dot
 *     icon next to the input)
 *   - a per-channel inline /menu (different button sets per chat — no
 *     cross-leak; the foreman menu used to leak into office + updates)
 *   - foreman + admin_office also get a persistent reply keyboard
 *     (is_persistent: true buttons that sit under the input forever)
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// ─── Config ──────────────────────────────────────────────────────────────────

export type BotChannel = "admin_office" | "foreman" | "updates" | "watercooler";

export const ALL_CHANNELS: BotChannel[] = [
  "admin_office",
  "foreman",
  "updates",
  "watercooler",
];

/**
 * Reserved tracker_projects IDs for the 4 ops channels. Seeded by
 * migration 20260430010000_ops_chat_projects.sql with scope='ops'.
 *
 * Used by:
 *   - the ops bot webhook to tag inbound TG messages with the right
 *     project_id when inserting into tracker_messages
 *   - the new Communications page to query messages per channel
 *   - the dashboard send-to-TG path to pick the right bot when an
 *     outbound message hits one of these reserved project IDs
 */
export const OPS_PROJECT_IDS: Record<BotChannel, string> = {
  admin_office: "30000000-0000-0000-0000-000000000001",
  foreman:      "30000000-0000-0000-0000-000000000002",
  updates:      "30000000-0000-0000-0000-000000000003",
  watercooler:  "30000000-0000-0000-0000-000000000004",
};

/** Reverse lookup — useful for the send-to-TG path. */
export function channelForOpsProjectId(projectId: string): BotChannel | null {
  for (const [channel, id] of Object.entries(OPS_PROJECT_IDS) as [BotChannel, string][]) {
    if (id === projectId) return channel;
  }
  return null;
}

export function getConfig(channel: BotChannel) {
  switch (channel) {
    case "admin_office":
      return {
        token: process.env.TG_ADMIN_OFFICE_BOT_TOKEN || "",
        chatId: process.env.TG_ADMIN_OFFICE_CHAT_ID || "",
      };
    case "foreman":
      return {
        token: process.env.TG_FOREMAN_BOT_TOKEN || "",
        chatId: process.env.TG_FOREMAN_CHAT_ID || "",
      };
    case "updates":
      return {
        token: process.env.TG_UPDATES_BOT_TOKEN || "",
        chatId: process.env.TG_UPDATES_CHAT_ID || "",
      };
    case "watercooler":
      // Will stay dark until the env vars are populated. The bot itself
      // exists in TG (Bees creates it via @BotFather) but the chat_id
      // only resolves once Bees creates the group + adds the bot + sends
      // a message there. Until then, sendMessage("watercooler") is a no-op.
      return {
        token: process.env.TG_WATERCOOLER_BOT_TOKEN || "",
        chatId: process.env.TG_WATERCOOLER_CHAT_ID || "",
      };
  }
}

// ─── Core Send ───────────────────────────────────────────────────────────────

export async function sendMessage(
  channel: BotChannel,
  text: string,
  parseMode: "HTML" | "Markdown" | undefined = "HTML",
): Promise<boolean> {
  const { token, chatId } = getConfig(channel);
  if (!token || !chatId) {
    console.warn(`[ops-bot] Missing config for channel: ${channel}`);
    return false;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      },
    );
    const data = await res.json();
    if (!data.ok) {
      console.error(`[ops-bot] Send failed (${channel}):`, data.description);
      return false;
    }
    // Mirror to the Communications page so dashboard users see the
    // outbound bot message too (cron alerts, command responses, etc.).
    // Best-effort — failure here doesn't fail the TG send.
    const tgMessageId = data.result?.message_id ?? null;
    if (tgMessageId) {
      mirrorOutboundToDashboard(channel, tgMessageId, text).catch(() => {});
    }
    return true;
  } catch (err) {
    console.error(`[ops-bot] Send error (${channel}):`, err);
    return false;
  }
}

/**
 * Mirror a bot-originated message (cron alert, command response, etc.)
 * to tracker_messages so it surfaces on the Communications page.
 *
 * Strips HTML tags from the body for display — TG renders the HTML, but
 * the dashboard renders plaintext. Cheaper than parsing entities.
 */
async function mirrorOutboundToDashboard(
  channel: BotChannel,
  tgMessageId: number,
  htmlText: string,
): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const sb = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const projectId = OPS_PROJECT_IDS[channel];
    const plain = htmlText.replace(/<[^>]+>/g, "").trim();
    await sb.from("tracker_messages").insert({
      project_id: projectId,
      author: "Bot",
      content: plain,
      source: "telegram",
      telegram_message_id: tgMessageId,
    });
  } catch {
    // swallow — outbound mirror is best-effort
  }
}

// ─── Inline Keyboard ─────────────────────────────────────────────────────────

type InlineButton = { text: string; callback_data: string };

export async function sendInlineKeyboard(
  chatId: string,
  botToken: string,
  text: string,
  buttons: InlineButton[][],
): Promise<number | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      }),
    });
    const data = await res.json();
    return data.ok ? data.result.message_id : null;
  } catch {
    return null;
  }
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {});
}

export async function pinMessage(
  chatId: string,
  botToken: string,
  messageId: number,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/pinChatMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, disable_notification: true }),
  }).catch(() => {});
}

// ─── Per-Channel Menus ───────────────────────────────────────────────────────
//
// Each channel has its own menu text + button set. /menu in foreman renders
// foreman buttons; /menu in admin_office renders office buttons; etc. This
// fixes the cross-leak bug where /menu in any chat used to render foreman
// buttons (Submit Timesheet Photo etc.) regardless of channel.

interface ChannelMenu {
  text: string;
  buttons: InlineButton[][];
}

export const MENU_FOR_CHANNEL: Record<BotChannel, ChannelMenu> = {
  foreman: {
    text:
      "<b>Foreman Quick Actions</b>\n\n" +
      "Tap a button — or type a command from the slash menu (top-left icon).",
    buttons: [
      [
        { text: "Submit Timesheet Photo", callback_data: "menu_timesheet_photo" },
      ],
      [
        { text: "Report Sick / Injured", callback_data: "menu_sick_report" },
        { text: "Daily Check-In",        callback_data: "menu_checkin" },
      ],
      [
        { text: "My Projects",  callback_data: "menu_projects" },
        { text: "Find Contact", callback_data: "menu_contacts" },
      ],
      [
        { text: "Get Directions", callback_data: "menu_directions" },
        { text: "Project Files",  callback_data: "menu_files" },
      ],
    ],
  },
  admin_office: {
    text:
      "<b>Admin / Office Quick Actions</b>\n\n" +
      "Tap a button — or type a command from the slash menu (top-left icon).",
    buttons: [
      [
        { text: "Pending Timesheets", callback_data: "menu_pending" },
        { text: "OT Risk Monitor",    callback_data: "menu_ot" },
      ],
      [
        { text: "Compliance Due",  callback_data: "menu_compliance" },
        { text: "Morning Digest",  callback_data: "menu_mywork" },
      ],
      [
        { text: "Find Contact", callback_data: "menu_contacts" },
        { text: "Project Status", callback_data: "menu_status" },
      ],
    ],
  },
  updates: {
    text:
      "<b>Updates Channel</b>\n\n" +
      "This channel is for safety alerts + announcements only. " +
      "Use the slash menu (top-left icon) for /announce or /safety.",
    buttons: [
      [
        { text: "Post Announcement", callback_data: "menu_announce_help" },
        { text: "Post Safety Alert", callback_data: "menu_safety_help" },
      ],
    ],
  },
  watercooler: {
    text:
      "<b>Watercooler</b>\n\n" +
      "Casual chat for the team. No menu actions — just talk.",
    buttons: [],
  },
};

// ─── Slash Command Menus (always-visible four-dot icon) ──────────────────────
//
// `setMyCommands` registers a list of bot commands that show up when the
// user taps the menu icon (four dots) next to the text input. Per-channel
// scope = different command lists per chat. Run via the one-time setup
// script `scripts/setup-bot-commands.mjs` after deploying or rotating bots.

interface SlashCommand { command: string; description: string; }

export const COMMANDS_FOR_CHANNEL: Record<BotChannel, SlashCommand[]> = {
  foreman: [
    { command: "menu",       description: "Quick action buttons" },
    { command: "projects",   description: "Active projects list" },
    { command: "status",     description: "Project snapshot" },
    { command: "directions", description: "Get GPS / map link for a unit" },
    { command: "files",      description: "Drive folder link for a project" },
    { command: "contacts",   description: "Search contract contacts" },
    { command: "sick",       description: "Report sick or injured crew" },
    { command: "help",       description: "Show all commands" },
  ],
  admin_office: [
    { command: "menu",       description: "Quick action buttons" },
    { command: "pending",    description: "Pending timesheets" },
    { command: "overtime",   description: "OT risk monitor" },
    { command: "status",     description: "Project snapshot" },
    { command: "contacts",   description: "Search contract contacts" },
    { command: "compliance", description: "Compliance items due" },
    { command: "mywork",     description: "Morning digest summary" },
    { command: "help",       description: "Show all commands" },
  ],
  updates: [
    { command: "announce",   description: "Post announcement" },
    { command: "safety",     description: "Post safety alert" },
    { command: "help",       description: "Show all commands" },
  ],
  watercooler: [
    { command: "help",       description: "Show what this channel is for" },
  ],
};

/**
 * Set the slash-command menu for one bot. Idempotent — calling repeatedly
 * just overwrites. Used by scripts/setup-bot-commands.mjs.
 */
export async function setMyCommands(
  botToken: string,
  commands: SlashCommand[],
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch {
    return false;
  }
}

// (Persistent reply keyboards removed — TG dismisses them in groups
// the moment any other user sends a message, so they were a broken
// promise. The persistent menu in groups is the slash-command menu
// installed via setMyCommands. See scripts/setup-bot-commands.mjs.)

// ─── Photo / Report Handlers ─────────────────────────────────────────────────

export async function handleTimesheetPhoto(
  chatId: string,
  botToken: string,
  fromUser: { id: number; first_name: string; username?: string },
  photoFileId: string,
  caption?: string,
): Promise<void> {
  const sb = getAdminClient();

  // Download the photo URL from Telegram
  const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photoFileId}`);
  const fileData = await fileRes.json();
  const filePath = fileData.result?.file_path || "";
  const photoUrl = filePath ? `https://api.telegram.org/file/bot${botToken}/${filePath}` : "";

  // Store in DB
  await sb.from("timesheet_photos" as never).insert({
    telegram_user_id: String(fromUser.id),
    telegram_username: fromUser.username || fromUser.first_name,
    photo_file_id: photoFileId,
    photo_url: photoUrl,
    caption: caption || null,
    status: "pending",
  } as never).then(() => {});

  // Confirm to foreman
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `Timesheet photo received from ${fromUser.first_name}. The office has been notified.`,
      parse_mode: "HTML",
    }),
  }).catch(() => {});

  // Notify admin/office
  await sendMessage(
    "admin_office",
    `<b>Timesheet Photo Submitted</b>\n${fromUser.first_name} (@${fromUser.username || "N/A"}) sent a timesheet photo.\n${caption ? `Note: ${caption}` : ""}`,
  );
}

/**
 * Test whether a photo caption marks it as a timesheet submission.
 * Convention: caption must start with `ts` (case-insensitive), optionally
 * followed by a space + extra notes.
 *
 *   "ts"                 → yes
 *   "ts 4/30 Kirk 8hrs"  → yes
 *   "TS - back from job" → yes
 *   "tsa"                → no (must be `ts` as a token)
 *   ""                   → no
 *   "look at this!"      → no
 */
export function isTimesheetCaption(caption: string | undefined | null): boolean {
  if (!caption) return false;
  const trimmed = caption.trim().toLowerCase();
  if (trimmed === "ts") return true;
  return /^ts[\s:.-]/.test(trimmed);
}

/**
 * One-shot tip sent the first time a foreman sends a photo without a `ts`
 * caption. Helps train the convention without nagging on every photo.
 *
 * The "first time" tracking happens at call-site (webhook). This helper
 * just sends the tip — it's deliberately gentle so foremen don't feel
 * scolded for sharing a job-site photo.
 */
export async function sendPhotoCaptionTip(
  chatId: string,
  botToken: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text:
        "Got your photo. <b>Tip:</b> if this was a timesheet, " +
        "add <code>ts</code> at the start of the caption next time " +
        "(e.g. <i>ts 4/30 Kirk unit 12 — 8 hrs</i>) so we log it for review.",
      parse_mode: "HTML",
    }),
  }).catch(() => {});
}

export async function handleSickReport(
  chatId: string,
  botToken: string,
  fromUser: { id: number; first_name: string; username?: string },
  details: string,
): Promise<void> {
  // Notify admin/office
  await sendMessage(
    "admin_office",
    `<b>Sick/Injury Report</b>\n${fromUser.first_name} (@${fromUser.username || "N/A"}) reports:\n${details}`,
  );

  // Also post to updates channel for visibility
  await sendMessage(
    "updates",
    `<b>Crew Alert</b>\n${fromUser.first_name} reported sick/injured. Office has been notified.`,
  );

  // Confirm to foreman
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `Report received. The office and admin have been notified. Take care of your crew.`,
    }),
  }).catch(() => {});
}

// ─── DB Helper ───────────────────────────────────────────────────────────────

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Command Handlers ────────────────────────────────────────────────────────

export async function handlePending(): Promise<string> {
  const sb = getAdminClient();
  const { data } = await sb
    .from("timesheets")
    .select("id, date, foreman_id, employees(first_name, last_name)")
    .in("status", ["submitted", "pending_approval"])
    .order("date", { ascending: false })
    .limit(20);

  if (!data || data.length === 0) return "All caught up! No pending timesheets.";

  const lines = data.map((t: Record<string, unknown>) => {
    const emp = t.employees as Record<string, string> | null;
    const name = emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "Unknown";
    return `  - ${name} (${t.date})`;
  });
  return `<b>Pending Timesheets (${data.length})</b>\n${lines.join("\n")}`;
}

export async function handleOvertime(): Promise<string> {
  const sb = getAdminClient();
  // Get current week boundaries
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const { data } = await sb
    .from("timesheet_entries")
    .select("employee_id, hours_worked, employees(first_name, last_name)")
    .gte("created_at", monday.toISOString())
    .lte("created_at", sunday.toISOString());

  if (!data || data.length === 0) return "No timesheet data for this week yet.";

  // Aggregate hours per employee
  const hoursByEmp = new Map<string, { name: string; hours: number }>();
  for (const entry of data as Array<Record<string, unknown>>) {
    const id = entry.employee_id as string;
    const emp = entry.employees as Record<string, string> | null;
    const name = emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "Unknown";
    const existing = hoursByEmp.get(id) || { name, hours: 0 };
    existing.hours += Number(entry.hours_worked) || 0;
    hoursByEmp.set(id, existing);
  }

  const overThreshold = Array.from(hoursByEmp.values())
    .filter((e) => e.hours >= 35)
    .sort((a, b) => b.hours - a.hours);

  if (overThreshold.length === 0) return "No OT risks this week. Everyone under 35hrs.";

  const lines = overThreshold.map((e) => {
    const icon = e.hours >= 40 ? "🔴" : "🟡";
    return `  ${icon} ${e.name}: ${e.hours.toFixed(1)}hrs`;
  });
  return `<b>OT Monitor</b>\n${lines.join("\n")}`;
}

export async function handleStatus(projectName?: string): Promise<string> {
  const sb = getAdminClient();
  let query = sb
    .from("contracts")
    .select("id, name, status, location, landowner")
    .in("status", ["active", "open"])
    .order("name");

  if (projectName) {
    query = query.ilike("name", `%${projectName}%`);
  }

  const { data: contracts } = await query.limit(10);
  if (!contracts || contracts.length === 0) {
    return projectName ? `No active projects matching "${projectName}".` : "No active projects.";
  }

  const { data: units } = await sb.from("units").select("id, contract_id, status");

  const lines = contracts.map((c) => {
    const cUnits = (units || []).filter((u) => u.contract_id === c.id);
    const completed = cUnits.filter((u) => u.status === "completed").length;
    const total = cUnits.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const bar = total > 0 ? `${completed}/${total} units (${pct}%)` : "No units";
    return `<b>${c.name}</b>\n  ${c.landowner || ""} ${c.location ? "- " + c.location : ""}\n  ${bar}`;
  });

  return lines.join("\n\n");
}

export async function handleContacts(searchName: string): Promise<string> {
  const sb = getAdminClient();
  const { data } = await sb
    .from("contract_contacts")
    .select("name, title, phone, email, contract_id")
    .is("deleted_at", null)
    .ilike("name", `%${searchName}%`)
    .limit(5);

  if (!data || data.length === 0) return `No contacts matching "${searchName}".`;

  const { data: contracts } = await sb.from("contracts").select("id, name");
  const cMap = new Map((contracts || []).map((c) => [c.id, c.name]));

  const lines = data.map((c) => {
    const project = c.contract_id ? cMap.get(c.contract_id) || "" : "Misc";
    let line = `<b>${c.name}</b>`;
    if (c.title) line += ` - ${c.title}`;
    line += `\n  Project: ${project}`;
    if (c.phone) line += `\n  Phone: ${c.phone}`;
    if (c.email) line += `\n  Email: ${c.email}`;
    return line;
  });

  return lines.join("\n\n");
}

export async function handleCompliance(): Promise<string> {
  const sb = getAdminClient();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const { data } = await sb
    .from("compliance_items")
    .select("title, due_date, status")
    .lte("due_date", nextWeek.toISOString().split("T")[0])
    .neq("status", "completed")
    .order("due_date");

  if (!data || data.length === 0) return "No compliance items due in the next 7 days.";

  const lines = data.map((item) => {
    const due = new Date(item.due_date + "T00:00:00");
    const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
    const icon = daysLeft <= 2 ? "🔴" : daysLeft <= 5 ? "🟡" : "🟢";
    return `  ${icon} ${item.title} — due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${daysLeft}d)`;
  });

  return `<b>Compliance Due (Next 7 Days)</b>\n${lines.join("\n")}`;
}

export async function handleProjects(): Promise<string> {
  const sb = getAdminClient();
  const { data: contracts } = await sb
    .from("contracts")
    .select("id, name, status, landowner, work_types")
    .in("status", ["active", "open"])
    .order("name");

  if (!contracts || contracts.length === 0) return "No active projects.";

  const { data: units } = await sb.from("units").select("contract_id, status");

  const lines = contracts.map((c) => {
    const cUnits = (units || []).filter((u) => u.contract_id === c.id);
    const inProg = cUnits.filter((u) => u.status === "in_progress").length;
    const completed = cUnits.filter((u) => u.status === "completed").length;
    const total = cUnits.length;
    const status = inProg > 0 ? `${inProg} in progress` : `${completed}/${total} done`;
    const types = Array.isArray(c.work_types) ? (c.work_types as string[]).join(", ") : "";
    return `<b>${c.name}</b> — ${c.landowner || ""}${types ? ` (${types})` : ""}\n  ${status}`;
  });

  return `<b>Active Projects (${contracts.length})</b>\n\n${lines.join("\n\n")}`;
}

export async function handleDirections(unitName: string): Promise<string> {
  const sb = getAdminClient();
  const { data } = await sb
    .from("units")
    .select("name, latitude, longitude, township_range")
    .ilike("name", `%${unitName}%`)
    .limit(3);

  if (!data || data.length === 0) return `No units matching "${unitName}".`;

  const lines = data.map((u) => {
    if (u.latitude && u.longitude) {
      return `<b>${u.name}</b>\nhttps://maps.google.com/?q=${u.latitude},${u.longitude}`;
    }
    return `<b>${u.name}</b>\n  ${u.township_range || "No GPS data"}`;
  });

  return lines.join("\n\n");
}

export async function handleFiles(projectName: string): Promise<string> {
  const sb = getAdminClient();
  const { data } = await sb
    .from("contracts")
    .select("name, drive_folder_everyone_id")
    .ilike("name", `%${projectName}%`)
    .limit(3);

  if (!data || data.length === 0) return `No projects matching "${projectName}".`;

  const lines = data.map((c) => {
    if (c.drive_folder_everyone_id) {
      return `<b>${c.name}</b>\nhttps://drive.google.com/drive/folders/${c.drive_folder_everyone_id}`;
    }
    return `<b>${c.name}</b> — No Drive folder linked`;
  });

  return lines.join("\n\n");
}

// ─── Morning Digest ──────────────────────────────────────────────────────────

export async function generateMorningDigest(): Promise<string> {
  const sb = getAdminClient();

  const [timesheets, compliance, contracts] = await Promise.all([
    sb.from("timesheets").select("id").in("status", ["submitted", "pending_approval"]),
    sb.from("compliance_items").select("id").lte("due_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]).neq("status", "completed"),
    sb.from("contracts").select("id").in("status", ["active", "open"]),
  ]);

  const pendingCount = timesheets.data?.length || 0;
  const complianceCount = compliance.data?.length || 0;
  const activeProjects = contracts.data?.length || 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  let msg = `<b>Good morning! ${dateStr}</b>\n\n`;
  msg += `<b>${activeProjects}</b> active projects\n`;
  msg += pendingCount > 0
    ? `<b>${pendingCount}</b> pending timesheets — review needed\n`
    : "All timesheets caught up\n";
  msg += complianceCount > 0
    ? `<b>${complianceCount}</b> compliance items due this week\n`
    : "No compliance deadlines this week\n";

  return msg;
}

// ─── Notification Helpers ────────────────────────────────────────────────────

export async function notifyTimesheetSubmitted(
  foremanName: string,
  projectName: string,
  crewCount: number,
  avgHours: number,
): Promise<void> {
  const msg = `<b>Timesheet Submitted</b>\n${foremanName} submitted for <b>${projectName}</b>\n${crewCount} crew, ${avgHours.toFixed(1)}hrs avg`;
  await sendMessage("admin_office", msg);
}

export async function notifyOTRisk(
  employeeName: string,
  currentHours: number,
): Promise<void> {
  const icon = currentHours >= 40 ? "🔴" : "🟡";
  const msg = `${icon} <b>OT Alert:</b> ${employeeName} is at <b>${currentHours.toFixed(1)}hrs</b> this week`;
  await sendMessage("admin_office", msg);
}

export async function notifyFavoriteAdded(
  foremanName: string,
  projectName: string,
): Promise<void> {
  await sendMessage("admin_office", `${foremanName} added <b>${projectName}</b> to favorites`);
}

export async function notifyMeetingScheduled(
  description: string,
  dateTime: string,
): Promise<void> {
  await sendMessage("foreman", `<b>Meeting Scheduled</b>\n${description}\n${dateTime}`);
  await sendMessage("updates", `<b>Meeting Scheduled</b>\n${description}\n${dateTime}`);
}

export async function postAnnouncement(message: string): Promise<void> {
  await sendMessage("updates", `<b>Announcement</b>\n\n${message}`);
}

export async function postSafetyAlert(message: string): Promise<void> {
  await sendMessage("updates", `<b>Safety Alert</b>\n\n${message}`);
}
