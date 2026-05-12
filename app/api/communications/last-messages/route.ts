/**
 * GET /api/communications/last-messages
 *
 * Returns the most-recent-message timestamp for each of the 4 reserved
 * ops project IDs. Lightweight endpoint the sidebar polls every 30s to
 * compute the unread badge on the Communications nav entry.
 *
 * Response shape:
 *   {
 *     "30000000-0000-0000-0000-000000000001": "2026-04-30T17:21:14.123+00:00" | null,
 *     ... (one entry per ops channel)
 *   }
 *
 * Null = no messages in that channel yet.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const OPS_PROJECT_IDS = [
  "30000000-0000-0000-0000-000000000001", // admin_office
  "30000000-0000-0000-0000-000000000002", // foreman
  "30000000-0000-0000-0000-000000000003", // updates
  "30000000-0000-0000-0000-000000000004", // watercooler
  "10000000-0000-0000-0000-000000000001", // bees_jaime (Site Build / Work Tracker bot)
];

export async function GET() {
  const admin = createAdminClient();

  const result: Record<string, string | null> = {};
  for (const id of OPS_PROJECT_IDS) {
    result[id] = null;
  }

  // Single query: last message per project_id. PostgREST doesn't have
  // a great "max group by" so we just pull the most recent row per
  // project via 4 quick queries in parallel. They're tiny (limit 1
  // each, indexed on (project_id, created_at)).
  const fetches = OPS_PROJECT_IDS.map(async (id) => {
    const { data } = await admin
      .from("tracker_messages")
      .select("created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { id, last: data?.created_at ?? null };
  });

  const settled = await Promise.all(fetches);
  for (const { id, last } of settled) {
    result[id] = last;
  }

  return NextResponse.json(result, {
    headers: {
      // Browsers + CDN can cache for a short window since we poll every 30s
      "Cache-Control": "private, max-age=10",
    },
  });
}
