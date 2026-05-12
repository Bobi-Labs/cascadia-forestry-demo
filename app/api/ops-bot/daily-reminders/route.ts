/**
 * GET /api/ops-bot/daily-reminders?board=<company|site_build>
 *
 * Daily tracker digest. Called by Vercel Cron — twice a day, once per
 * board (see vercel.json). Each call filters tracker_items to ONE
 * project_id and posts to the matching TG channel:
 *
 *   ?board=company    → tracker_projects "Company" board
 *                       (20000000-0000-0000-0000-000000000001)
 *                       → posts to admin_office TG
 *                       Items from this board are office staff
 *                       deliverables for the dashboard's Work Tracker.
 *
 *   ?board=site_build → tracker_projects "Site Build" board
 *                       (10000000-0000-0000-0000-000000000001)
 *                       → posts to updates TG
 *                       Items from this board are Bees+Jaime's
 *                       deliverables (the OUR tracker at /tracker).
 *
 * Why split: tracker_items is one table, partitioned by project_id.
 * The previous version pulled EVERY board's items and dumped them
 * into admin_office — so the office got a morning digest that
 * included Site Build items relevant to Bees+Jaime, not them.
 * Caught in the May 9 walkthrough.
 *
 * Two reminder types in one post (single message vs. spam):
 *   1. Tasks due today (tracker_items.due_date = today, status != done)
 *   2. Blocked items (status = blocked)
 *
 * On Mondays: also includes a "stale items" section for things that
 * have sat in `in_progress` for 7+ days without a completed_at.
 *
 * Auth: same Bearer token pattern as /api/tests/run. Vercel Cron sends
 * the CRON_SECRET automatically; manual runs need the header too.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { sendMessage, type BotChannel } from "@/lib/ops-bots";
import { sendTelegramMessage } from "@/lib/tracker/telegram";

export const runtime = "nodejs";

// Map a `?board=` param to a tracker_projects.id and a delivery method:
//
//   "ops" delivery     → posts via lib/ops-bots.sendMessage(channel)
//                        used for the company/office tracker → admin_office
//                        TG channel.
//   "tracker" delivery → posts via the per-project tracker_telegram_config
//                        row (Work Tracker bot, Bees+Jaime direct chat).
//                        used for Site Build — keeps internal dev reminders
//                        OUT of the public Ramos updates feed where they
//                        landed before this fix.
//
// Hardcoded project IDs match components/pages/work-tracker.tsx +
// components/tracker/. Adding a new board = adding a row here.
type BoardConfig =
  | { delivery: "ops"; projectId: string; channel: BotChannel; label: string }
  | { delivery: "tracker"; projectId: string; label: string };

const BOARD_CONFIG: Record<string, BoardConfig> = {
  company: {
    delivery: "ops",
    projectId: "20000000-0000-0000-0000-000000000001",
    channel: "admin_office",
    label: "Company / Office",
  },
  site_build: {
    delivery: "tracker",
    projectId: "10000000-0000-0000-0000-000000000001",
    label: "Site Build",
  },
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || authHeader !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  // Default to "company" so legacy callers (existing cron schedules,
  // bookmarked manual runs) keep doing what they did before — but now
  // CORRECTLY filtered. The new site_build cron in vercel.json passes
  // ?board=site_build explicitly.
  const boardKey = (req.nextUrl.searchParams.get("board") ?? "company") as keyof typeof BOARD_CONFIG;
  const config = BOARD_CONFIG[boardKey];
  if (!config) {
    return NextResponse.json(
      { ok: false, error: `Unknown board "${boardKey}". Known: ${Object.keys(BOARD_CONFIG).join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const today = new Date().toISOString().split("T")[0];
  const dow = new Date().getUTCDay(); // 0=Sun, 1=Mon, ...
  const isMonday = dow === 1;

  // ─── Tasks due today OR overdue ──────────────────────────────────
  // .eq("project_id", config.projectId) scopes each digest to its
  // own board — without this every digest pulled from every board's
  // items and dumped them into the wrong channel.
  //
  // 2026-05-14 fix: `due_date <= today` (was exact-match `=`). The
  // old version silently dropped overdue items the day after they
  // were due — they'd ping once, get skipped from then on. Now
  // overdue items keep showing until marked done.
  const { data: dueToday } = await supabase
    .from("tracker_items")
    .select("title, assigned_to, priority, due_date")
    .eq("project_id", config.projectId)
    .lte("due_date", today)
    .neq("status", "done")
    .order("priority", { ascending: false })
    .limit(20);

  // ─── High-priority active items without a due_date ───────────────
  // Caught on the May 14 cleanup: items marked priority='high' but
  // with no due_date set never appeared in the daily digest. That's
  // exactly the bucket of items that SHOULD be pinging (it's high
  // priority — by definition urgent). Pull them too, deduped against
  // dueToday so we don't double-list anything.
  const dueIds = new Set((dueToday ?? []).map((d) => d.title));
  const { data: highPriRaw } = await supabase
    .from("tracker_items")
    .select("title, assigned_to")
    .eq("project_id", config.projectId)
    .eq("priority", "high")
    .not("status", "in", "(done,blocked)")
    .is("due_date", null)
    .order("created_at", { ascending: false })
    .limit(15);
  const highPri = (highPriRaw ?? []).filter((h) => !dueIds.has(h.title));

  // ─── Blocked items ───────────────────────────────────────────────
  const { data: blocked } = await supabase
    .from("tracker_items")
    .select("title, assigned_to")
    .eq("project_id", config.projectId)
    .eq("status", "blocked")
    .order("created_at", { ascending: false })
    .limit(10);

  // ─── Stale in-progress (Mondays only) ────────────────────────────
  let stale: { title: string; assigned_to: string | null }[] = [];
  if (isMonday) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const { data } = await supabase
      .from("tracker_items")
      .select("title, assigned_to, updated_at")
      .eq("project_id", config.projectId)
      .eq("status", "in_progress")
      .lt("updated_at", sevenDaysAgo.toISOString())
      .order("updated_at", { ascending: true })
      .limit(10);
    stale = (data ?? []) as { title: string; assigned_to: string | null }[];
  }

  // Skip the post entirely if everything's quiet — avoids the empty
  // "you have 0 things to do" noise that trains people to ignore the bot.
  const totalItems =
    (dueToday?.length ?? 0) + highPri.length + (blocked?.length ?? 0) + stale.length;
  if (totalItems === 0) {
    return NextResponse.json({ ok: true, posted: false, board: boardKey, reason: "nothing to report" });
  }

  // ─── Build message ───────────────────────────────────────────────
  // Header includes the board label so when both digests fire on the
  // same morning it's clear which is which (e.g. "Daily Reminders —
  // Site Build" vs "Daily Reminders — Company / Office").
  const lines: string[] = [`<b>Daily Reminders — ${config.label}</b>`];

  if (dueToday && dueToday.length > 0) {
    // Split overdue vs due-today for clearer urgency signalling.
    const overdue = dueToday.filter((i) => i.due_date && i.due_date < today);
    const dueExactlyToday = dueToday.filter((i) => i.due_date === today);
    if (overdue.length > 0) {
      lines.push("");
      lines.push(`<b>Overdue (${overdue.length})</b>`);
      for (const item of overdue) {
        const owner = item.assigned_to ? ` — ${item.assigned_to}` : "";
        const flag = item.priority === "high" ? " 🔴" : "";
        lines.push(`  • ${item.title}${owner}${flag}  <i>(was due ${item.due_date})</i>`);
      }
    }
    if (dueExactlyToday.length > 0) {
      lines.push("");
      lines.push(`<b>Due today (${dueExactlyToday.length})</b>`);
      for (const item of dueExactlyToday) {
        const owner = item.assigned_to ? ` — ${item.assigned_to}` : "";
        const flag = item.priority === "high" ? " 🔴" : "";
        lines.push(`  • ${item.title}${owner}${flag}`);
      }
    }
  }

  if (highPri.length > 0) {
    lines.push("");
    lines.push(`<b>High priority — no due date set (${highPri.length})</b>`);
    for (const item of highPri) {
      const owner = item.assigned_to ? ` — ${item.assigned_to}` : "";
      lines.push(`  • ${item.title}${owner} 🔴`);
    }
  }

  if (blocked && blocked.length > 0) {
    lines.push("");
    lines.push(`<b>Blocked (${blocked.length})</b>`);
    for (const item of blocked) {
      const owner = item.assigned_to ? ` — ${item.assigned_to}` : "";
      lines.push(`  • ${item.title}${owner}`);
    }
  }

  if (stale.length > 0) {
    lines.push("");
    lines.push(`<b>Stale in-progress (${stale.length}, 7+ days)</b>`);
    for (const item of stale) {
      const owner = item.assigned_to ? ` — ${item.assigned_to}` : "";
      lines.push(`  • ${item.title}${owner}`);
    }
  }

  const text = lines.join("\n");

  let ok = false;
  let destination = "";
  if (config.delivery === "ops") {
    ok = await sendMessage(config.channel, text, "HTML");
    destination = `ops:${config.channel}`;
  } else {
    // Site Build → look up the project's tracker_telegram_config row
    // and post via the Work Tracker bot. Falls back to admin_office if
    // the tracker config is missing (so we never silently drop a
    // reminder).
    const { data: tgConfig } = await supabase
      .from("tracker_telegram_config")
      .select("chat_id, bot_token")
      .eq("project_id", config.projectId)
      .maybeSingle();
    if (tgConfig?.chat_id && tgConfig?.bot_token) {
      // Strip HTML — sendTelegramMessage doesn't pass parse_mode so the
      // <b>…</b> tags would render literally. Quick replace keeps it
      // readable.
      const plainText = text.replace(/<\/?b>/g, "");
      ok = await sendTelegramMessage(tgConfig.chat_id, tgConfig.bot_token, plainText);
      destination = "tracker:site_build";
    } else {
      ok = await sendMessage("admin_office", text, "HTML");
      destination = "ops:admin_office (fallback — tracker_telegram_config missing for site_build)";
    }
  }

  return NextResponse.json({ ok, posted: ok, board: boardKey, destination, lines: lines.length, totalItems });
}
