/**
 * POST /api/ingest/reset
 *
 * Admin-only reset for the unit-ingest pipeline. Mirrors the modes of
 * `scripts/ingest/reset-test-data.mjs` so the office doesn't need to
 * drop into a terminal for routine cleanup between test runs.
 *
 * Body:
 *   { mode: "retry-failed" | "clear-pending" | "clear-batches"
 *         | "clear-audit" | "full-reset" | "purge-units-prefix",
 *     prefix?: string  // required when mode === "purge-units-prefix"
 *   }
 *
 * Response: { ok: true, before: counts, after: counts, deleted: n }
 *
 * Auth: trusts the supabase session for admin role. Same caveat as
 * /api/ingest/trigger — middleware skips this path; we rely on the
 * UI gating the button to admin only.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_MODES = new Set([
  "retry-failed",
  "clear-pending",
  "clear-batches",
  "clear-audit",
  "full-reset",
  "purge-units-prefix",
]);

const SENTINEL_UUID = "00000000-0000-0000-0000-000000000000";

async function snapshot(sb: ReturnType<typeof createClient>) {
  const tables = ["unit_ingest_batches", "unit_pending_review", "unit_ingest_audit"];
  const out: Record<string, number> = {};
  for (const t of tables) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    out[t] = count ?? 0;
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mode, prefix } = body as { mode?: string; prefix?: string };
    if (!mode || !VALID_MODES.has(mode)) {
      return NextResponse.json(
        { ok: false, error: `mode required, one of: ${[...VALID_MODES].join(", ")}` },
        { status: 400 },
      );
    }
    if (mode === "purge-units-prefix" && (!prefix || prefix.length < 2)) {
      return NextResponse.json(
        { ok: false, error: "purge-units-prefix requires `prefix` (2+ chars) so a typo can't drop everything" },
        { status: 400 },
      );
    }

    const sb = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
      (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    );

    const before = await snapshot(sb);
    let deleted = 0;
    let updated = 0;

    if (mode === "retry-failed") {
      const { data, error } = await sb
        .from("unit_ingest_batches")
        .update({
          status: "pending",
          error_log: null,
          started_at: null,
          finished_at: null,
          rows_processed: 0,
          rows_flagged: 0,
          rows_created: 0,
          rows_updated: 0,
          rows_skipped: 0,
        })
        .eq("status", "failed")
        .select("id");
      if (error) throw new Error(`retry-failed: ${error.message}`);
      updated = data?.length ?? 0;
    }

    if (mode === "clear-pending" || mode === "full-reset") {
      const { error, count } = await sb
        .from("unit_pending_review")
        .delete({ count: "exact" })
        .neq("id", SENTINEL_UUID);
      if (error) throw new Error(`clear-pending: ${error.message}`);
      deleted += count ?? 0;
    }
    if (mode === "clear-batches" || mode === "full-reset") {
      const { error, count } = await sb
        .from("unit_ingest_batches")
        .delete({ count: "exact" })
        .neq("id", SENTINEL_UUID);
      if (error) throw new Error(`clear-batches: ${error.message}`);
      deleted += count ?? 0;
    }
    if (mode === "clear-audit" || mode === "full-reset") {
      const { error, count } = await sb
        .from("unit_ingest_audit")
        .delete({ count: "exact" })
        .neq("id", SENTINEL_UUID);
      if (error) throw new Error(`clear-audit: ${error.message}`);
      deleted += count ?? 0;
    }
    if (mode === "purge-units-prefix") {
      const { error, count } = await sb
        .from("units")
        .delete({ count: "exact" })
        .ilike("name", `${prefix}%`);
      if (error) throw new Error(`purge-units-prefix: ${error.message}`);
      deleted += count ?? 0;
    }

    const after = await snapshot(sb);
    return NextResponse.json({ ok: true, mode, before, after, deleted, updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
