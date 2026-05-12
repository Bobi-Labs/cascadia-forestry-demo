/**
 * Item 2 — Expenses: "Updates" visual panel.
 *
 * Shows the 2026-04-24 expense category schema expansion at a glance:
 *   - Hero stat (8 → 15 buckets)
 *   - Grouped category board (Vehicle / Travel / Supplies / Overhead) with
 *     before/after counts, row counts after, and new-bucket highlights
 *   - Fixed-items list with the specific wins (toll, airlines, rental car)
 *   - Footer showing how the 'other' catch-all shrunk
 *
 * All numbers are snapshot values from 2026-04-24 after the remap ran.
 * Baked in deliberately — this panel is a "what we did" record, not a
 * live dashboard. (The live dashboard lives on the Admin → Expenses page.)
 */

"use client";

import {
  ArrowRight,
  Sparkles,
  Car,
  Plane,
  Package,
  Briefcase,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type Bucket = {
  key: string;
  label: string;
  beforeBucket: string | null; // null = new bucket; otherwise the prior bucket
  rowsAfter: number;
  isNew: boolean;
  isRename: boolean;
};

type Group = {
  title: string;
  icon: React.ReactNode;
  accent: string;      // text color + bg tint
  buckets: Bucket[];
};

const GROUPS: Group[] = [
  {
    title: "Vehicle",
    icon: <Car className="h-3.5 w-3.5" />,
    accent: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    buckets: [
      { key: "fuel", label: "Fuel", beforeBucket: "fuel", rowsAfter: 343, isNew: false, isRename: false },
      { key: "vehicle_maintenance", label: "Vehicle Maintenance", beforeBucket: "vehicle_repair", rowsAfter: 21, isNew: false, isRename: true },
      { key: "vehicle_rental", label: "Vehicle Rental", beforeBucket: null, rowsAfter: 3, isNew: true, isRename: false },
    ],
  },
  {
    title: "Travel",
    icon: <Plane className="h-3.5 w-3.5" />,
    accent: "text-sky-300 bg-sky-500/10 border-sky-500/30",
    buckets: [
      { key: "lodging", label: "Lodging", beforeBucket: "hotel", rowsAfter: 7, isNew: false, isRename: true },
      { key: "airfare_transit", label: "Airfare & Transit", beforeBucket: null, rowsAfter: 5, isNew: true, isRename: false },
      { key: "tolls_parking", label: "Tolls & Parking", beforeBucket: null, rowsAfter: 1, isNew: true, isRename: false },
    ],
  },
  {
    title: "Supplies",
    icon: <Package className="h-3.5 w-3.5" />,
    accent: "text-green-300 bg-green-500/10 border-green-500/30",
    buckets: [
      { key: "meals", label: "Meals", beforeBucket: "food", rowsAfter: 11, isNew: false, isRename: true },
      { key: "groceries", label: "Groceries", beforeBucket: null, rowsAfter: 2, isNew: true, isRename: false },
      { key: "equipment", label: "Equipment", beforeBucket: "equipment", rowsAfter: 51, isNew: false, isRename: false },
      { key: "chainsaw", label: "Chainsaw", beforeBucket: "chainsaw", rowsAfter: 0, isNew: false, isRename: false },
      { key: "safety_gear", label: "Safety Gear", beforeBucket: "safety_gear", rowsAfter: 0, isNew: false, isRename: false },
    ],
  },
  {
    title: "Overhead",
    icon: <Briefcase className="h-3.5 w-3.5" />,
    accent: "text-violet-300 bg-violet-500/10 border-violet-500/30",
    buckets: [
      { key: "office_admin", label: "Office & Admin", beforeBucket: null, rowsAfter: 17, isNew: true, isRename: false },
      { key: "professional_services", label: "Professional Services", beforeBucket: null, rowsAfter: 5, isNew: true, isRename: false },
      { key: "fees_insurance", label: "Fees & Insurance", beforeBucket: null, rowsAfter: 4, isNew: true, isRename: false },
      { key: "other", label: "Other", beforeBucket: "other", rowsAfter: 1, isNew: false, isRename: false },
    ],
  },
];

type FixedItem = {
  vendor: string;
  amount: string;
  from: string;
  to: string;
  why: string;
};

const FIXED_ITEMS: FixedItem[] = [
  {
    vendor: "ERACTOLL 1ZCHJX",
    amount: "$14.50",
    from: "Hotels",
    to: "Tolls & Parking",
    why: "Toll was tagged as hotel because the old fallback treated 'Travel' as lodging. Flagged on the Apr 24 call.",
  },
  {
    vendor: "American Airlines",
    amount: "$1,574 across 5 charges",
    from: "Hotels",
    to: "Airfare & Transit",
    why: "Flights and hotels shared one bucket. Now separate so travel reports aren't misleading.",
  },
  {
    vendor: "Enterprise Rent-A-Car",
    amount: "$603 across 3 charges",
    from: "Hotels + Vehicle Repair",
    to: "Vehicle Rental",
    why: "Rental cars were split across two wrong buckets. Now in their own category.",
  },
  {
    vendor: "Adobe + FedEx + Amazon Prime",
    amount: "$627 across 16 charges",
    from: "Equipment",
    to: "Office & Admin",
    why: "Software subscriptions and shipping are admin, not ops equipment. Pulled out so Equipment reflects actual field gear.",
  },
  {
    vendor: "CPR + Compliance training",
    amount: "$130 across 5 charges",
    from: "Other",
    to: "Professional Services",
    why: "Training costs were hidden in 'Other'. Visible now for tax prep.",
  },
];

export function Item2ExpenseUpdates() {
  return (
    <div className="px-4 py-4 space-y-5 text-foreground">
      {/* ── Hero ── */}
      <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Update · April 24, 2026
            </div>
            <div className="text-base font-semibold text-foreground mt-0.5">
              Expense categories expanded for clearer reporting
            </div>
          </div>
          <div className="flex items-center gap-2 text-center">
            <div>
              <div className="text-2xl font-mono font-bold text-muted-foreground line-through decoration-2">
                8
              </div>
              <div className="text-[9px] uppercase text-muted-foreground">Before</div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary" />
            <div>
              <div className="text-2xl font-mono font-bold text-primary">15</div>
              <div className="text-[9px] uppercase text-muted-foreground">After</div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          Airlines were landing in Hotels. Rental cars were landing in Vehicle Repair. Tolls were landing in Hotels. Training and software were disappearing into &ldquo;Other&rdquo;. Split them up so every charge lands somewhere that matches what it actually is.
        </p>
      </div>

      {/* ── 4 category groups ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <div
            key={g.title}
            className={`rounded-lg border overflow-hidden ${g.accent.split(" ").slice(-1).join(" ")}`}
          >
            <div className={`flex items-center gap-2 px-3 py-2 ${g.accent.split(" ").slice(0, 2).join(" ")} border-b border-inherit`}>
              {g.icon}
              <span className="text-xs font-semibold uppercase tracking-wider">
                {g.title}
              </span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                {g.buckets.filter((b) => b.isNew).length} new
              </span>
            </div>
            <div className="divide-y divide-border/50 bg-card/20">
              {g.buckets.map((b) => (
                <div key={b.key} className="flex items-center gap-2 px-3 py-2">
                  {b.isNew && (
                    <Sparkles className="h-3 w-3 text-primary shrink-0" />
                  )}
                  {b.isRename && !b.isNew && (
                    <span
                      className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[8px] font-bold text-cyan-300"
                      title="Renamed for clarity"
                    >
                      ↻
                    </span>
                  )}
                  {!b.isNew && !b.isRename && (
                    <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  )}
                  <span className="text-xs text-foreground">{b.label}</span>
                  {b.isNew && (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">
                      New
                    </span>
                  )}
                  {b.isRename && (
                    <span className="text-[9px] text-muted-foreground italic">
                      was {b.beforeBucket === "vehicle_repair" ? "Vehicle Repair" : b.beforeBucket === "hotel" ? "Hotels" : "Food"}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                    {b.rowsAfter.toLocaleString()} {b.rowsAfter === 1 ? "row" : "rows"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Specific wins ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Things that moved to their right home
          </span>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/20 divide-y divide-border/50">
          {FIXED_ITEMS.map((f, i) => (
            <div key={i} className="px-3 py-2.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground">{f.vendor}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{f.amount}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-300 line-through decoration-red-400/50">
                  {f.from}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-green-300 font-medium">
                  {f.to}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{f.why}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── "Other" shrunk ── */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-300">
            The &ldquo;Other&rdquo; bucket shrunk from 12 rows to 1
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
          The only charge left in Other is a $123 Idaho.gov fee from April — probably a state permit or filing fee. Flag for the next call: Fees &amp; Insurance, Professional Services, or leave it as Other?
        </p>
      </div>

      {/* ── Open questions ── */}
      <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
          What to confirm on the next call
        </div>
        <ul className="space-y-1 text-[11px] text-foreground">
          <li className="flex gap-2">
            <span className="text-muted-foreground">·</span>
            <span>
              <span className="font-mono">Chainsaw</span> and <span className="font-mono">Safety Gear</span> buckets are empty. Do those purchases happen on cards? If yes, some are probably hiding in Equipment under Amazon / Harbor Freight and we can retag.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-muted-foreground">·</span>
            <span>Do the 15 buckets match how you think about the business? Easy to add / merge / split from here.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-muted-foreground">·</span>
            <span>Any tax-reporting categories your accountant wants that aren&rsquo;t covered?</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
