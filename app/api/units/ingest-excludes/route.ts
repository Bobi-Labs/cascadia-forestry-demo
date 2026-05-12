/**
 * Item 8 — exclusion config CRUD.
 *
 * GET    /api/units/ingest-excludes        → list all
 * POST   /api/units/ingest-excludes        → add one
 *           body: { scope_type: 'landowner'|'contract'|'unit',
 *                   scope_id: string, reason?: string,
 *                   created_by?: string }
 * DELETE /api/units/ingest-excludes?id=... → remove one
 *
 * The ingest orchestrator reads `unit_ingest_excludes` at the top of
 * every batch run; rows added here take effect on the next scan/parse.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("unit_ingest_excludes")
    .select("id, scope_type, scope_id, reason, created_by, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ excludes: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scope_type, scope_id, reason, created_by } = body as {
      scope_type?: string;
      scope_id?: string;
      reason?: string;
      created_by?: string;
    };
    if (!scope_type || !scope_id) {
      return NextResponse.json({ error: "scope_type + scope_id required" }, { status: 400 });
    }
    if (!["landowner", "contract", "unit"].includes(scope_type)) {
      return NextResponse.json(
        { error: `scope_type must be landowner/contract/unit, got ${scope_type}` },
        { status: 400 },
      );
    }
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await admin
      .from("unit_ingest_excludes")
      .insert({ scope_type, scope_id, reason: reason ?? null, created_by: created_by ?? null } as any)
      .select("id")
      .single();
    if (error) {
      // Unique constraint violation = already excluded
      if (error.code === "23505") {
        return NextResponse.json({ error: "Already excluded" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("unit_ingest_excludes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
