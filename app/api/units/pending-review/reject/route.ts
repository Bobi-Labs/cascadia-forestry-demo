/**
 * POST /api/units/pending-review/reject
 *
 * Reject a unit_pending_review row — marks status='rejected', no
 * changes to `units`. Office uses this when a parsed row is bad data
 * and shouldn't become a unit at all.
 *
 * Body:
 *   {
 *     reviewId: string,
 *     resolution?: string,    // free-text reason (e.g. "duplicate of XYZ")
 *     reviewer?: string,
 *   }
 *
 * Audit row written with action='skipped'.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reviewId, resolution, reviewer } = body as {
      reviewId?: string;
      resolution?: string;
      reviewer?: string;
    };

    if (!reviewId) {
      return NextResponse.json({ error: "reviewId required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: review } = await admin
      .from("unit_pending_review")
      .select("id, batch_id, status")
      .eq("id", reviewId)
      .single();
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    if (review.status !== "pending") {
      return NextResponse.json(
        { error: `Review is ${review.status}, only 'pending' can be rejected` },
        { status: 409 },
      );
    }

    await admin
      .from("unit_pending_review")
      .update({
        status: "rejected",
        resolution: resolution ?? null,
        reviewed_by: reviewer ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    await admin.from("unit_ingest_audit").insert({
      batch_id: review.batch_id,
      unit_id: null,
      action: "skipped",
      source_file: null,
      field_changes: { rejected: { before: null, after: resolution ?? null } },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
