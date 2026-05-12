/**
 * POST /api/units/pending-review/approve
 *
 * Approve a unit_pending_review row → insert/update into `units`.
 *
 * Body:
 *   {
 *     reviewId: string,
 *     contractId?: string,    // override; falls back to proposed_unit.contract_id
 *     edits?: object,         // partial unit fields to merge over proposed_unit
 *     reviewer?: string,      // display name for audit log
 *   }
 *
 * Behavior:
 *   - reason='unit_changed' → update the existing_unit_id with the
 *     merged fields. Audit row records before/after on changed fields.
 *   - any other reason → insert a new row into units. Audit row
 *     records action='created'.
 *   - sets review status='approved' + reviewed_at + reviewed_by.
 *
 * Auth: same trust model as /api/tracker/chat — UI gates by role,
 * server uses the admin Supabase client.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reviewId, contractId, edits, reviewer } = body as {
      reviewId?: string;
      contractId?: string;
      edits?: Record<string, unknown>;
      reviewer?: string;
    };

    if (!reviewId) {
      return NextResponse.json({ error: "reviewId required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Load review row
    const { data: review, error: reviewErr } = await admin
      .from("unit_pending_review")
      .select("id, batch_id, reason, source_row, proposed_unit, existing_unit_id, status")
      .eq("id", reviewId)
      .single();
    if (reviewErr) {
      return NextResponse.json({ error: reviewErr.message }, { status: 500 });
    }
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    if (review.status !== "pending") {
      return NextResponse.json(
        { error: `Review is ${review.status}, only 'pending' can be approved` },
        { status: 409 },
      );
    }

    // Merge proposed_unit + edits + contract_id override
    const proposed = (review.proposed_unit ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...proposed, ...(edits ?? {}) };
    if (contractId) merged.contract_id = contractId;
    // Strip the underscore-prefixed metadata keys the orchestrator stashes
    // on proposed_unit for the WhyPanel (`_changes`, `_warnings`,
    // `_unmapped`). Those aren't real `units` columns — they were UI
    // hints. Without this strip, Supabase rejects the upsert with
    // "Could not find the '_changes' column of 'units' in the schema
    // cache." (May 9 staging walkthrough.)
    for (const k of Object.keys(merged)) {
      if (k.startsWith("_")) delete merged[k];
    }
    if (!merged.contract_id) {
      return NextResponse.json(
        { error: "contract_id required (provide via body.contractId or proposed_unit.contract_id)" },
        { status: 400 },
      );
    }
    if (!merged.name) {
      return NextResponse.json({ error: "name required on unit" }, { status: 400 });
    }

    let unitId: string;
    let action: "created" | "updated" = "created";
    let beforeSnapshot: Record<string, unknown> | null = null;

    if (review.reason === "unit_changed" && review.existing_unit_id) {
      // Update path — capture before for audit, update by id
      const { data: existing } = await admin
        .from("units")
        .select("*")
        .eq("id", review.existing_unit_id)
        .single();
      beforeSnapshot = existing as Record<string, unknown> | null;

      // Strip fields the user can't or shouldn't update
      const { id: _id, created_at: _ca, updated_at: _ua, contract_id: _cid, ...updatable } = merged;
      void _id; void _ca; void _ua; void _cid;

      const { error: updateErr } = await admin
        .from("units")
        .update(updatable)
        .eq("id", review.existing_unit_id);
      if (updateErr) {
        return NextResponse.json({ error: `update failed: ${updateErr.message}` }, { status: 500 });
      }
      unitId = review.existing_unit_id;
      action = "updated";
    } else {
      // Insert path
      const { data: inserted, error: insertErr } = await admin
        .from("units")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(merged as any)
        .select("id")
        .single();
      if (insertErr) {
        return NextResponse.json({ error: `insert failed: ${insertErr.message}` }, { status: 500 });
      }
      unitId = inserted.id;
      action = "created";
    }

    // Mark review approved
    await admin
      .from("unit_pending_review")
      .update({
        status: "approved",
        reviewed_by: reviewer ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    // Audit row
    const fieldChanges: Record<string, unknown> = {};
    if (action === "updated" && beforeSnapshot) {
      for (const [k, v] of Object.entries(merged)) {
        if (k === "id" || k === "created_at" || k === "updated_at") continue;
        if (beforeSnapshot[k] !== v) {
          fieldChanges[k] = { before: beforeSnapshot[k] ?? null, after: v };
        }
      }
    } else {
      fieldChanges._all = { before: null, after: merged };
    }
    await admin.from("unit_ingest_audit").insert({
      batch_id: review.batch_id,
      unit_id: unitId,
      action,
      source_file: null, // batch holds the filename if needed
      field_changes: fieldChanges as never,
    });

    return NextResponse.json({ ok: true, unitId, action });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
