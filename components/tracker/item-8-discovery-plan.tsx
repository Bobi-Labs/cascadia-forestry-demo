"use client";

/**
 * Item 8 — Unit Data Ingest "Discovery + Plan" tab.
 *
 * Visual narrative: what shipped, what's tested, decisions locked,
 * what's still left. This is the page Jaime opens to see the full
 * Item 8 picture before paying the End 1/2 invoice.
 *
 * Keep current. Bump the lastUpdated string + the relevant rows
 * whenever Item 8 ships another piece.
 */

import {
  CheckCircle2,
  Circle,
  Clock,
  ArrowDown,
  FileSearch,
  Sparkles,
  FlaskConical,
  Lock,
  HelpCircle,
  Zap,
  ListChecks,
  Layers,
} from "lucide-react";

const stats = [
  { label: "Parsers shipped", value: "9", sub: "Manulife (4) / Weyerhaeuser / DNR / USACE / Hood River / WY photo" },
  { label: "Landowners covered", value: "5", sub: "Manulife / Weyerhaeuser / DNR / USACE / Hood River" },
  { label: "Daily smoke tests", value: "10", sub: "parser health, orchestrator E2E, role-gating, empty-state, OCR live" },
  { label: "OCR for scanned PDFs", value: "Live", sub: "Vision API on the Weyerhaeuser path — verified May 14" },
];

type ParserStatus = "live" | "live-partial" | "deferred";

const parsers: Array<{
  landowner: string;
  format: string;
  status: ParserStatus;
  daily: boolean;
  vitest: "fixture" | "real-sample" | "skip";
  notes: string;
}> = [
  {
    landowner: "Manulife",
    format: "Awarded Units (xlsx)",
    status: "live",
    daily: true,
    vitest: "fixture",
    notes: "Mode A — table parser. Every canonical field mapped.",
  },
  {
    landowner: "Manulife",
    format: "Data Sheet (PDF)",
    status: "live",
    daily: true,
    vitest: "fixture",
    notes: "Mode B — pdfjs text extraction. Needed DOMMatrix polyfill + worker pre-import for serverless.",
  },
  {
    landowner: "Manulife",
    format: "Exhibit C — Planting (PDF)",
    status: "live",
    daily: true,
    vitest: "real-sample",
    notes: "Per-unit planting specs (Client / JobName / TPA / Total / Spacing / Species / Elevation / Acres). 96 units parsed cleanly off the real La Grande 2026 PDF. Added May 13 as ongoing-upkeep under Item 8.",
  },
  {
    landowner: "Manulife",
    format: "Payment Summary (PDF)",
    status: "live",
    daily: true,
    vitest: "real-sample",
    notes: "Rare-format doc with completion + payment data. Extracts unit identity + stock type + trees planted + crew + quality %; infers status (completed when quality ≥ 80%, in_progress below). Added May 14 as ongoing-upkeep.",
  },
  {
    landowner: "Weyerhaeuser",
    format: "PlantationExam — unit (PDF + OCR)",
    status: "live",
    daily: true,
    vitest: "fixture",
    notes: "OCR via Google Cloud Vision. Extracts acres / county / state / GPS / township / elevation / species from the scanned PDF. Verified end-to-end against two real plantation files on May 14.",
  },
  {
    landowner: "Weyerhaeuser",
    format: "PlantationExam — photo (PDF)",
    status: "live",
    daily: false,
    vitest: "fixture",
    notes: "Sister format to the unit variant. No-op parser by design — photo-only PDFs carry no unit data; office uses them for visual reference.",
  },
  {
    landowner: "DNR",
    format: "Refor Contract (PDF)",
    status: "live",
    daily: true,
    vitest: "real-sample",
    notes: "Section II-A unit table parser. Real DNR contract samples parse end-to-end. Universal GPS + township extraction folds in any header-block coords.",
  },
  {
    landowner: "USACE",
    format: "Task Order (PDF)",
    status: "live",
    daily: true,
    vitest: "real-sample",
    notes: "DD Form 1155 with CLIN line items. Handles the 'CLIN' → 'CUN' font glyph quirk + PNW-state filter for cover-page address.",
  },
  {
    landowner: "Hood River",
    format: "Vegetation Control (master)",
    status: "live-partial",
    daily: true,
    vitest: "real-sample",
    notes: "Master agreement queues a single placeholder; per-unit data lives in SoW attachments (separate parser when those land).",
  },
];

const flow = [
  {
    icon: <FileSearch className="h-4 w-4" />,
    title: "Drive scan",
    body: "Recursive walk of each active contract's Drive folder. Picks up new files since the last successful scan. Idempotent — files already processed are skipped. Daily 4am PST cron + manual trigger button.",
    accent: "border-primary/40 bg-primary/5",
  },
  {
    icon: <Layers className="h-4 w-4" />,
    title: "Format detect",
    body: "Filename pattern + landowner-folder match. 10+ format patterns with permissive separators (hyphens, underscores, spaces). Unrecognized files are logged + skipped silently.",
    accent: "border-blue-500/40 bg-blue-500/5",
  },
  {
    icon: <Zap className="h-4 w-4" />,
    title: "Parser (+ OCR if needed)",
    body: "One parser per format. Every parser tries every canonical field — fields the doc carries are populated, fields it doesn't carry stay NULL. Weyerhaeuser scanned PDFs run through Google Vision first to extract text, then standard parsing.",
    accent: "border-yellow-500/40 bg-yellow-500/5",
  },
  {
    icon: <ListChecks className="h-4 w-4" />,
    title: "Universal location",
    body: "Shared GPS + township extraction across every parser. Order-agnostic regex (lat-first or lon-first), PNW bounding-box check rejects false positives. Maps page picks up the pins automatically.",
    accent: "border-green-500/40 bg-green-500/5",
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    title: "Pending review",
    body: "Rows that need office judgment land with reason badges (parse warning / unit changed / OCR required). Inline edit form mirrors manual unit creation field-for-field. Three Drive deep-links per row (project root / containing folder / source file).",
    accent: "border-purple-500/40 bg-purple-500/5",
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: "Office triage",
    body: "Approve & Insert (new unit) OR Update Unit (overwrite existing) OR Reject (discard). All canonical fields editable on the row. Defensive cleanup on re-runs — prior pending rows for the same batch are cleared so re-processing is idempotent.",
    accent: "border-orange-500/40 bg-orange-500/5",
  },
];

const decisions = [
  {
    title: "Half-and-half lifecycle",
    body: "Item 8 invoiced as 1st half ($2,250 kickoff) + 2nd half ($2,250 delivery). Kickoff paid April 27. Delivery doc sent, awaiting payment.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
  {
    title: "Approve INSERTs, Update Unit OVERWRITES",
    body: "Two distinct actions surfaced as separate badges and buttons. Office knows which one they're committing to before clicking.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
  {
    title: "Universal field-coverage rule",
    body: "Every parser tries every canonical unit field. The doc carries it → it populates. The doc doesn't → field stays NULL. No risk of false data from over-eager regex matches. Confirmed May 14 after tightening regexes when real WY OCR test surfaced false positives.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
  {
    title: "OCR for scanned PDFs",
    body: "Google Cloud Vision API enabled May 14. Free tier covers expected forestry volume (~$0/yr). Weyerhaeuser plantation parser engages OCR automatically; falls back to filename-only if Vision is offline.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
  {
    title: "Pending review form = manual unit form",
    body: "Office gets the same inline edit surface in pending review as when creating a unit by hand — every canonical field, same shadcn Select components, advanced-fields toggle for less-common fields, full notes textarea.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
  {
    title: "Cascading exclusion picker",
    body: "Landowner → Contract (with 'all under landowner') → Unit (with 'all in contract'). Live preview before commit. Pause ingest at any level when a landowner format changes.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
  {
    title: "Manual-edit protection",
    body: "When office has hand-entered units into a project, the parser detects that and silently skips re-creating the same units from a stale doc. Audit trail records the skip. Hand-entered work is never trampled.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
  {
    title: "Idempotent re-runs",
    body: "When a batch reprocesses (parser upgrade, manual retry), the orchestrator deletes prior pending review rows for the batch BEFORE running. Re-runs are clean — no stale entries.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
  {
    title: "Multi-price fields on units",
    body: "A single unit can carry per-tree, per-acre, AND per-hour pricing at the same time. Common case: a thinning unit billed per-acre for bulk work + per-hour for any cleanup time. Office picks which rate applies at invoice time.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
  {
    title: "Status inference from completion data",
    body: "When a doc carries actual planting evidence (Payment Summary trees planted + quality %), the parser sets status — 'completed' when quality ≥ 80% (Manulife full-pay tier), 'in_progress' below. Units that were planted no longer sit as 'not_started'.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
  {
    title: "Stock-type vocabulary",
    body: "Standard codes shown in the Unit form picker: 1+0, 1+1, 2+0, P+0, P+1, Plug, Plug+1, Bareroot, Container, Other. Free-text still allowed if the doc uses something off-list.",
    icon: <Lock className="h-3.5 w-3.5 text-green-400" />,
  },
];

const openQuestions: Array<{ title: string; detail: string; waitingOn: string }> = [
  // All Item 8 open questions answered as of May 14. Manulife Exhibit B
  // confirmed specs-only (no parser needed). OCR enabled + verified live.
  // Manulife Exhibit C scope question answered (rolled in under ongoing
  // upkeep). Payment Summary schema decision answered (extract unit
  // data, fold financials into notes). Parser field-coverage rule
  // confirmed and shipped.
];

const whatsLeft = [
  // Done ────────────────────────────────────────────────────────
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Stage 1 schema migration applied (5 ingest tables + canonical column additions on units + multi-price + drive_parent_folder_id + drive_relative_path)" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "All 7 landowner parsers shipped: Manulife (xlsx + Data Sheet PDF + Exhibit C + Payment Summary) / Weyerhaeuser plantation w/ OCR / DNR Refor Contract / USACE Task Order / Hood River Vegetation Control" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "OCR live for Weyerhaeuser scanned PDFs — Vision API enabled, billing linked, two real plantation files end-to-end verified May 14" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Universal field-coverage rule live — every parser tries every canonical field, NULL when source doesn't carry it" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Universal GPS + township extraction across every parser via shared helper (extract-location.mjs)" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Pending Review queue with inline form parity to manual unit creation — every canonical field editable on the row" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Daily 4am PST cron + manual trigger button on the Imports → Units tab" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Smart-skip: master-agreement placeholders no longer queue when contract already has units (logged to audit only)" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Defensive cleanup on re-runs — prior pending review rows for a batch get cleared before reprocessing, so re-runs are idempotent" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Cross-project Unit search page — search + filter pills, role-aware (admin / office / foreman), click-to-project navigation" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Reset script + UI buttons (Retry failed / Wipe queues / Purge units) for clean test loops" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Test Suite Expansion shipped — end-to-end orchestrator smoke + API role-gating + empty-state data-layer (caught real bugs incl. the broken cron middleware path)" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Manulife Exhibit B confirmed specs-only (no parser needed) — question closed" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Re-run skips already-approved units — idempotency verified live" },

  // What's left ─────────────────────────────────────────────────
  { icon: <Circle className="h-4 w-4 text-muted-foreground" />, text: "End 1/2 invoice payment (BL-2026-005-B, $2,250) — currently sent and awaiting receipt" },
  { icon: <Circle className="h-4 w-4 text-muted-foreground" />, text: "Parsers for future landowners (Chilton / Vaagen Bros / Chelan County / Mid Columbia Fisheries) — folders are detected today but no format parsers yet. ~1-3h each once a sample lands. Item 7 originally flagged as future-proofing, not blocking." },
];

export function Item8DiscoveryPlan() {
  return (
    <div className="px-4 py-4 space-y-6">
      {/* Intro */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Discovery + Plan</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Item 8 progress report. The pipeline shipped, what's tested, decisions locked, and what's still on you.
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 italic">Updated 2026-05-14</p>
      </div>

      {/* Section 1 — Stats */}
      <Section title="1. Where we are" icon={<FileSearch className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card/40 px-3 py-2">
              <div className="text-lg font-bold font-mono text-primary">{s.value}</div>
              <div className="text-[11px] font-medium text-foreground">{s.label}</div>
              <div className="text-[10px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 2 — Pipeline flow */}
      <Section title="2. The pipeline" icon={<Layers className="h-4 w-4" />} subtitle="6 stages, drop-in/drop-out at any stage">
        <div className="space-y-2">
          {flow.map((step, i) => (
            <div key={step.title}>
              <FlowBox accent={step.accent} icon={step.icon} title={step.title} body={step.body} />
              {i < flow.length - 1 && <FlowArrow />}
            </div>
          ))}
        </div>
      </Section>

      {/* Section 3 — Parser status grid */}
      <Section title="3. Parsers" icon={<Zap className="h-4 w-4" />} subtitle="one card per format, all live">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {parsers.map((p) => (
            <ParserCard key={p.landowner + p.format} parser={p} />
          ))}
        </div>
      </Section>

      {/* Section 4 — Test coverage */}
      <Section title="4. Tests" icon={<FlaskConical className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-lg border border-border bg-card/30 p-3">
            <div className="font-medium text-foreground mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Daily smoke suite (07:00 UTC)
            </div>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Parser health — round-trip fixtures through every parser</li>
              <li>• End-to-end orchestrator smoke — batch → pending_review → cleanup</li>
              <li>• API role-gating — anon callers hit admin/cron routes and get rejected</li>
              <li>• Empty-state data-layer — every list query returns array (not crash) on empty</li>
              <li>• Drive env health, Supabase connectivity, auth smoke</li>
              <li>• Project + unit folder creation (mutates, full cleanup)</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card/30 p-3">
            <div className="font-medium text-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-400" /> What gets caught
            </div>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Parser regressions (column shifts, format quirks)</li>
              <li>• Orchestrator misroutes (units landing in the wrong place)</li>
              <li>• Auth surface leaks (admin route exposed to anon)</li>
              <li>• Empty-set crashes (undefined.length style bugs)</li>
              <li>• Cron route accidentally hidden behind redirect middleware</li>
              <li className="text-[10px] italic text-muted-foreground/70">(That last one caught the daily-reminder + ingest cron bypass bug on May 14.)</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Section 5 — Decisions locked */}
      <Section title="5. Decisions locked" icon={<Lock className="h-4 w-4" />}>
        <div className="space-y-2">
          {decisions.map((d) => (
            <div key={d.title} className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{d.icon}</span>
              <div>
                <div className="text-[11px] font-semibold text-foreground">{d.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{d.body}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 6 — Open questions */}
      <Section title="6. Open questions" icon={<HelpCircle className="h-4 w-4" />} subtitle="all Item 8 questions answered as of May 14">
        {openQuestions.length === 0 ? (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
            <div className="text-[11px] text-foreground">
              No open questions on Item 8 right now. OCR enabled, Manulife Exhibit B confirmed specs-only, Exhibit C + Payment Summary parsers shipped, parser field-coverage rule confirmed. Full decision history lives on the Decisions tab.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {openQuestions.map((q) => (
              <div key={q.title} className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-3.5 w-3.5 text-orange-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold text-foreground">{q.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{q.detail}</div>
                    <div className="text-[10px] text-orange-400/80 mt-1.5 italic">Waiting on: {q.waitingOn}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Section 7 — What's done + what's left */}
      <Section title="7. Done + what's left" icon={<ListChecks className="h-4 w-4" />}>
        <ul className="space-y-2">
          {whatsLeft.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px]">
              <span className="mt-0.5 shrink-0">{n.icon}</span>
              <span className="text-foreground">{n.text}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Helpers                                                         */
/* ─────────────────────────────────────────────────────────────── */

function Section({ title, icon, subtitle, children }: { title: string; icon?: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
        {subtitle && <span className="text-[10px] text-muted-foreground italic">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function FlowBox({ accent, icon, title, body }: { accent: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className={`rounded-lg border-2 p-3 ${accent}`}>
      <div className="flex items-center gap-2">
        <span className="text-foreground">{icon}</span>
        <div className="text-xs font-semibold text-foreground">{title}</div>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{body}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center">
      <ArrowDown className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function ParserCard({ parser }: { parser: typeof parsers[number] }) {
  const statusBadge = {
    live: { label: "Live", cls: "text-green-400 bg-green-500/15 border-green-500/40" },
    "live-partial": { label: "Live · partial", cls: "text-yellow-400 bg-yellow-500/15 border-yellow-500/40" },
    deferred: { label: "Deferred", cls: "text-muted-foreground bg-muted/30 border-border" },
  }[parser.status];

  const vitestBadge = {
    fixture: { label: "Synthetic fixture", cls: "text-blue-400 bg-blue-500/15" },
    "real-sample": { label: "Real sample", cls: "text-purple-400 bg-purple-500/15" },
    skip: { label: "—", cls: "text-muted-foreground bg-muted/30" },
  }[parser.vitest];

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <div className="text-[11px] font-semibold text-foreground">{parser.landowner}</div>
          <div className="text-[10px] text-muted-foreground">{parser.format}</div>
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] ${vitestBadge.cls}`}>
          test: {vitestBadge.label}
        </span>
        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] ${parser.daily ? "text-green-400 bg-green-500/15" : "text-muted-foreground bg-muted/30"}`}>
          {parser.daily ? "✓ daily suite" : "not in daily"}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground leading-relaxed">{parser.notes}</div>
    </div>
  );
}
