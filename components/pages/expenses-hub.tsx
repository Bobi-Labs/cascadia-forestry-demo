"use client"

/**
 * Expenses hub — single sidebar entry for both views:
 *   - Expenses (admin/owner) — analytics + spend dashboard
 *   - Expense Assignments — office triage queue for un-assigned rows
 *
 * Role behavior:
 *   admin / owner → both tabs visible in topbar, defaults to Expenses
 *   office        → only Assignments rendered, tab strip suppressed
 *                   (single-view UI; they have no spend-analytics access)
 */

import { useEffect, useState } from "react"
import { CreditCard, Receipt } from "lucide-react"
import { ExpensesPage } from "./admin-pages"
import { PendingExpensesPage } from "./pending-expenses"
import { useApp } from "@/lib/app-context"

type Tab = "expenses" | "assignments"

export function ExpensesHubPage({ defaultTab = "expenses" }: { defaultTab?: Tab }) {
  const { role, setPageTabs, t } = useApp()
  const officeOnly = role === "office"
  const initialTab: Tab = officeOnly ? "assignments" : defaultTab
  const [tab, setTab] = useState<Tab>(initialTab)

  useEffect(() => {
    if (officeOnly) {
      // Office sees a single view — no tab strip; topbar shows the
      // plain page label as usual.
      setPageTabs(null)
      return
    }
    setPageTabs({
      tabs: [
        { key: "expenses", label: t("eh_expenses"), icon: <CreditCard className="h-3.5 w-3.5" /> },
        { key: "assignments", label: t("eh_assignments"), icon: <Receipt className="h-3.5 w-3.5" /> },
      ],
      activeKey: tab,
      onSelect: (key) => setTab(key as Tab),
    })
    return () => setPageTabs(null)
  }, [tab, officeOnly, setPageTabs, t])

  if (officeOnly) return <PendingExpensesPage />
  return tab === "expenses" ? <ExpensesPage /> : <PendingExpensesPage />
}
