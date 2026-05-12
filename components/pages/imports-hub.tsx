"use client"

/**
 * Imports hub — single dashboard for every import/ingest pipeline.
 * Tab strip lives in the topbar (via pageTabs in AppContext).
 *
 * Tabs:
 *   Expenses    — Pending Expenses queue + Import-from-Sheet controls +
 *                 Recent activity / imports
 *   Units       — Pending Units queue + Run-ingest controls + Ingest
 *                 Audit log + Reset/Wipe + Exclusion picker
 *   Other Data  — placeholder for Item 10 (Contacts / Bids / Compliance
 *                 / Equipment ingest). Hidden from office.
 *
 * Role gating:
 *   admin / owner → all 3 tabs visible
 *   office        → Expenses + Units only. Each tab renders the queue
 *                   only — run controls, reset buttons, and the audit
 *                   log are admin-only inside each tab's component.
 *
 * Invoicing is intentionally NOT here — that's an export/build/send
 * flow, not an import. Lives elsewhere when Item 9 ships.
 */

import { useEffect, useState } from "react"
import { CreditCard, Layers, Database, Loader2 } from "lucide-react"
import { useApp } from "@/lib/app-context"
import { PendingExpensesPage } from "./pending-expenses"
import { PendingUnitsPage } from "./pending-units"
import { UnitIngestAuditPage } from "./unit-ingest-audit"
import {
  ImportFromSheetButton,
  RecentActivityCard,
  RecentImportsCard,
} from "./expense-shared"

type Tab = "expenses" | "units" | "other"

export function ImportsHubPage({ defaultTab = "expenses" }: { defaultTab?: Tab }) {
  const { role, setPageTabs, t } = useApp()
  const isAdmin = role === "admin" || role === "owner"
  const [tab, setTab] = useState<Tab>(defaultTab)

  useEffect(() => {
    const tabs = isAdmin
      ? [
          { key: "expenses", label: t("imp_expenses"), icon: <CreditCard className="h-3.5 w-3.5" /> },
          { key: "units", label: t("imp_units"), icon: <Layers className="h-3.5 w-3.5" /> },
          { key: "other", label: t("imp_other"), icon: <Database className="h-3.5 w-3.5" /> },
        ]
      : [
          { key: "expenses", label: t("imp_expenses"), icon: <CreditCard className="h-3.5 w-3.5" /> },
          { key: "units", label: t("imp_units"), icon: <Layers className="h-3.5 w-3.5" /> },
        ]
    setPageTabs({
      tabs,
      activeKey: tab,
      onSelect: (key) => setTab(key as Tab),
    })
    return () => setPageTabs(null)
  }, [tab, isAdmin, setPageTabs, t])

  if (tab === "expenses") return <ImportsExpensesTab isAdmin={isAdmin} />
  if (tab === "units") return <ImportsUnitsTab isAdmin={isAdmin} />
  return <OtherDataPlaceholder />
}

// ─── Units tab — Pending Units queue + Ingest Audit (admin only) ──────────
//
// Same sub-tab pattern as Expenses. Office sees only Pending Units (no
// sub-tab strip — Ingest Audit is admin/diagnostic).
function ImportsUnitsTab({ isAdmin }: { isAdmin: boolean }) {
  const [sub, setSub] = useState<"pending" | "audit">("pending")

  if (!isAdmin) return <PendingUnitsPage />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        <SubTabButton label="Pending Units" active={sub === "pending"} onClick={() => setSub("pending")} />
        <SubTabButton label="Ingest Audit" active={sub === "audit"} onClick={() => setSub("audit")} />
      </div>
      {sub === "pending" ? <PendingUnitsPage /> : <UnitIngestAuditPage />}
    </div>
  )
}

// ─── Expenses tab — Assignments queue + Reports sub-tab + Import button ───
//
// Admin sees both sub-tabs (Assignments / Reports) AND the
// Import-from-Sheet action button at top right. Office sees only
// Assignments (no sub-tab strip, no import button — read-only triage).
function ImportsExpensesTab({ isAdmin }: { isAdmin: boolean }) {
  const [sub, setSub] = useState<"assignments" | "reports">("assignments")

  if (!isAdmin) {
    return <PendingExpensesPage />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top action row — sub-tabs on the left, Import button on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
          <SubTabButton label="Assignments" active={sub === "assignments"} onClick={() => setSub("assignments")} />
          <SubTabButton label="Reports" active={sub === "reports"} onClick={() => setSub("reports")} />
        </div>
        <ImportFromSheetButton />
      </div>

      {sub === "assignments" ? (
        <PendingExpensesPage />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentActivityCard />
          <RecentImportsCard />
        </div>
      )}
    </div>
  )
}

function SubTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-elevated hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )
}

function OtherDataPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/30 p-12 text-center">
      <Database className="mx-auto h-10 w-10 text-muted-foreground/40" />
      <h3 className="mt-4 text-sm font-semibold text-foreground">Other Data Ingest</h3>
      <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground leading-relaxed">
        Generic ingest framework for Contacts, Bids, Compliance items, and
        Equipment data. Reuses the Item 8 pattern (Drive scan → format
        detect → parser → pending review → approve). Ships with Item 10.
      </p>
      <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Loader2 className="h-3 w-3" />
        Pending Item 10 build
      </div>
    </div>
  )
}
