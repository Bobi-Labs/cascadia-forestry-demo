"use client";

import { useState, useMemo, useCallback, memo } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Package,
  Sparkles,
  Layers,
  Truck,
  HelpCircle,
  FileText,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Use the module-level singleton instead of createClient() per render — the
// QuestionRow textarea calls createClient on every keystroke otherwise,
// which spins up a new auth-listening browser client each time and
// causes the typing freeze reported on 2026-04-24.
import { supabase } from "@/lib/supabase";
// Read path for deliverable_* tables routes around supabase-js's fetch
// wrapper (every deliverable_* SELECT through `.from(...)` was wedging in
// production while curl + tracker_items reads on the same client returned
// in <1s). See lib/supabase/raw-rest.ts + the recipe in
// bobi-worktracker/docs/MIRROR_TO_FORESTRY.md. Mutations stay on
// supabase-js — the wedge is read-only.
import { rawSelect } from "@/lib/supabase/raw-rest";
import { useTrackerAuth } from "./tracker-auth-provider";
import { Item7DiscoveryPlan } from "./item-7-discovery-plan";
import { Item8DiscoveryPlan } from "./item-8-discovery-plan";
import { Item16SecurityDiscoveryPlan } from "./item-16-security-discovery";
import { Item2ExpenseUpdates } from "./item-2-expense-updates";
import type { Database } from "@/lib/supabase/database.types";

type DeliverableItemRow = Database["public"]["Tables"]["deliverable_items"]["Row"];
type DeliverableQuestionRow = Database["public"]["Tables"]["deliverable_questions"]["Row"];
type DeliverableInvoiceLineRow = Database["public"]["Tables"]["deliverable_invoice_lines"]["Row"];

/* ── Types ── */


interface BacklogItem {
  id: string; // stable key for DB persistence
  name: string;
  category: string; // phase label, e.g. "Phase 2", "Phase 3", "Future"
  notes: string;
  priority: number; // 1-5 (1=highest)
  size: number; // fibonacci: 1,2,3,5,8,13
}

type BacklogOverrideRow = Database["public"]["Tables"]["tracker_backlog_overrides"]["Row"];


const FIBONACCI = [1, 2, 3, 5, 8, 13];
const PRIORITIES = [1, 2, 3, 4, 5];
const PHASE_OPTIONS = ["Phase 2", "Phase 3", "Phase 4", "Future"];
const PRIORITY_LABELS: Record<number, string> = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low", 5: "Someday" };
const PRIORITY_COLORS: Record<number, string> = {
  1: "text-red-400 bg-red-500/15",
  2: "text-orange-400 bg-orange-500/15",
  3: "text-yellow-400 bg-yellow-500/15",
  4: "text-blue-400 bg-blue-500/15",
  5: "text-muted-foreground bg-muted/50",
};

/* Emails allowed to edit priority/phase/size */
const EDITORS = ["mietsko@gmail.com", "jaime@cascadiaforestry.com"];

/**
 * Registry of items that have a hand-built React component for their
 * "Discovery + Plan" tab. Both OngoingCard (open card) and DeliveredCard
 * (collapsed-section inside) check this first — a registry hit overrides
 * the raw `discovery_plan_md` markdown rendering. Items not listed here
 * fall back to markdown (or skip the tab entirely if no markdown is set).
 */
const RICH_DISCOVERY_COMPONENTS: Record<string, React.ComponentType> = {
  "item-07-scoping": Item7DiscoveryPlan,
  "item-08-unit-ingest": Item8DiscoveryPlan,
  "item-16-platform-security": Item16SecurityDiscoveryPlan,
};


/* ── SECTION 5: Future Backlog with Priority + Fibonacci Size ── */
/* Priority based on Jaime's stated priorities:
   1 = "the most important thing" (data collection, payroll)
   2 = "the second most important thing" (contract management, foreman tools, weather)
   3 = medium priority (safety for May chainsaw season, analytics)
   4 = lower priority (comms, integrations, admin tools)
   5 = someday (AI, advanced, scale) */

// Reviewed 2026-04-24. Items shipped (Drive, Bids scaffolding, analytics basics,
// expense tracking, task-order metadata, landowner grouping) were removed from
// here — they're either in Delivered or covered by Ongoing Work items 7-15.
// Kept: work genuinely pending + speculative future-phase items.
const DEFAULT_BACKLOG: BacklogItem[] = [
  // ── Priority 1 — Critical (revenue, security, compliance) ──
  { id: "payroll-engine", name: "Payroll calculation engine (5-layer: hourly, daily, drive, OT, fringe)", category: "Phase 2", notes: "County-based prevailing wage, OT calc, fringe per contract. The big one — real payroll replaces manual spreadsheet math.", priority: 1, size: 13 },
  { id: "auth-hardening", name: "Auth hardening — remove dev_anon_read, enforce full RLS", category: "Phase 2", notes: "Tighten row-level security, kill open-read fallback policies. Required before foreman logins go fully self-service.", priority: 1, size: 5 },
  { id: "county-wage", name: "County minimum + prevailing wage enforcement", category: "Phase 2", notes: "Auto-lookup rates from 9142 form data by unit county. Feeds the payroll engine.", priority: 1, size: 5 },
  { id: "species-trees-per-bag", name: "Species-specific trees-per-bag lookup", category: "Phase 2", notes: "Replace hardcoded 300/bag with a DB table keyed by species / stock type. Range spans 80-300 per Webster + Weyerhaeuser docs. Jaime has the data.", priority: 1, size: 3 },
  { id: "bid-scraper", name: "Automated bid-scraper — state/federal contract finder", category: "Phase 2", notes: "Scrape Jaime's bid-listing sites (he sends the URLs) for new contracts matching forestry keywords. Morning-digest email + in-app queue. Big revenue lever — Jaime's #1 post-invoicing priority. Once he's not putting out fires, this is where his focus goes.", priority: 1, size: 8 },

  // ── Priority 2 — High (everyday impact) ──
  { id: "weather-api", name: "Weather API integration by unit GPS coords", category: "Phase 2", notes: "Daily forecast per active unit, 5-day lookahead. Powers spray-condition gating.", priority: 2, size: 5 },
  { id: "spray-conditions", name: "Spray conditions check (temp, humidity, wind)", category: "Phase 2", notes: "Auto-flag when conditions breach herbicide spray limits. Paired with weather-api.", priority: 2, size: 3 },
  { id: "foreman-alerts", name: "Foreman alert system (office → foreman push)", category: "Phase 2", notes: "Office adds note/file → foreman gets alert → tap opens the right contract. Different from the general alert bell.", priority: 2, size: 5 },
  { id: "payroll-export", name: "Payroll export to accountant (flexible format)", category: "Phase 2", notes: "Google Sheets / CSV with full rate breakdown. Downstream of the payroll engine.", priority: 2, size: 3 },
  { id: "contract-onboarding", name: "Contract onboarding checklist + status workflow", category: "Phase 2", notes: "Auto-email insurance agent, track compliance, stage gates from bid-won → work-starting.", priority: 2, size: 5 },
  { id: "contract-hierarchy-full", name: "Full parent/child contract hierarchy", category: "Phase 2", notes: "Landowner grouping live. Still missing: true umbrella contracts with cascading edits, historical rollup (“everything ever done under Manulife”).", priority: 2, size: 8 },

  // ── Priority 3 — Medium (safety, foreman UX, analytics depth) ──
  { id: "safety-checklist", name: "Safety checklist system (daily + per-task)", category: "Phase 3", notes: "Random drill notifications, scenario training, incident tracking. Chainsaw season preps.", priority: 3, size: 8 },
  { id: "fatigue-monitoring", name: "Fatigue monitoring (consecutive days + weekly hours)", category: "Phase 3", notes: "Alert at 6+ consecutive days or 50+ hours. Injury-prevention signal layered on OT.", priority: 3, size: 3 },
  { id: "osha-reporting", name: "OSHA incident reporting", category: "Phase 3", notes: "Incident tracking with exportable compliance report format.", priority: 3, size: 5 },
  { id: "employee-profiles", name: "Full employee profiles (documents, certs, compliance)", category: "Phase 3", notes: "Passport/visa scans, certifications with expiration alerts. Feeds safety-certs.", priority: 3, size: 8 },
  { id: "cross-contract-filter", name: "Cross-contract filtering (work type, landowner, status)", category: "Phase 2", notes: "Filter across every contract at once, not one-at-a-time.", priority: 3, size: 3 },
  { id: "foreman-calendar", name: "Foreman calendar view (contract timeline)", category: "Phase 2", notes: "Contract-focused timeline, separate from admin calendar. Field-friendly.", priority: 3, size: 5 },
  { id: "foreman-chat", name: "Foreman chat (per-contract channels)", category: "Phase 2", notes: "Spray / planting crews separate, TG bot integration. Phase 2 of the TG work.", priority: 3, size: 8 },
  { id: "contract-warnings", name: "Contract warnings (safety, rain, road closures)", category: "Phase 2", notes: "Important notes visible to foremen when they open a contract.", priority: 3, size: 2 },
  { id: "fire-risk", name: "Fire risk level integration (DNR)", category: "Phase 2", notes: "Fire level affects access to units — dashboard alerts when units go no-go.", priority: 3, size: 3 },
  { id: "frost-alerts", name: "Frost / snow alerts for planting", category: "Phase 2", notes: "Configurable thresholds for planting season.", priority: 3, size: 2 },
  { id: "crew-productivity", name: "Crew productivity comparisons", category: "Phase 2", notes: "Performance trends, efficiency scoring per crew.", priority: 3, size: 5 },
  { id: "days-to-complete", name: "Days-to-complete estimator per contract", category: "Phase 2", notes: "Crew rate × remaining work = estimated completion date. Feeds scheduling.", priority: 3, size: 3 },
  { id: "vehicle-equipment", name: "Vehicle & equipment management module", category: "Phase 3", notes: "Registry, issue reporting, inspection alerts, per-crew assignment.", priority: 3, size: 5 },
  { id: "safety-certs", name: "Safety & certifications tracker", category: "Phase 3", notes: "Cert + training records with expiration alerts. Pairs with employee profiles.", priority: 3, size: 5 },

  // ── Priority 4 — Lower (comms, integrations, admin) ──
  { id: "email-smtp", name: "Email notifications (SMTP)", category: "Phase 3", notes: "Automated emails for approvals, alerts, compliance deadlines.", priority: 4, size: 3 },
  { id: "sms-twilio", name: "SMS notifications (Twilio)", category: "Phase 3", notes: "Text alerts for critical items (OT, compliance).", priority: 4, size: 3 },
  { id: "gcal-sync", name: "Google Calendar sync", category: "Phase 3", notes: "Sync company Google Calendar into the app calendar.", priority: 4, size: 3 },
  { id: "employee-onboarding", name: "Employee onboarding workflow (digital forms)", category: "Phase 3", notes: "Document collection + compliance checklist for new hires.", priority: 4, size: 5 },
  { id: "audit-compliance", name: "Audit-ready compliance export (DOL / L&I)", category: "Phase 3", notes: "Exportable compliance reports sized for Department of Labor asks.", priority: 4, size: 3 },

  // ── Priority 5 — Someday (speculative, research-grade) ──
  { id: "email-to-db", name: "Email-to-database forwarding (AI-assisted)", category: "Phase 3", notes: "Forward emails → parse attachments → file with the right contract automatically.", priority: 5, size: 8 },
  { id: "bid-prediction", name: "Bid prediction model (rules first, later ML)", category: "Phase 4", notes: "Terrain + historical data + crew performance → optimal bid pricing.", priority: 5, size: 13 },
  { id: "competitor-bids", name: "Competitor bid tracking", category: "Phase 4", notes: "Who you're bidding against and at what prices. Feeds bid intelligence.", priority: 5, size: 5 },
  { id: "gps-mapping", name: "GPS production mapping (draw area worked)", category: "Phase 4", notes: "Start/stop GPS per unit, polygon acreage auto-calc. Beyond Item 14 pin-placement.", priority: 5, size: 8 },
  { id: "satellite-imagery", name: "Satellite imagery overlaid on units", category: "Phase 4", notes: "Aerial views beneath unit boundaries for faster field prep.", priority: 5, size: 5 },
  { id: "weyerhaeuser-scraping", name: "Weyerhaeuser seedling system scraping", category: "Phase 4", notes: "Requires system access evaluation. Pulls seedling counts directly.", priority: 5, size: 5 },
  { id: "nursery-ops", name: "Nursery operations module", category: "Phase 4", notes: "Lift, store, pack trees for DNR supply. Different workflow from field ops.", priority: 5, size: 13 },
  { id: "client-portal", name: "Client / landowner portal", category: "Phase 4", notes: "Landowner-facing portal showing progress on their contracts.", priority: 5, size: 8 },
  { id: "dad-voice-bot", name: "Dad's Telegram voice bot (Spanish Q&A)", category: "Phase 4", notes: "Ask questions in Spanish via voice, get data back. For Jose.", priority: 5, size: 8 },
];

/* ── Hook: DB-backed backlog overrides with optimistic updates ── */

const BACKLOG_QUERY_KEY = ["tracker-backlog-overrides"];

function useBacklogState(editorEmail: string | null) {
  const queryClient = useQueryClient();

  // Fetch all overrides from Supabase
  const { data: overrides = [] } = useQuery<BacklogOverrideRow[]>({
    queryKey: BACKLOG_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracker_backlog_overrides")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Build a lookup map
  const overrideMap = useMemo(() => {
    const m: Record<string, BacklogOverrideRow> = {};
    for (const row of overrides) m[row.item_id] = row;
    return m;
  }, [overrides]);

  // Upsert mutation with optimistic update
  const upsertMutation = useMutation({
    mutationFn: async (payload: { item_id: string; priority?: number; phase?: string; size?: number }) => {
      const { error } = await supabase
        .from("tracker_backlog_overrides")
        .upsert(
          {
            item_id: payload.item_id,
            ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
            ...(payload.phase !== undefined ? { phase: payload.phase } : {}),
            ...(payload.size !== undefined ? { size: payload.size } : {}),
            updated_by: editorEmail ?? "unknown",
          },
          { onConflict: "item_id" },
        );
      if (error) throw error;
    },
    onMutate: async (payload) => {
      // Cancel in-flight fetches
      await queryClient.cancelQueries({ queryKey: BACKLOG_QUERY_KEY });
      const prev = queryClient.getQueryData<BacklogOverrideRow[]>(BACKLOG_QUERY_KEY);

      // Optimistically update cache
      queryClient.setQueryData<BacklogOverrideRow[]>(BACKLOG_QUERY_KEY, (old = []) => {
        const idx = old.findIndex((r) => r.item_id === payload.item_id);
        const existing = idx >= 0 ? old[idx] : { item_id: payload.item_id, priority: null, phase: null, size: null, updated_at: null, updated_by: null };
        const updated: BacklogOverrideRow = {
          ...existing,
          ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
          ...(payload.phase !== undefined ? { phase: payload.phase } : {}),
          ...(payload.size !== undefined ? { size: payload.size } : {}),
          updated_by: editorEmail ?? "unknown",
          updated_at: new Date().toISOString(),
        };
        if (idx >= 0) {
          const copy = [...old];
          copy[idx] = updated;
          return copy;
        }
        return [...old, updated];
      });

      return { prev };
    },
    onError: (_err, _payload, context) => {
      // Rollback on error
      if (context?.prev) {
        queryClient.setQueryData(BACKLOG_QUERY_KEY, context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BACKLOG_QUERY_KEY });
    },
  });

  const update = useCallback(
    (id: string, field: "priority" | "phase" | "size", value: number | string) => {
      upsertMutation.mutate({ item_id: id, [field]: value });
    },
    [upsertMutation],
  );

  const getItem = useCallback(
    (item: BacklogItem): BacklogItem => {
      const ov = overrideMap[item.id];
      return {
        ...item,
        priority: ov?.priority ?? item.priority,
        category: ov?.phase ?? item.category,
        size: ov?.size ?? item.size,
      };
    },
    [overrideMap],
  );

  return { getItem, update };
}

/* ── Badge components ── */

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {category}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[priority]}`}>
      P{priority} {PRIORITY_LABELS[priority]}
    </span>
  );
}

function SizeBadge({ size }: { size: number }) {
  return (
    <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-mono font-medium text-purple-400">
      {size}pt
    </span>
  );
}

/* ── Inline select for editable fields (supports number and string values) ── */

function InlineSelect<T extends number | string>({ value, options, onChange, renderLabel }: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  renderLabel: (v: T) => string;
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        // If original options are numbers, parse back to number
        const parsed = typeof options[0] === "number" ? Number(raw) as unknown as T : raw as unknown as T;
        onChange(parsed);
      }}
      className="appearance-none bg-card text-foreground border border-border/50 rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer hover:border-primary/50 focus:border-primary focus:outline-none transition-colors"
    >
      {options.map((o) => (
        <option key={String(o)} value={String(o)} className="bg-card text-foreground">{renderLabel(o)}</option>
      ))}
    </select>
  );
}

/* ── Future Backlog Section (table with editable priority/phase/size) ── */

function BacklogSection({ canEdit, editorEmail }: { canEdit: boolean; editorEmail: string | null }) {
  const [sortBy, setSortBy] = useState<"priority" | "size" | "category">("priority");
  const { getItem, update } = useBacklogState(editorEmail);

  const items = DEFAULT_BACKLOG.map(getItem).sort((a, b) => {
    if (sortBy === "priority") return a.priority - b.priority || a.size - b.size;
    if (sortBy === "size") return b.size - a.size || a.priority - b.priority;
    return a.category.localeCompare(b.category) || a.priority - b.priority;
  });

  const totalPoints = items.reduce((sum, i) => sum + i.size, 0);

  return (
    <div className="space-y-3">
      {/* Header strip — total count + size points */}
      <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/5 px-4 py-2.5">
        <Layers className="h-4 w-4 text-purple-400 shrink-0" />
        <span className="text-sm font-semibold text-purple-400">Backlog</span>
        <span className="text-[11px] text-muted-foreground">
          · {items.length} items · {totalPoints}pt total · sortable, refine in place
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_90px_110px_70px] gap-2 px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Feature</span>
          <button type="button" onClick={() => setSortBy("category")} className={`text-left hover:text-foreground ${sortBy === "category" ? "text-purple-400" : ""}`}>
            Phase {sortBy === "category" ? "\u25BC" : ""}
          </button>
          <button type="button" onClick={() => setSortBy("priority")} className={`text-left hover:text-foreground ${sortBy === "priority" ? "text-purple-400" : ""}`}>
            Priority {sortBy === "priority" ? "\u25BC" : ""}
          </button>
          <button type="button" onClick={() => setSortBy("size")} className={`text-left hover:text-foreground ${sortBy === "size" ? "text-purple-400" : ""}`}>
            Size {sortBy === "size" ? "\u25BC" : ""}
          </button>
        </div>
        {/* Rows */}
        <div className="divide-y divide-border/50 bg-card/30">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_90px_110px_70px] gap-2 px-3 py-2 hover:bg-muted/30 transition-colors items-center">
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-foreground leading-tight">{item.name}</span>
                <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">{item.notes}</p>
              </div>
              <div>
                {canEdit ? (
                  <InlineSelect<string>
                    value={item.category}
                    options={PHASE_OPTIONS}
                    onChange={(v) => update(item.id, "phase", v)}
                    renderLabel={(v) => v}
                  />
                ) : (
                  <CategoryBadge category={item.category} />
                )}
              </div>
              <div>
                {canEdit ? (
                  <InlineSelect<number>
                    value={item.priority}
                    options={PRIORITIES}
                    onChange={(v) => update(item.id, "priority", v)}
                    renderLabel={(v) => `P${v} ${PRIORITY_LABELS[v]}`}
                  />
                ) : (
                  <PriorityBadge priority={item.priority} />
                )}
              </div>
              <div>
                {canEdit ? (
                  <InlineSelect<number>
                    value={item.size}
                    options={FIBONACCI}
                    onChange={(v) => update(item.id, "size", v)}
                    renderLabel={(v) => `${v}pt`}
                  />
                ) : (
                  <SizeBadge size={item.size} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── DB-backed tabs: Delivered / Ongoing Work / Questions ── */

const DELIVERABLES_QUERY_KEY = ["deliverable-items"];
const QUESTIONS_QUERY_KEY = ["deliverable-questions"];

function useDeliverableItems(tab: "delivered" | "ongoing" | "above_beyond") {
  return useQuery<DeliverableItemRow[]>({
    queryKey: [...DELIVERABLES_QUERY_KEY, tab],
    queryFn: async () =>
      rawSelect<DeliverableItemRow[]>(
        `deliverable_items?select=*&tab=eq.${tab}&order=sort_order.asc`,
        { label: `deliv-items-${tab}` },
      ),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
  });
}

function useAllQuestions() {
  return useQuery<DeliverableQuestionRow[]>({
    queryKey: QUESTIONS_QUERY_KEY,
    queryFn: async () =>
      rawSelect<DeliverableQuestionRow[]>(
        `deliverable_questions?select=*&order=sort_order.asc`,
        { label: "deliv-questions" },
      ),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
  });
}

/**
 * Single-query variant that returns items with their invoice_lines nested.
 * Replaces the old two-step flow (fetch items → then fetch lines keyed by
 * item_id) which caused the "Delivered tab lag" reported on 2026-04-24.
 * One round-trip, no sequential waiting, stable query key, long staleTime.
 */
type DeliverableItemWithLines = DeliverableItemRow & {
  deliverable_invoice_lines: DeliverableInvoiceLineRow[];
};

function useDeliverableItemsWithLines(tab: "delivered" | "ongoing" | "above_beyond") {
  return useQuery<DeliverableItemWithLines[]>({
    queryKey: [...DELIVERABLES_QUERY_KEY, tab, "with-lines"],
    queryFn: async () => {
      // Embedded select (`*, deliverable_invoice_lines(*)`) was the original
      // shape but it's exactly the wedge pattern — even after stripping
      // foreign-table ordering, supabase-js's fetch wrapper hangs on every
      // deliverable_* read. Two parallel rawSelect() calls + client-side
      // merge instead. Slower paper-spec (~640ms vs ~330ms) but reliable.
      const [items, lines] = await Promise.all([
        rawSelect<DeliverableItemRow[]>(
          `deliverable_items?select=*&tab=eq.${tab}&order=sort_order.asc`,
          { label: `deliv-items-${tab}-wl` },
        ),
        rawSelect<DeliverableInvoiceLineRow[]>(
          `deliverable_invoice_lines?select=*&order=sort_order.asc`,
          { label: "deliv-lines" },
        ),
      ]);
      const linesByItem = new Map<string, DeliverableInvoiceLineRow[]>();
      for (const line of lines) {
        const arr = linesByItem.get(line.item_id) ?? [];
        arr.push(line);
        linesByItem.set(line.item_id, arr);
      }
      return items.map(
        (item): DeliverableItemWithLines => ({
          ...item,
          deliverable_invoice_lines: linesByItem.get(item.id) ?? [],
        }),
      );
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
  });
}

/* ── Delivered tab ── */

function DeliveredTab({ canEdit: _canEdit }: { canEdit: boolean }) {
  // Single-round-trip fetch (items + their invoice_lines nested).
  // Prior two-query pattern caused the "Delivered takes a refresh to
  // populate" lag. See hooks comment above for the reason.
  const { data: items, isLoading } = useDeliverableItemsWithLines("delivered");

  if (isLoading) return <div className="text-xs text-muted-foreground px-3 py-4">Loading delivered items…</div>;
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-6 text-center">
        <Truck className="mx-auto h-6 w-6 text-green-400/60 mb-2" />
        <p className="text-sm text-foreground font-medium">Nothing delivered yet in the new per-item structure.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Items 1 (Files) + 2 (Expenses) will land here as separate cards, each with their own &ldquo;Out of Scope Extras&rdquo; companion card.
          Content seeds in after the UI review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <DeliveredCard key={item.id} item={item} lines={item.deliverable_invoice_lines} />
      ))}
    </div>
  );
}

function DeliveredCard({ item, lines }: { item: DeliverableItemRow; lines: DeliverableInvoiceLineRow[] }) {
  const [open, setOpen] = useState(false);
  // Per-item "Updates" tab — keyed on item_key so each delivered item can
  // own its own post-delivery visual (what changed / what we improved /
  // what Jaime should know since it shipped). Currently only item-02-expenses
  // has one — the 2026-04-24 category schema expansion.
  const updatePanel = ITEM_UPDATE_PANELS[item.item_key];
  const hasTabs = Boolean(updatePanel);
  const [activeTab, setActiveTab] = useState<"overview" | "updates">("overview");

  const inScope = lines.filter((l) => !l.is_out_of_scope);
  const outOfScope = lines.filter((l) => l.is_out_of_scope);
  const accent = item.is_out_of_scope_card
    ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
    : "border-green-500/30 bg-green-500/10 text-green-400";
  return (
    <div className={`rounded-lg border overflow-hidden ${accent.split(" ").slice(0, 1).join(" ")}`}>
      <button type="button" onClick={() => setOpen(!open)} className={`flex w-full items-center gap-2 px-4 py-3 text-left ${accent.split(" ").slice(1).join(" ")} hover:opacity-90 transition-opacity`}>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        {item.is_out_of_scope_card ? <Sparkles className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        <span className="text-sm font-semibold">{item.title}</span>
        {item.subtitle && <span className="text-[10px] text-muted-foreground italic">{item.subtitle}</span>}
        {hasTabs && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">
            <Sparkles className="h-2.5 w-2.5" /> New update
          </span>
        )}
        <span className="ml-auto rounded-full bg-background/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{lines.length}</span>
      </button>
      {open && (
        <div className="bg-card/30">
          {hasTabs && (
            <div className="flex items-center gap-1 border-b border-border/50 bg-background/40 px-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`rounded-t-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  activeTab === "overview"
                    ? "bg-card text-foreground border-t border-x border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("updates")}
                className={`rounded-t-md px-3 py-1.5 text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === "updates"
                    ? "bg-card text-foreground border-t border-x border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                Updates
              </button>
            </div>
          )}
          {(!hasTabs || activeTab === "overview") && (
            <div className="divide-y divide-border/50">
              {item.scope_md && (
                <div className="px-4 py-3 text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{item.scope_md}</div>
              )}
              {inScope.length > 0 && (
                <ul className="divide-y divide-border/50">
                  {inScope.map((l) => (
                    <li key={l.id} className="flex items-start gap-2 px-4 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 mt-0.5 shrink-0" />
                      <span className="text-[11px] text-foreground leading-tight">{l.description}</span>
                    </li>
                  ))}
                </ul>
              )}
              {outOfScope.length > 0 && (
                <ul className="divide-y divide-border/50">
                  {outOfScope.map((l) => (
                    <li key={l.id} className="flex items-start gap-2 px-4 py-2">
                      <Sparkles className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                      <span className="text-[11px] text-foreground leading-tight">{l.description}</span>
                    </li>
                  ))}
                </ul>
              )}
              {(item.discovery_plan_md || item.item_key in RICH_DISCOVERY_COMPONENTS) && (
                <DeliveredDiscoverySection itemKey={item.item_key} markdown={item.discovery_plan_md ?? ""} />
              )}
              {item.invoice_status && (
                <div className="px-4 py-2 text-[10px] text-muted-foreground flex items-center gap-3">
                  <span>Invoice: <span className="font-mono text-foreground">{item.invoice_number ?? "—"}</span></span>
                  <span className="uppercase font-medium text-green-400">{item.invoice_status}</span>
                  {item.invoice_amount && <span className="font-mono text-foreground">${Number(item.invoice_amount).toFixed(2)}</span>}
                </div>
              )}
            </div>
          )}
          {hasTabs && activeTab === "updates" && updatePanel}
        </div>
      )}
    </div>
  );
}

/**
 * Per-item Updates panel registry. Keyed by item_key so each delivered item
 * can surface a custom visual for what shipped after the initial invoice
 * (without editing the generic DeliveredCard render). Keep panels compact +
 * visual — Jaime reads this, not a wall of text.
 */
const ITEM_UPDATE_PANELS: Record<string, React.ReactNode> = {
  "item-02-expenses": <Item2ExpenseUpdates />,
};

/**
 * Collapsible "Discovery + Plan" section inside a DeliveredCard. Used by
 * items that shipped with a heavy discovery doc (currently just Item 7).
 * For item-07-scoping renders the rich purpose-built React component the
 * Ongoing card already uses; otherwise falls back to the raw markdown.
 */
function DeliveredDiscoverySection({ itemKey, markdown }: { itemKey: string; markdown: string }) {
  const [open, setOpen] = useState(false);
  const Rich = RICH_DISCOVERY_COMPONENTS[itemKey];
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left bg-muted/20 hover:bg-muted/30 transition-colors text-[11px] font-medium text-foreground"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        Discovery + Plan
        <span className="ml-auto text-[10px] text-muted-foreground italic">full findings doc</span>
      </button>
      {open && (
        Rich ? (
          <div className="border-t border-border/50">
            <Rich />
          </div>
        ) : (
          <div className="border-t border-border/50 bg-background/60 px-4 py-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed text-foreground/90 max-h-96 overflow-y-auto">
            {markdown}
          </div>
        )
      )}
    </div>
  );
}

/* ── Above & Beyond tab ── */

// Rich line item: when a description starts with "★ Title\nBody...", we
// render it as a "featured" headliner (large title, body paragraph,
// optional "Why it matters" callout). Otherwise it's a compact row.
function parseLine(description: string): {
  featured: boolean;
  title: string;
  body: string;
  whyItMatters: string | null;
} {
  if (!description.startsWith("★ ")) {
    return { featured: false, title: description, body: "", whyItMatters: null };
  }
  // Strip the star prefix, split title from rest at first newline
  const stripped = description.slice(2);
  const firstNewline = stripped.indexOf("\n");
  const title = firstNewline >= 0 ? stripped.slice(0, firstNewline).trim() : stripped.trim();
  const rest = firstNewline >= 0 ? stripped.slice(firstNewline + 1).trim() : "";

  // Look for "Why it matters: ..." marker as the last paragraph
  // (lower-case s flag → use [\s\S] for cross-line match instead)
  const whyMatch = rest.match(/(?:^|\n)Why it matters:\s*([\s\S]+?)$/i);
  const whyItMatters = whyMatch ? whyMatch[1].trim() : null;
  const body = whyMatch ? rest.slice(0, whyMatch.index).trim() : rest;

  return { featured: true, title, body, whyItMatters };
}

function AboveAndBeyondTab() {
  const { data: items, isLoading } = useDeliverableItemsWithLines("above_beyond");

  if (isLoading) {
    return <div className="text-xs text-muted-foreground px-3 py-4">Loading above-and-beyond items…</div>;
  }
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-sky-400/60 mb-2" />
        <p className="text-sm text-foreground font-medium">No above-and-beyond items yet.</p>
      </div>
    );
  }

  // Flatten ALL lines from ALL items into one big list, preserve original order
  const allLines = items.flatMap((item) => item.deliverable_invoice_lines);
  const parsedLines = allLines.map((l) => ({ id: l.id, ...parseLine(l.description) }));
  const featuredCount = parsedLines.filter((l) => l.featured).length;
  const compactCount = parsedLines.length - featuredCount;

  // Pull scope_md from the master item for the banner blurb
  const masterItem = items[0];

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="rounded-lg border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-sky-500/5 px-5 py-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-sky-300">Above and Beyond</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Work delivered <span className="text-foreground font-medium">at no additional charge</span> on top of
              the agreed phase and item scopes. Featured items below are the big new surfaces or capabilities; the
              compact rows below those cover smaller polish, integrations, and operational improvements.
            </p>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-mono text-sky-400">
                {featuredCount} featured
              </span>
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 font-mono text-sky-400/80">
                {compactCount} more
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-emerald-400">
                Net cost to you: $0
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Featured items */}
      <div className="space-y-3">
        {parsedLines.filter((l) => l.featured).map((line) => (
          <FeaturedAboveBeyondRow key={line.id} title={line.title} body={line.body} whyItMatters={line.whyItMatters} />
        ))}
      </div>

      {/* Compact items */}
      {compactCount > 0 && (
        <div className="rounded-lg border border-sky-500/20 bg-card overflow-hidden">
          <div className="border-b border-sky-500/20 bg-sky-500/5 px-4 py-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-sky-400">
              Plus {compactCount} more
            </h4>
          </div>
          <ul className="divide-y divide-border">
            {parsedLines.filter((l) => !l.featured).map((line) => (
              <li key={line.id} className="flex gap-2 px-4 py-2 text-xs text-foreground/85 leading-relaxed">
                <Sparkles className="h-3 w-3 shrink-0 mt-0.5 text-sky-400/60" />
                <span>{line.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer attribution from master item */}
      {masterItem?.scope_md && (
        <div className="rounded-md border border-border/40 bg-card/40 px-4 py-3 text-[11px] text-muted-foreground leading-relaxed italic">
          {masterItem.scope_md}
        </div>
      )}
    </div>
  );
}

function FeaturedAboveBeyondRow({
  title,
  body,
  whyItMatters,
}: {
  title: string;
  body: string;
  whyItMatters: string | null;
}) {
  return (
    <div className="rounded-lg border border-sky-500/30 bg-gradient-to-br from-sky-500/[0.06] to-transparent px-5 py-4">
      <div className="flex items-start gap-3">
        <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-sky-400" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          {body && <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{body}</p>}
          {whyItMatters && (
            <div className="mt-2.5 rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400 shrink-0 mt-0.5">
                  Why it matters
                </span>
                <p className="text-xs text-foreground/85 leading-relaxed">{whyItMatters}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Ongoing Work tab ── */

// Stable empty-array reference so cards with no questions don't see their
// `questions` prop change identity on every parent render. Critical for
// React.memo on OngoingCard to actually skip re-renders.
const NO_QUESTIONS: DeliverableQuestionRow[] = [];

function OngoingWorkTab({ canEdit, editorEmail }: { canEdit: boolean; editorEmail: string | null }) {
  const { data: items, isLoading } = useDeliverableItems("ongoing");
  const { data: questions } = useAllQuestions();

  // Memoize the per-item questions index so the map (and its arrays)
  // keep stable references across renders. Without this, every render
  // creates new array instances → all OngoingCards re-render even with
  // React.memo applied.
  const questionsByItem = useMemo(() => {
    const m = new Map<string, DeliverableQuestionRow[]>();
    for (const q of questions ?? []) {
      const arr = m.get(q.item_id) ?? [];
      arr.push(q);
      m.set(q.item_id, arr);
    }
    return m;
  }, [questions]);

  if (isLoading) return <div className="text-xs text-muted-foreground px-3 py-4">Loading ongoing items…</div>;
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card/40 px-4 py-6 text-center">
        <FileText className="mx-auto h-6 w-6 text-muted-foreground/60 mb-2" />
        <p className="text-sm text-foreground font-medium">No ongoing items yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Items 7 (Scope + Data Discovery), 8 (Unit Data Ingest), 9 (Invoicing), 10 (Other Data Ingest), 11 (Archive Analytics) will land here.
          Content seeds in after the UI review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Column header — mirrors the grid in OngoingCard's collapsed row
          so each item in flight reads as a table row at a glance:
          Item (+ subtitle) | Due Date | Invoice | State | Status */}
      <div className={`${ONGOING_ROW_GRID} items-center px-4 py-2 rounded-t-lg border border-border bg-muted/40 border-b-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground`}>
        <span>Item</span>
        <span>Item Due</span>
        <span>1st ½</span>
        <span>2nd ½</span>
        <span>State</span>
        <span>Status</span>
      </div>
      <div className="space-y-2 pt-2">
        {items.map((item) => (
          <OngoingCard
            key={item.id}
            item={item}
            questions={questionsByItem.get(item.id) ?? NO_QUESTIONS}
            canEdit={canEdit}
            editorEmail={editorEmail}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Shared grid template so the Ongoing Work column header and each card's
 * collapsed row line up perfectly. Five columns:
 *   Item (title + subtitle)  →  flexes
 *   Due Date                 →  100px
 *   Invoice status           →  90px
 *   State (status badge)     →  100px
 *   Status (open-Q / health) →  110px
 */
// Six columns: Item (flex), Item Due (90px), 1st ½ (110px — chip + Sent? button),
// 2nd ½ (110px — same), State (90px), Status (110px). Slightly tighter than the
// 5-col version it replaces — the per-half columns trade a bit of width for the
// inline action button room.
const ONGOING_ROW_GRID = "grid grid-cols-[minmax(0,1fr)_90px_110px_110px_90px_110px] gap-3";

/**
 * Invoice chip lookup — DB `invoice_status` value → at-a-glance label + color.
 *
 * Covers two flows:
 *   One-shot hourly items: pending → sent → paid    (Item 7 pattern)
 *   Half-up-front items:   pending → kickoff_due → kickoff_paid → final_due → paid
 *
 * Label convention: "DUE" variants always mean "Jaime owes money NOW" and
 * lean warm (amber/red). "PAID" variants are green. Blue = in-flight mid-item.
 * Unknown values fall through to a muted em-dash in the render site.
 */
const INVOICE_CHIP: Record<string, { label: string; cls: string }> = {
  // Per-half lifecycle (used by invoice_kickoff_status + invoice_final_status)
  pending: { label: "PENDING", cls: "text-muted-foreground bg-muted/50" },
  due: { label: "DUE", cls: "text-amber-400 bg-amber-500/15" },
  sent: { label: "SENT", cls: "text-blue-400 bg-blue-500/15" },
  paid: { label: "PAID", cls: "text-green-400 bg-green-500/15" },
  // Legacy single-state values (used by the deprecated invoice_status field
  // in the Invoice sub-tab inside an item card). Kept so existing rows don't
  // break their meta-chip render.
  kickoff_due: { label: "½ DUE", cls: "text-amber-400 bg-amber-500/15" },
  kickoff_paid: { label: "½ PAID", cls: "text-blue-400 bg-blue-500/15" },
  final_due: { label: "FINAL DUE", cls: "text-red-400 bg-red-500/15" },
};

/** Format a due_date as "Apr 30" or "—" if null. Soft, not urgent. */
function formatDue(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Per-half invoice cell — chip + inline action button.
 *
 * The action button is the heart of the "Sent?" UX Bees built for. When
 * an invoice half is in `due` status, Jaime (or Bees) clicks the button,
 * confirms the popup, and the half flips to `sent`. Once `sent`, the
 * button changes to "Paid?" so Bees can close the loop when the wire
 * lands.
 *
 * Rendered inside the Ongoing Work row collapsed view. The cell sits
 * inside a button (the row toggle), so the action button uses a click
 * handler with stopPropagation so clicking it doesn't also expand the
 * card. The confirmation popup uses window.confirm — fast to ship,
 * fine for this volume of clicks. Upgrade to a styled modal if it
 * becomes annoying.
 */
function InvoiceHalfCell({
  itemId,
  half,
  chip,
  canEdit,
  actorEmail,
}: {
  itemId: string;
  half: "kickoff" | "final";
  chip: { label: string; cls: string } | null;
  canEdit: boolean;
  actorEmail: string | null;
}) {
  const queryClient = useQueryClient();
  const status = chip?.label.toLowerCase() ?? null;

  // Routes through /api/tracker/invoice-action so the change gets:
  //   - logged to deliverable_invoice_log
  //   - announced via Telegram (TG_UPDATES_CHAT_ID) when actor != Bees
  // See app/api/tracker/invoice-action/route.ts.
  const updateMutation = useMutation({
    mutationFn: async (newStatus: "sent" | "paid") => {
      const res = await fetch("/api/tracker/invoice-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          half,
          newStatus,
          actorEmail,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "invoice-action failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DELIVERABLES_QUERY_KEY });
    },
  });

  // No status loaded — render em-dash (one-shot kickoff or fresh item)
  if (!chip) {
    return <span className="justify-self-start text-[11px] text-muted-foreground">—</span>;
  }

  const handleSent = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.confirm("Payment sent? This marks the invoice as PAID (awaiting receipt).")) {
      updateMutation.mutate("sent");
    }
  };

  const handlePaid = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.confirm("Payment received? This closes out this half of the invoice.")) {
      updateMutation.mutate("paid");
    }
  };

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${chip.cls}`}
      >
        {chip.label}
      </span>
      {canEdit && status === "due" && (
        <button
          type="button"
          onClick={handleSent}
          disabled={updateMutation.isPending}
          className="text-[10px] font-medium text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline disabled:opacity-50"
          title="Mark as sent (Jaime confirms payment is on the way)"
        >
          Sent?
        </button>
      )}
      {canEdit && status === "sent" && (
        <button
          type="button"
          onClick={handlePaid}
          disabled={updateMutation.isPending}
          className="text-[10px] font-medium text-green-400 hover:text-green-300 underline-offset-2 hover:underline disabled:opacity-50"
          title="Mark as paid (Bees confirms wire received)"
        >
          Paid?
        </button>
      )}
    </div>
  );
}

// Memoize the OngoingCard — without this every parent render redraws all
// ~11 cards which cascades through their nested InvoiceHalfCell + Section
// children. With memo + the stable questions reference above, only the
// card whose props actually changed re-renders.
const OngoingCard = memo(function OngoingCard({ item, questions, canEdit, editorEmail }: {
  item: DeliverableItemRow;
  questions: DeliverableQuestionRow[];
  canEdit: boolean;
  editorEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<"scope" | "build" | "discovery" | "questions" | "decisions" | "invoice">("scope");
  const openQs = questions.filter((q) => q.status === "open").length;
  const answeredQs = questions.filter((q) => q.status === "answered");
  const hasDiscovery = !!item.discovery_plan_md || item.item_key in RICH_DISCOVERY_COMPONENTS;
  const hasDecisions = answeredQs.length > 0;
  const statusCls = {
    active: "text-green-400 bg-green-500/15",
    pending: "text-yellow-400 bg-yellow-500/15",
    blocked: "text-orange-400 bg-orange-500/15",
    future: "text-purple-400 bg-purple-500/15",
    "bid-pending": "text-blue-400 bg-blue-500/15",
    delivered: "text-green-400 bg-green-500/15",
    live: "text-blue-400 bg-blue-500/15",
  }[item.status as string] ?? "text-muted-foreground bg-muted/50";

  // Per-half invoice chips — kickoff (1st ½) and final (2nd ½). Each
  // independently tracks pending → due → sent → paid.
  // NULL = N/A (one-shot items skip the kickoff half) → renders as em-dash.
  const kickoffChip = item.invoice_kickoff_status
    ? INVOICE_CHIP[item.invoice_kickoff_status] ?? { label: item.invoice_kickoff_status, cls: "text-muted-foreground bg-muted/50" }
    : null;
  const finalChip = item.invoice_final_status
    ? INVOICE_CHIP[item.invoice_final_status] ?? { label: item.invoice_final_status, cls: "text-muted-foreground bg-muted/50" }
    : null;

  // Health chip for the Status column. Open questions is the primary signal
  // (matches how Bees already thinks about "blocked by open questions").
  // Falls back to the health_status DB field if set, otherwise "✓ ready".
  const statusChip = openQs > 0
    ? { label: `${openQs} open Q`, cls: "text-orange-400 bg-orange-500/15" }
    : item.health_status === "blocked"
      ? { label: "Blocked", cls: "text-red-400 bg-red-500/15" }
      : item.health_status === "needs_input"
        ? { label: "Needs input", cls: "text-amber-400 bg-amber-500/15" }
        : item.health_status === "at_risk"
          ? { label: "At risk", cls: "text-amber-400 bg-amber-500/15" }
          : { label: "✓ ready", cls: "text-green-400 bg-green-500/15" };

  return (
    <div
      className={`rounded-lg overflow-hidden ${
        item.is_in_flight
          ? // In-flight glow: primary-tinted ring + soft pulsing border so
            // Jaime's eye lands on what's actively being worked on. One
            // item carries this at a time (DB unique partial index).
            "border border-primary/60 bg-card/40 shadow-[0_0_18px_rgba(34,197,94,0.25)] ring-1 ring-primary/30"
          : "border border-border bg-card/40"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${ONGOING_ROW_GRID} w-full items-center px-4 py-3 ${
          item.is_in_flight ? "bg-primary/5" : "bg-muted/30"
        } text-left hover:bg-muted/40 transition-colors`}
      >
        {/* Item column — chevron + icon + title + subtitle */}
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <Package className={`h-4 w-4 shrink-0 ${item.is_in_flight ? "text-primary animate-pulse" : "text-primary"}`} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
              {item.title}
              {item.is_in_flight && (
                <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider shrink-0">
                  in flight
                </span>
              )}
            </span>
            {item.subtitle && <span className="text-[10px] text-muted-foreground italic truncate">{item.subtitle}</span>}
          </div>
        </div>
        {/* Item Due — soft target ship date for Bees' pacing, "—" when unset */}
        <span className="text-[11px] font-mono text-muted-foreground">
          {formatDue(item.due_date)}
        </span>
        {/* 1st ½ — kickoff invoice status + Sent? / Paid? action button */}
        <InvoiceHalfCell itemId={item.id} half="kickoff" chip={kickoffChip} canEdit={canEdit} actorEmail={editorEmail} />
        {/* 2nd ½ — final/delivery invoice status + Sent? / Paid? action button */}
        <InvoiceHalfCell itemId={item.id} half="final" chip={finalChip} canEdit={canEdit} actorEmail={editorEmail} />
        {/* State — item.status (existing values: active/pending/future/blocked/bid-pending/delivered/live) */}
        <span className={`justify-self-start inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusCls}`}>
          {item.status}
        </span>
        {/* Status — open-Q count or health flag */}
        <span className={`justify-self-start inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusChip.cls}`}>
          {statusChip.label}
        </span>
      </button>
      {open && (
      <>
      {/* Section tabs inside the card */}
      <div className="flex gap-1 px-3 py-2 bg-muted/10 border-t border-b border-border/50">
        {([
          { key: "scope" as const, label: "Scope" },
          { key: "build" as const, label: "Build Notes" },
          ...(hasDiscovery ? [{ key: "discovery" as const, label: "Discovery + Plan" }] : []),
          { key: "questions" as const, label: `Questions${openQs > 0 ? ` (${openQs})` : ""}` },
          ...(hasDecisions ? [{ key: "decisions" as const, label: `Decisions (${answeredQs.length})` }] : []),
          { key: "invoice" as const, label: "Invoice" },
        ]).map((s) => {
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                section === s.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {section === "scope" && (
        <div className="space-y-3">
          {/* Bid price strip — visible BEFORE invoice exists, so the
              agreed dollar amount is always one click away from the
              card. Only renders when bid_price_cents is set. */}
          {item.bid_price_cents != null && (
            <div className="px-4 pt-3">
              <BidPriceStrip
                priceCents={item.bid_price_cents}
                status={item.bid_status}
              />
            </div>
          )}
          <div className="px-4 py-3 text-[11px] text-foreground whitespace-pre-wrap leading-relaxed">
            {item.scope_md || <span className="text-muted-foreground italic">No scope written yet.</span>}
          </div>
        </div>
      )}
      {section === "build" && (
        <div className="px-4 py-3 text-[11px] text-foreground whitespace-pre-wrap leading-relaxed bg-muted/10">
          {item.build_notes_md || <span className="text-muted-foreground italic">No build notes yet.</span>}
        </div>
      )}
      {section === "discovery" && hasDiscovery && (() => {
        const Rich = RICH_DISCOVERY_COMPONENTS[item.item_key];
        if (Rich) return <Rich />;
        return (
          <div className="px-4 py-3 text-[11px] text-foreground whitespace-pre-wrap leading-relaxed bg-muted/5">
            {item.discovery_plan_md}
          </div>
        );
      })()}
      {section === "questions" && (
        <QuestionList item={item} questions={questions} editorEmail={editorEmail} hideResolvedArchive={hasDecisions} />
      )}
      {section === "decisions" && hasDecisions && (
        <DecisionsList answered={answeredQs} editorEmail={editorEmail} />
      )}
      {section === "invoice" && <InvoicePanel item={item} />}
      </>
      )}
    </div>
  );
});

/**
 * Standardized Invoice panel — shared across every ongoing item's Invoice tab
 * AND future use in delivered cards. Looks identical for every item so Jaime
 * always knows where to find the number, status, and Download button.
 *
 * States:
 *   - invoice_drive_file_id set      → Download button (admin streams via
 *                                       /api/tracker/drive/[fileId])
 *   - pending + notes_md             → shows the notes inline, no download yet
 *   - no notes, no file              → "Invoice will appear here once issued"
 *
 * The three meta chips (#, Amount, Status) render at the bottom if any are set.
 */
function InvoicePanel({ item }: { item: DeliverableItemRow }) {
  const kickoffFileId = item.invoice_drive_file_id;
  const finalFileId = item.invoice_final_drive_file_id;
  const chip = INVOICE_CHIP[item.invoice_status as string] ?? { label: "—", cls: "text-muted-foreground bg-muted/50" };

  // Half-and-half lifecycle: render BOTH docs side-by-side once the End
  // 1/2 is issued. Kickoff stays around so Bees can show the customer
  // both halves at any point. Single-shot items (only kickoff doc) keep
  // the old single-card layout.
  const isHalfPair = !!(kickoffFileId && finalFileId);
  const kickoffStatus = item.invoice_kickoff_status;
  const finalStatus = item.invoice_final_status;

  return (
    <div className="px-4 py-4 space-y-3 text-[11px] text-foreground leading-relaxed">
      {isHalfPair ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <InvoiceDocCard
            label="Start 1/2 — Kickoff"
            fileId={kickoffFileId!}
            status={kickoffStatus}
          />
          <InvoiceDocCard
            label="End 1/2 — Delivery"
            fileId={finalFileId!}
            status={finalStatus}
          />
        </div>
      ) : kickoffFileId ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-green-400 shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-foreground">Invoice ready</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {item.invoice_notes_md || "Invoice issued. Click to download the PDF."}
              </div>
            </div>
            <a
              href={`/api/tracker/drive/${kickoffFileId}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
            >
              <FileText className="h-3 w-3" />
              Download
            </a>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          {item.invoice_notes_md ? (
            <div className="whitespace-pre-wrap text-muted-foreground">{item.invoice_notes_md}</div>
          ) : (
            <div className="text-muted-foreground italic">Invoice will appear here once issued.</div>
          )}
        </div>
      )}

      {/* Notes (kept under the doc grid for half-pairs so the grid leads) */}
      {isHalfPair && item.invoice_notes_md && (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 whitespace-pre-wrap text-muted-foreground">
          {item.invoice_notes_md}
        </div>
      )}

      {/* Meta chips — number, amount, status */}
      {(item.invoice_number || item.invoice_amount || item.invoice_status) && (
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          {item.invoice_number && (
            <span className="rounded border border-border/50 bg-card/50 px-2 py-0.5">
              <span className="text-muted-foreground">Invoice #</span>{" "}
              <span className="font-mono text-foreground">{item.invoice_number}</span>
            </span>
          )}
          {item.invoice_amount != null && (
            <span className="rounded border border-border/50 bg-card/50 px-2 py-0.5">
              <span className="text-muted-foreground">Amount</span>{" "}
              <span className="font-mono text-foreground">${Number(item.invoice_amount).toFixed(2)}</span>
            </span>
          )}
          {item.invoice_status && (
            <span className={`rounded border border-border/50 px-2 py-0.5 uppercase font-semibold ${chip.cls}`}>
              {chip.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Bid price + status strip — surfaces the agreed dollar amount on
 * the Scope tab BEFORE an invoice exists. Once an invoice ships, the
 * strip stays for historical reference (the bid is a frozen number,
 * not a draft). Renders at the top of the Scope tab as a compact pill
 * row so the price is the first thing visible after clicking in.
 */
const BID_STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  proposed: { label: "PROPOSED", cls: "text-amber-400 bg-amber-500/15" },
  approved: { label: "APPROVED", cls: "text-green-400 bg-green-500/15" },
  rejected: { label: "REJECTED", cls: "text-rose-400 bg-rose-500/15" },
};

function BidPriceStrip({
  priceCents,
  status,
}: {
  priceCents: number;
  status: string | null | undefined;
}) {
  // Bid is in cents to avoid float drift; format on render.
  const dollars = priceCents / 100;
  const formatted = dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const chip = status ? BID_STATUS_CHIP[status] : null;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Bid Price
        </div>
        <div className="font-mono text-sm font-semibold text-foreground">
          {formatted}
        </div>
      </div>
      {chip && (
        <span className={`rounded border border-border/50 px-2 py-0.5 text-[10px] uppercase font-semibold ${chip.cls}`}>
          {chip.label}
        </span>
      )}
    </div>
  );
}

/**
 * Single invoice doc card — used in pairs by InvoicePanel for half-and-half
 * lifecycle items (Start 1/2 kickoff + End 1/2 delivery side by side).
 */
function InvoiceDocCard({
  label,
  fileId,
  status,
}: {
  label: string;
  fileId: string;
  status: string | null | undefined;
}) {
  const chip = status
    ? INVOICE_CHIP[status] ?? { label: status.toUpperCase(), cls: "text-muted-foreground bg-muted/50" }
    : null;
  // PAID is the resting state — green border. Anything else (DUE, SENT,
  // PENDING) gets a softer accent so the eye lands on the active half.
  const isPaid = status === "paid";
  return (
    <div
      className={`rounded-lg border p-3 ${
        isPaid
          ? "border-green-500/30 bg-green-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <FileText className={`h-4 w-4 shrink-0 mt-0.5 ${isPaid ? "text-green-400" : "text-amber-400"}`} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-foreground">{label}</div>
          {chip && (
            <span className={`mt-1 inline-block rounded border border-border/50 px-1.5 py-0.5 text-[9px] uppercase font-semibold ${chip.cls}`}>
              {chip.label}
            </span>
          )}
        </div>
      </div>
      <a
        href={`/api/tracker/drive/${fileId}`}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <FileText className="h-3 w-3" />
        Download
      </a>
    </div>
  );
}

/* ── Question list + answer form (shared between item card + Questions tab) ── */

function QuestionList({ item, questions, editorEmail, hideResolvedArchive = false }: {
  item: DeliverableItemRow;
  questions: DeliverableQuestionRow[];
  editorEmail: string | null;
  // When the parent card surfaces a separate "Decisions" tab, the resolved
  // archive renders there instead — drop it here to avoid duplication.
  hideResolvedArchive?: boolean;
}) {
  // Split open vs resolved — Jaime only wants to see what needs his input
  // by default. Resolved questions are collapsed at the bottom so the
  // historical context is still a click away without cluttering the form.
  const { openGrouped, resolved } = useMemo(() => {
    const open = questions.filter((q) => q.status !== "answered");
    const done = questions.filter((q) => q.status === "answered");
    const m = new Map<string, DeliverableQuestionRow[]>();
    for (const q of open) {
      const cat = q.category ?? "General";
      const arr = m.get(cat) ?? [];
      arr.push(q);
      m.set(cat, arr);
    }
    return { openGrouped: [...m.entries()], resolved: done };
  }, [questions]);

  const [showResolved, setShowResolved] = useState(false);

  if (questions.length === 0) {
    return <div className="px-4 py-3 text-[11px] text-muted-foreground italic">No questions on this item.</div>;
  }

  return (
    <div>
      {/* Open questions, grouped by category */}
      {openGrouped.length > 0 ? (
        <div className="divide-y divide-border/50">
          {openGrouped.map(([cat, qs]) => (
            <div key={cat} className="px-4 py-3">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</div>
              <div className="space-y-3">
                {qs.map((q) => (
                  <QuestionRow key={q.id} question={q} editorEmail={editorEmail} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-green-400/70 mb-1.5" />
          <div className="text-[11px] text-muted-foreground">All questions answered.</div>
        </div>
      )}

      {/* Resolved archive — collapsed by default. Skipped when the card
          has a dedicated Decisions tab (resolved questions render there). */}
      {!hideResolvedArchive && resolved.length > 0 && (
        <div className="border-t border-border/50 bg-muted/10">
          <button
            type="button"
            onClick={() => setShowResolved(!showResolved)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-muted/20 transition-colors"
          >
            {showResolved ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400/60" />
            <span className="text-[11px] font-medium text-muted-foreground">
              Resolved ({resolved.length})
            </span>
            <span className="text-[10px] text-muted-foreground/70 italic">
              answered — click to show the history
            </span>
          </button>
          {showResolved && (
            <div className="divide-y divide-border/50">
              {resolved.map((q) => (
                <div key={q.id} className="px-4 py-3">
                  {q.category && (
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{q.category}</div>
                  )}
                  <QuestionRow question={q} editorEmail={editorEmail} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Decisions tab — renders the answered questions as a curated archive of
 * "things we've already decided / locked in". Same QuestionRow component
 * as the Questions tab, but always-visible and grouped by category. The
 * Questions tab hides its collapsed-archive when this tab is shown so
 * the resolved items only live in one place.
 */
function DecisionsList({ answered, editorEmail }: {
  answered: DeliverableQuestionRow[];
  editorEmail: string | null;
}) {
  const grouped = useMemo(() => {
    const m = new Map<string, DeliverableQuestionRow[]>();
    for (const q of answered) {
      const cat = q.category ?? "General";
      const arr = m.get(cat) ?? [];
      arr.push(q);
      m.set(cat, arr);
    }
    return [...m.entries()];
  }, [answered]);

  if (answered.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <CheckCircle2 className="mx-auto h-5 w-5 text-muted-foreground/40 mb-1.5" />
        <div className="text-[11px] text-muted-foreground italic">No decisions locked yet — they show up here once Jaime answers.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 py-2.5 border-b border-border/50 bg-green-500/5 flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-400/70" />
        <span className="text-[11px] text-foreground">
          Locked-in answers and agreed approach for this item — kept visible so we don't re-litigate.
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {grouped.map(([cat, qs]) => (
          <div key={cat} className="px-4 py-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</div>
            <div className="space-y-3">
              {qs.map((q) => (
                <QuestionRow key={q.id} question={q} editorEmail={editorEmail} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// memo + custom compare → sibling rows never re-render on another row's
// keystroke. Only re-renders when this question's data or editor email
// actually changes. This alone fixed the typing freeze on 2026-04-24.
const QuestionRow = memo(function QuestionRow({ question, editorEmail }: {
  question: DeliverableQuestionRow;
  editorEmail: string | null;
}) {
  const [draft, setDraft] = useState(question.answer_md ?? "");
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (markAnswered: boolean) => {
      const { error } = await supabase
        .from("deliverable_questions")
        .update({
          answer_md: draft || null,
          answered_by: editorEmail,
          answered_at: draft ? new Date().toISOString() : null,
          status: markAnswered ? "answered" : "open",
        })
        .eq("id", question.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUESTIONS_QUERY_KEY }),
  });

  const statusDot = question.status === "answered"
    ? "bg-green-400"
    : question.status === "dismissed"
      ? "bg-muted"
      : "bg-orange-400";

  // Split question_md on first blank line: main question + optional subtext/hint
  const parts = (question.question_md ?? "").split(/\n\s*\n/);
  const mainQ = parts[0].trim();
  const subtext = parts.slice(1).join("\n\n").trim();

  return (
    <div className="flex gap-3">
      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${statusDot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-foreground leading-relaxed font-medium whitespace-pre-wrap">{mainQ}</p>
        {subtext && (
          <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{subtext}</p>
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={question.status === "answered" ? "(answer saved — edit to update)" : "Type your answer…"}
          rows={2}
          className="mt-2 w-full text-[11px] rounded border border-border bg-background px-2 py-1.5 text-foreground focus:border-primary focus:outline-none resize-y"
        />
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          <button
            type="button"
            onClick={() => saveMutation.mutate(false)}
            className="px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            disabled={saveMutation.isPending}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate(true)}
            className="px-2 py-0.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
            disabled={saveMutation.isPending || !draft}
          >
            {question.status === "answered" ? "Update + mark answered" : "Save + mark answered"}
          </button>
          {question.answered_at && (
            <span className="text-muted-foreground italic">
              answered {new Date(question.answered_at).toLocaleDateString()}
              {question.answered_by ? ` by ${question.answered_by}` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

/* Collapsible per-item group used inside the Questions tab */
function QuestionsItemGroup({ item, questions, editorEmail }: {
  item: DeliverableItemRow;
  questions: DeliverableQuestionRow[];
  editorEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const openCount = questions.filter((q) => q.status === "open").length;
  return (
    <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/50 text-left hover:bg-muted/40 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <Package className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">{item.title}</span>
        <span className="ml-auto flex items-center gap-2 text-[10px]">
          {openCount > 0 && (
            <span className="rounded-full px-2 py-0.5 font-medium text-orange-400 bg-orange-500/15">{openCount} open</span>
          )}
          <span className="text-muted-foreground">{questions.length} total</span>
        </span>
      </button>
      {open && <QuestionList item={item} questions={questions} editorEmail={editorEmail} />}
    </div>
  );
}

/* ── Questions tab — cross-item pool ── */

function QuestionsTab({ canEdit: _canEdit, editorEmail }: { canEdit: boolean; editorEmail: string | null }) {
  const { data: items } = useDeliverableItems("ongoing");
  const { data: questions, isLoading } = useAllQuestions();
  const [filter, setFilter] = useState<"open" | "all">("open");

  if (isLoading) return <div className="text-xs text-muted-foreground px-3 py-4">Loading questions…</div>;
  if (!questions || questions.length === 0) {
    return (
      <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-6 text-center">
        <HelpCircle className="mx-auto h-6 w-6 text-orange-400/60 mb-2" />
        <p className="text-sm text-foreground font-medium">No open questions yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Questions from each ongoing item (Scope, Data model, Workflow, etc.) pool here so you can answer them in one place.
        </p>
      </div>
    );
  }

  const itemsById = new Map((items ?? []).map((i) => [i.id, i]));
  const filtered = filter === "open" ? questions.filter((q) => q.status === "open") : questions;
  const openCount = questions.filter((q) => q.status === "open").length;
  const answeredCount = questions.filter((q) => q.status === "answered").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-border bg-card text-[10px]">
          <button
            type="button"
            onClick={() => setFilter("open")}
            className={`px-2.5 py-1 font-medium transition-colors ${
              filter === "open" ? "bg-orange-500/10 text-orange-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Open ({openCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 font-medium transition-colors ${
              filter === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({questions.length})
          </button>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {answeredCount} answered
        </span>
      </div>
      {/* Group by item */}
      <div className="space-y-3">
        {(items ?? []).map((item) => {
          const itemQs = filtered.filter((q) => q.item_id === item.id);
          if (itemQs.length === 0) return null;
          return (
            <QuestionsItemGroup
              key={item.id}
              item={item}
              questions={itemQs}
              editorEmail={editorEmail}
            />
          );
        })}
        {/* Questions whose item isn't in the current ongoing set — shouldn't happen often */}
        {filtered.filter((q) => !itemsById.has(q.item_id)).length > 0 && (
          <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Unlinked</div>
            {filtered
              .filter((q) => !itemsById.has(q.item_id))
              .map((q) => (
                <QuestionRow key={q.id} question={q} editorEmail={editorEmail} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main panel ── */
type TabKey = "backlog" | "delivered" | "above_beyond" | "ongoing" | "questions";

/**
 * editorEmailOverride lets a parent (e.g. the main app's Work Tracker
 * page) inject the current user's email instead of the standalone
 * /tracker auth context. When provided, we skip useTrackerAuth entirely
 * — useful when this panel is embedded in a context where TrackerAuthProvider
 * isn't mounted (the main forestry app's /work-tracker page).
 */
export function TrackerDeliverablesPanel({
  editorEmailOverride,
}: { editorEmailOverride?: string | null } = {}) {
  // Default landing = Ongoing Work. That's what's in flight and most actionable.
  // Phase 1 + Phase 1.5 tabs removed — content moved into Delivered as their
  // own cards (phase-1-bid + phase-1-extras) per the 2026-04-24 overhaul.
  const [activeTab, setActiveTab] = useState<TabKey>("ongoing");
  const trackerAuth = useTrackerAuth();
  const editorEmail =
    editorEmailOverride !== undefined
      ? editorEmailOverride
      : trackerAuth.profile?.email ?? null;
  const canEdit = EDITORS.includes(editorEmail ?? "");

  const tabs: { key: TabKey; label: string; icon?: React.ReactNode; accent: string }[] = [
    { key: "backlog", label: "Backlog", icon: <Layers className="mr-1.5 inline h-3 w-3" />, accent: "bg-purple-500/10 text-purple-400" },
    { key: "delivered", label: "Delivered", icon: <Truck className="mr-1.5 inline h-3 w-3" />, accent: "bg-green-500/10 text-green-400" },
    { key: "above_beyond", label: "Above & Beyond", icon: <Sparkles className="mr-1.5 inline h-3 w-3" />, accent: "bg-sky-500/10 text-sky-400" },
    { key: "ongoing", label: "Ongoing Work", icon: <FileText className="mr-1.5 inline h-3 w-3" />, accent: "bg-primary/10 text-primary" },
    { key: "questions", label: "Questions", icon: <HelpCircle className="mr-1.5 inline h-3 w-3" />, accent: "bg-orange-500/10 text-orange-400" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-border bg-card">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === t.key ? t.accent : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        {canEdit && (
          <span className="text-[10px] text-muted-foreground italic">Editor mode — priorities, answers + content editable</span>
        )}
      </div>

      {activeTab === "backlog" && <BacklogSection canEdit={canEdit} editorEmail={editorEmail} />}
      {activeTab === "delivered" && <DeliveredTab canEdit={canEdit} />}
      {activeTab === "above_beyond" && <AboveAndBeyondTab />}
      {activeTab === "ongoing" && <OngoingWorkTab canEdit={canEdit} editorEmail={editorEmail} />}
      {activeTab === "questions" && <QuestionsTab canEdit={canEdit} editorEmail={editorEmail} />}
    </div>
  );
}
