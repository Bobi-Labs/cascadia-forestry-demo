"use client";

/**
 * Pending Units page — office triage queue for the Item 8 ingest pipeline.
 *
 * Mirrors the Pending Expenses queue shape: each row represents a parsed
 * unit that the orchestrator couldn't auto-resolve (no contract, parser
 * warnings, conflict with an existing unit, OCR-required PDF, etc.).
 *
 * Office workflow per row:
 *   1. See the source filename + reason it's pending
 *   2. Review the proposed canonical fields (read from JSON)
 *   3. Pick the contract (or override the auto-detected one)
 *   4. Edit fields inline if needed (acres, county, work_type)
 *   5. Approve → POST /api/units/pending-review/approve
 *      Reject → POST /api/units/pending-review/reject
 *
 * Reasons handled:
 *   - unmapped_columns / parse_warnings → office fills in missing fields
 *   - unit_changed (existing unit matched by name) → office decides
 *     whether to merge changes; UPDATE path runs on approve
 *   - no_contract_attached → office picks the contract
 *   - ocr_required → from WY PlantationExam shell parser; office fills
 *     in fields manually from the PDF
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, FileText, AlertCircle, CheckCircle2, X, ExternalLink,
  RefreshCw, Filter, Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import { useContracts, useWorkTypes } from "@/hooks/use-supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FieldChange {
  field: string;
  existing: unknown;
  proposed: unknown;
}

/** Inline Google Drive logo. Used on every "open in Drive" link so the
 * destination is unambiguous at a glance. The 4-color triangle is the
 * canonical Drive mark; sizing follows the surrounding text. */
function DriveLogo({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 87.3 78" className={className} aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

interface PendingReview {
  id: string;
  batch_id: string;
  reason: string;
  source_row: Record<string, unknown> | null;
  proposed_unit: Record<string, unknown> | null;
  existing_unit_id: string | null;
  status: string;
  created_at: string;
  // Joined batch info — contract row joined in too so the office can
  // see which project this row belongs to without copying the
  // contract_id and looking it up.
  batches?: {
    drive_file_id: string | null;
    drive_file_name: string | null;
    // The file's actual containing folder (e.g. the "Maps & Specs"
    // subfolder) + its path inside the contract folder. Lets the UI
    // link directly to where the file lives instead of just the
    // contract root.
    drive_parent_folder_id: string | null;
    drive_relative_path: string | null;
    landowner: string | null;
    format_tag: string | null;
    contract_id: string | null;
    contracts?: {
      id: string;
      name: string;
      drive_folder_everyone_id: string | null;
    } | null;
  } | null;
}

// Reason-to-badge mapping. Every label leads with NEW UNIT or EXISTING
// UNIT so the office knows at a glance which path the row is on:
//   - NEW UNIT  → clicking Approve will INSERT a brand-new units row
//   - EXISTING  → clicking Update Unit OVERWRITES a matching units row
// The old labels ("Parse warnings", "Unmapped fields") said WHY the row
// is in review but not the WHAT — caused confusion in May 9 walkthrough.
const REASON_LABELS: Record<string, { label: string; tone: string }> = {
  unmapped_columns:    { label: "New unit · extra fields",   tone: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  parse_warnings:      { label: "New unit · needs info",     tone: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  unit_changed:        { label: "Existing unit · review change", tone: "bg-blue-500/15 text-blue-300 border-blue-500/40" },
  no_contract_attached:{ label: "New unit · pick contract",  tone: "bg-purple-500/15 text-purple-300 border-purple-500/40" },
  ocr_required:        { label: "New unit · scanned PDF",    tone: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  conflict:            { label: "Conflict · review",         tone: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
};

function reasonBadge(reason: string) {
  return REASON_LABELS[reason] ?? { label: reason, tone: "bg-muted text-muted-foreground border-border" };
}

export function PendingUnitsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { t, role } = useApp();
  const reviewerName = profile?.name || profile?.email?.split("@")[0] || "Office";

  const [filterReason, setFilterReason] = useState<string | null>(null);

  // Pull pending reviews + the batch they came from for filename / landowner context
  const { data: reviews, isLoading, refetch } = useQuery({
    queryKey: ["pendingUnitReviews", filterReason],
    queryFn: async (): Promise<PendingReview[]> => {
      let q = supabase
        .from("unit_pending_review")
        .select(`
          id, batch_id, reason, source_row, proposed_unit, existing_unit_id, status, created_at,
          batches:unit_ingest_batches!batch_id (
            drive_file_id, drive_file_name,
            drive_parent_folder_id, drive_relative_path,
            landowner, format_tag, contract_id,
            contracts:contracts!contract_id (id, name, drive_folder_everyone_id)
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filterReason) q = q.eq("reason", filterReason);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PendingReview[];
    },
    staleTime: 30_000,
  });

  const counts = useMemo(() => {
    const byReason: Record<string, number> = {};
    for (const r of reviews ?? []) byReason[r.reason] = (byReason[r.reason] ?? 0) + 1;
    return byReason;
  }, [reviews]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t('pu_heading')}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {(reviews ?? []).length} pending
        </span>
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-elevated"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Filter pills */}
      {Object.keys(counts).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setFilterReason(null)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              !filterReason ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-elevated"
            }`}
          >
            All
          </button>
          {Object.entries(counts).map(([reason, count]) => {
            const b = reasonBadge(reason);
            return (
              <button
                key={reason}
                type="button"
                onClick={() => setFilterReason(filterReason === reason ? null : reason)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  filterReason === reason ? b.tone : "border-border text-muted-foreground hover:bg-elevated"
                }`}
              >
                {b.label} · {count}
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (reviews ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-primary mb-3" />
          <p className="text-sm font-semibold text-foreground">{t('pu_allCaughtUp')}</p>
          {/* Subtext varies by role — admin runs the ingest, office
              just triages the queue when stuff lands. */}
          <p className="mt-1 text-xs text-muted-foreground">
            {role === "admin" ? (
              <>
                No pending unit reviews. Drop a new unit-spec file in any contract&apos;s
                <span className="font-mono"> Maps &amp; Specs/ </span> folder and run the watcher.
              </>
            ) : (
              <>No pending unit reviews. Check back when new units land.</>
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(reviews ?? []).map((r) => (
            <PendingUnitRow
              key={r.id}
              review={r}
              reviewerName={reviewerName}
              onResolved={() => queryClient.invalidateQueries({ queryKey: ["pendingUnitReviews"] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────

/**
 * Renders the "why is this here?" panel for one pending review. The
 * orchestrator stashes a few helper fields on `proposed_unit` for us:
 *   _warnings  — string[] from the parser (parse_warnings)
 *   _unmapped  — Record<string,unknown> source columns we didn't map
 *   _changes   — Array<{field, existing, proposed}> for unit_changed
 * If those aren't present (legacy rows from before the May 2026 fix),
 * we fall back to friendly defaults so the panel never goes blank.
 */
function WhyPanel({ review }: { review: PendingReview }) {
  const { t } = useApp()
  const proposed = (review.proposed_unit ?? {}) as Record<string, unknown>;
  const reason = review.reason;

  const warnings = Array.isArray(proposed._warnings)
    ? (proposed._warnings as string[])
    : [];
  const unmapped =
    proposed._unmapped && typeof proposed._unmapped === "object"
      ? (proposed._unmapped as Record<string, unknown>)
      : null;
  const changes = Array.isArray(proposed._changes)
    ? (proposed._changes as FieldChange[])
    : [];

  let title: string;
  let body: React.ReactNode;
  let tone: "amber" | "blue" | "purple" | "rose" = "amber";

  if (reason === "unit_changed") {
    tone = "blue";
    title = "An existing unit matches this name. Review what changed:";
    // Detect the derived-notes case: `notes` is the only diff and the
    // proposed value matches the parser's "Property: X · Year: Y ·
    // Season: Z" join pattern. Without context, the office sees this
    // as "the file added notes" — but the file doesn't have a notes
    // column at all. The parser folds Property + PlannedYear + Season
    // into notes because the units table has no first-class column
    // for them. We surface that explicitly so they know where the
    // proposed value comes from.
    const derivedNotesChange = changes.find(
      (c) =>
        c.field === "notes" &&
        typeof c.proposed === "string" &&
        /(Property|Year|Season): /i.test(c.proposed),
    );
    body =
      changes.length > 0 ? (
        <>
          <div className="mt-2 overflow-x-auto rounded border border-blue-500/20">
            <table className="w-full text-[11px]">
              <thead className="bg-blue-500/10 text-blue-200/80">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">{t('pu_diffField')}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('pu_diffCurrent')}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('pu_diffProposed')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/10">
                {changes.map((c) => (
                  <tr key={c.field} className="bg-card/50">
                    <td className="px-2 py-1 font-medium text-foreground">{c.field}</td>
                    <td className="px-2 py-1 font-mono text-muted-foreground">
                      {formatVal(c.existing)}
                    </td>
                    <td className="px-2 py-1 font-mono text-foreground">{formatVal(c.proposed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {derivedNotesChange && (
            <p className="mt-2 text-[11px] text-blue-200/80">
              <strong>Where does the notes value come from?</strong> The source
              file doesn&apos;t have a notes column. The parser folds the{" "}
              <code className="font-mono">Property</code>,{" "}
              <code className="font-mono">PlannedYear</code>, and{" "}
              <code className="font-mono">Season</code> columns into{" "}
              <code className="font-mono">notes</code> because the{" "}
              <code className="font-mono">units</code> table has no first-class
              fields for those. Expand the source row at the bottom to see
              the raw values.
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Field-level diff isn&apos;t recorded for this row (legacy data).
          Compare the editable fields below against the existing unit
          before approving — &ldquo;Update unit&rdquo; will overwrite the existing row
          with the values shown.
        </p>
      );
  } else if (reason === "parse_warnings" || reason === "ocr_required") {
    tone = "amber";
    // Sub-classify by warning shape so the office gets the right copy:
    //   needs_sow_attachment → Hood River-style master agreement, no
    //                          unit data in this file
    //   ocr_required         → scanned PDF that needs OCR
    //   anything else        → generic "fill in missing fields"
    const needsSow = warnings.some((w) => /sow|statement of work/i.test(w));
    const isOcr = reason === "ocr_required" ||
      warnings.some((w) => /ocr/i.test(w)) ||
      /OCR|manual entry|require/i.test(String(proposed.notes ?? ""));

    if (needsSow) {
      title = "This file is a master agreement — it doesn't list specific units.";
      body = (
        <p className="mt-1 text-[11px] text-amber-200/90">
          The contract document linked above is the legal cover for the
          season&apos;s work, but the actual unit list (acres, location, mix,
          rates) lives in a separate <strong>Statement of Work</strong> document
          the landowner sends after signing. <strong>Action:</strong> when you
          receive that follow-up file, drop it in this contract&apos;s Drive
          folder and create one unit per work area below — name, acres,
          and work type are the minimum to approve.
        </p>
      );
    } else if (isOcr) {
      title = "This file is a scanned image — text can&apos;t be read out automatically.";
      body = (
        <p className="mt-1 text-[11px] text-amber-200/90">
          The parser pulled the unit ID from the filename but couldn&apos;t
          read acres / spacing / species off the page. <strong>Action:</strong>{" "}
          open the source file linked above and type the values into the
          fields below before approving. Once OCR ships
          (<code className="font-mono">docs/unit-ingest-ocr-setup.md</code>)
          this manual step goes away.
        </p>
      );
    } else if (warnings.length > 0) {
      title = "The parser flagged issues on this new unit:";
      body = (
        <ul className="mt-1 ml-3 list-disc space-y-0.5 text-[11px] text-amber-200/90">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      );
    } else {
      title = "The parser couldn't extract every field cleanly.";
      body = (
        <p className="mt-1 text-[11px] text-amber-200/90">
          Fill in any missing fields below before approving — at minimum
          a name, acres, and work type.
        </p>
      );
    }
  } else if (reason === "unmapped_columns") {
    tone = "amber";
    title = "Some source columns didn't map to known unit fields:";
    if (unmapped && Object.keys(unmapped).length > 0) {
      body = (
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
          {Object.entries(unmapped).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-muted-foreground">{k}:</span>
              <span className="font-mono text-foreground">{formatVal(v)}</span>
            </div>
          ))}
        </div>
      );
    } else {
      body = (
        <p className="mt-1 text-[11px] text-amber-200/90">
          The source file has columns we don&apos;t recognize yet. Approve to
          accept the canonical fields below; reject to skip.
        </p>
      );
    }
  } else if (reason === "no_contract_attached") {
    tone = "purple";
    title = "We couldn't tell which contract this row belongs to.";
    body = (
      <p className="mt-1 text-[11px] text-purple-200/90">
        Pick a contract from the dropdown below before approving. The most
        common cause: the source file lives in a folder we haven&apos;t mapped
        to a contract yet.
      </p>
    );
  } else if (reason === "conflict") {
    tone = "rose";
    title = "Conflicting data detected.";
    body = (
      <p className="mt-1 text-[11px] text-rose-200/90">
        See source row + proposed values below. Reject if this looks like a
        bad parse; approve to overwrite the existing unit with these values.
      </p>
    );
  } else {
    tone = "amber";
    title = `Reason: ${reason}`;
    body = null;
  }

  const toneClass = {
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-100",
    blue: "border-blue-500/30 bg-blue-500/5 text-blue-100",
    purple: "border-purple-500/30 bg-purple-500/5 text-purple-100",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-100",
  }[tone];

  return (
    <div className={`mt-3 rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium">{title}</div>
          {body}
        </div>
      </div>
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.length > 60 ? v.slice(0, 57) + "…" : v;
  return JSON.stringify(v);
}

function PendingUnitRow({
  review,
  reviewerName,
  onResolved,
}: {
  review: PendingReview;
  reviewerName: string;
  onResolved: () => void;
}) {
  const { t } = useApp()
  const proposed = (review.proposed_unit ?? {}) as Record<string, unknown>;
  const batch = review.batches;
  const reason = reasonBadge(review.reason);
  const { data: contracts } = useContracts();
  const { data: workTypes } = useWorkTypes();

  // Helper — pull a string field from proposed, default ""
  const ps = (k: string) => (proposed[k] == null ? "" : String(proposed[k]));
  // Pull a numeric field as string for input value, default ""
  const pn = (k: string) => (proposed[k] == null ? "" : String(proposed[k]));

  // Editable canonical fields — mirror the manual unit form (May 14
  // ask from Bees). Same set of fields the manual create surface
  // exposes; same shadcn Select components for dropdowns.
  const [name, setName] = useState(ps("name"));
  const [contractId, setContractId] = useState(
    String(proposed.contract_id ?? batch?.contract_id ?? ""),
  );
  const [workType, setWorkType] = useState(ps("work_type"));
  const [status, setStatus] = useState(ps("status") || "not_started");
  const [county, setCounty] = useState(ps("county"));
  const [stateCode, setStateCode] = useState(ps("state"));
  const [acres, setAcres] = useState(pn("amount"));
  const [amountType, setAmountType] = useState(ps("amount_type") || "acre");
  const [pricePerUnit, setPricePerUnit] = useState(pn("price_per_unit"));
  const [pricePerTree, setPricePerTree] = useState(pn("price_per_tree"));
  const [pricePerAcre, setPricePerAcre] = useState(pn("price_per_acre"));
  const [pricePerHour, setPricePerHour] = useState(pn("price_per_hour"));
  const [completionPct, setCompletionPct] = useState(pn("completion_pct") || "0");
  const [terrain, setTerrain] = useState(ps("terrain_difficulty"));
  const [latitude, setLatitude] = useState(pn("latitude"));
  const [longitude, setLongitude] = useState(pn("longitude"));
  const [townshipRange, setTownshipRange] = useState(ps("township_range"));
  const [spacing, setSpacing] = useState(ps("target_spacing"));
  const [stockType, setStockType] = useState(ps("stock_type"));
  const [seedlingsPerAcre, setSeedlingsPerAcre] = useState(pn("seedlings_per_acre"));
  const [totalSeedlings, setTotalSeedlings] = useState(pn("total_seedlings"));
  const [tpaTarget, setTpaTarget] = useState(pn("tpa_target"));
  const [prescription, setPrescription] = useState(ps("prescription"));
  const [elevationMin, setElevationMin] = useState(pn("elevation_min"));
  const [elevationMax, setElevationMax] = useState(pn("elevation_max"));
  const [avgSlope, setAvgSlope] = useState(pn("avg_slope_pct"));
  const [notes, setNotes] = useState(ps("notes"));
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async () => {
      setBusy("approve");
      setErrMsg(null);

      // Convert string inputs back to numbers / null for the canonical
      // unit row. Empty strings become null so the approve endpoint
      // doesn't try to insert "" for numeric columns.
      const numOrNull = (s: string) => {
        const trimmed = s.trim();
        if (!trimmed) return null;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : null;
      };
      const strOrNull = (s: string) => {
        const trimmed = s.trim();
        return trimmed || null;
      };

      const edits: Record<string, unknown> = {
        name: name.trim() || undefined,
        work_type: strOrNull(workType),
        status: status || "not_started",
        county: strOrNull(county),
        state: strOrNull(stateCode),
        amount: numOrNull(acres),
        amount_type: strOrNull(amountType),
        price_per_unit: numOrNull(pricePerUnit),
        price_per_tree: numOrNull(pricePerTree),
        price_per_acre: numOrNull(pricePerAcre),
        price_per_hour: numOrNull(pricePerHour),
        completion_pct: numOrNull(completionPct),
        terrain_difficulty: strOrNull(terrain),
        latitude: numOrNull(latitude),
        longitude: numOrNull(longitude),
        township_range: strOrNull(townshipRange),
        target_spacing: strOrNull(spacing),
        stock_type: strOrNull(stockType),
        seedlings_per_acre: numOrNull(seedlingsPerAcre),
        total_seedlings: numOrNull(totalSeedlings),
        tpa_target: numOrNull(tpaTarget),
        prescription: strOrNull(prescription),
        elevation_min: numOrNull(elevationMin),
        elevation_max: numOrNull(elevationMax),
        avg_slope_pct: numOrNull(avgSlope),
        notes: strOrNull(notes),
      };
      const res = await fetch("/api/units/pending-review/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: review.id,
          contractId: contractId || undefined,
          edits,
          reviewer: reviewerName,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Approve failed: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => onResolved(),
    onError: (err) => {
      setErrMsg(err instanceof Error ? err.message : "Approve failed");
      setBusy(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      setBusy("reject");
      setErrMsg(null);
      const reasonText = window.prompt("Reject this row — reason (optional):") ?? "";
      const res = await fetch("/api/units/pending-review/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: review.id,
          resolution: reasonText || null,
          reviewer: reviewerName,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Reject failed: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => onResolved(),
    onError: (err) => {
      setErrMsg(err instanceof Error ? err.message : "Reject failed");
      setBusy(null);
    },
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Top row — reason + landowner/format badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reason.tone}`}>
          {reason.label}
        </span>
        {batch?.landowner && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {batch.landowner}
          </span>
        )}
        {batch?.format_tag && (
          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            {batch.format_tag}
          </span>
        )}
      </div>

      {/* Provenance — three Drive links so the office can verify where
          a row came from at a glance:
            1. Project root (the contract's Drive folder)
            2. File's actual containing folder (new — most useful since
               files often live one level deep, e.g. "Maps & Specs/")
            3. The file itself
          Each link wears the Drive logo so it's obvious where it goes.
          Backwards compat: rows ingested before the May 7 schema
          migration won't have drive_parent_folder_id; we render the
          file-folder link only when it's present and different from
          the project root. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide">{t('pu_provProject')}:</span>
          <span className="text-foreground font-medium">
            {batch?.contracts?.name ?? "(no contract attached)"}
          </span>
          {batch?.contracts?.drive_folder_everyone_id && (
            <a
              href={`https://drive.google.com/drive/folders/${batch.contracts.drive_folder_everyone_id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t("pu_openProjectFolder")}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <DriveLogo /> folder
            </a>
          )}
        </div>

        {batch?.drive_parent_folder_id &&
         batch.drive_parent_folder_id !== batch?.contracts?.drive_folder_everyone_id && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide">{t('pu_provInFolder')}:</span>
            <a
              href={`https://drive.google.com/drive/folders/${batch.drive_parent_folder_id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t("pu_openFileFolder")}
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              <DriveLogo />
              {(() => {
                // Show the relative path WITHOUT the filename — the
                // file gets its own link below. e.g.
                //   "Maps & Specs/2026 Plan.pdf"  →  "Maps & Specs/"
                const rel = batch.drive_relative_path ?? "";
                const idx = rel.lastIndexOf("/");
                return idx >= 0 ? rel.slice(0, idx) + "/" : "(folder)";
              })()}
            </a>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide">{t('pu_provFile')}:</span>
          {batch?.drive_file_name ? (
            <a
              href={batch?.drive_file_id ? `https://drive.google.com/file/d/${batch.drive_file_id}/view` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              title={t("pu_openSourceFile")}
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              <DriveLogo /> {batch.drive_file_name}
            </a>
          ) : (
            <span>(no source file)</span>
          )}
        </div>
      </div>

      {/* Why is this row in the queue? */}
      <WhyPanel review={review} />

      {/* Editable fields — inline. Mirrors the manual unit form so
          office sees the same set of fields here as when creating a
          unit by hand. Common fields shown always; advanced fields
          (TPA target, seedlings, prescription, slope, elevation
          range) live behind a Show/Hide toggle just like in the
          manual form. The bare native <select> for contract was
          replaced with the shadcn Select used everywhere else in
          the app — fixes the broken-dropdown bug. */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Unit name" value={name} onChange={setName} required />

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('pu_lblContract')}</label>
          <Select value={contractId} onValueChange={setContractId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="— pick project —" /></SelectTrigger>
            <SelectContent>
              {(contracts ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Work type</label>
          <Select value={workType} onValueChange={setWorkType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {(workTypes ?? []).map((wt) => (
                <SelectItem key={wt.id} value={wt.name}>{wt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Field label="County" value={county} onChange={setCounty} />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">State</label>
          <Select value={stateCode} onValueChange={setStateCode}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="WA">Washington</SelectItem>
              <SelectItem value="OR">Oregon</SelectItem>
              <SelectItem value="ID">Idaho</SelectItem>
              <SelectItem value="CA">California</SelectItem>
              <SelectItem value="MT">Montana</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Field label="Amount" value={acres} onChange={setAcres} type="number" />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit type</label>
          <Select value={amountType} onValueChange={setAmountType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tree">Trees</SelectItem>
              <SelectItem value="acre">Acres</SelectItem>
              <SelectItem value="hour">Hours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Field label="Price/Unit" value={pricePerUnit} onChange={setPricePerUnit} type="number" />
        <Field label="$/Tree" value={pricePerTree} onChange={setPricePerTree} type="number" />
        <Field label="$/Acre" value={pricePerAcre} onChange={setPricePerAcre} type="number" />
        <Field label="$/Hour" value={pricePerHour} onChange={setPricePerHour} type="number" />

        <Field label="Completion %" value={completionPct} onChange={setCompletionPct} type="number" />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Terrain</label>
          <Select value={terrain} onValueChange={setTerrain}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Field label="Target spacing" value={spacing} onChange={setSpacing} />
        <Field label="Stock type" value={stockType} onChange={setStockType} />

        <Field label="Latitude" value={latitude} onChange={setLatitude} type="number" />
        <Field label="Longitude" value={longitude} onChange={setLongitude} type="number" />
        <Field label="Township / Range" value={townshipRange} onChange={setTownshipRange} />
        <div /> {/* spacer to align grid */}
      </div>

      {/* Advanced fields (toggleable, same UX as the manual form) */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
      >
        {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {showAdvanced ? "Hide" : "Show"} advanced fields
      </button>

      {showAdvanced && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-md border border-border bg-elevated/30 p-3">
          <Field label="TPA target" value={tpaTarget} onChange={setTpaTarget} type="number" />
          <Field label="Seedlings/acre" value={seedlingsPerAcre} onChange={setSeedlingsPerAcre} type="number" />
          <Field label="Total seedlings" value={totalSeedlings} onChange={setTotalSeedlings} type="number" />
          <Field label="Avg slope %" value={avgSlope} onChange={setAvgSlope} type="number" />
          <Field label="Elevation min" value={elevationMin} onChange={setElevationMin} type="number" />
          <Field label="Elevation max" value={elevationMax} onChange={setElevationMax} type="number" />
          <div className="sm:col-span-2">
            <Field label="Prescription" value={prescription} onChange={setPrescription} />
          </div>
        </div>
      )}

      <div className="mt-3">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('pu_lblNotes')}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {errMsg && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {errMsg}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!!busy || !name.trim() || !contractId}
          onClick={() => approveMutation.mutate()}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          title={!contractId ? "Pick a contract first" : !name.trim() ? "Name required" : ""}
        >
          {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {review.reason === "unit_changed" ? "Update unit" : "Approve & insert"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => rejectMutation.mutate()}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 disabled:opacity-50"
        >
          {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Reject
        </button>

        <details className="ml-auto text-[10px] text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">source row</summary>
          <pre className="mt-2 max-w-[480px] overflow-auto rounded bg-elevated p-2 font-mono text-[10px]">
            {JSON.stringify(review.source_row, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}{required ? " *" : ""}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-elevated px-2 text-xs text-foreground focus:border-primary focus:outline-none"
      />
    </div>
  );
}
