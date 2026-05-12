"use client"

/**
 * Projects hub — single sidebar entry that hosts Projects (contracts)
 * and Units. The tab strip lives in the topbar breadcrumb spot (via
 * pageTabs in AppContext) so we don't double-up vertical space inside
 * the page card.
 */

import { useEffect, useState } from "react"
import { FolderOpen, Layers } from "lucide-react"
import { ContractsPage } from "./contracts"
import { AdminUnitsPage } from "./admin-units"
import { useApp } from "@/lib/app-context"

type Tab = "projects" | "units"

export function ProjectsHubPage({ defaultTab = "projects" }: { defaultTab?: Tab }) {
  const { setPageTabs, t } = useApp()
  const [tab, setTab] = useState<Tab>(defaultTab)

  // Register tabs into the topbar. Cleared on unmount so other pages
  // get the plain breadcrumb back.
  useEffect(() => {
    setPageTabs({
      tabs: [
        { key: "projects", label: t("ph_projects"), icon: <FolderOpen className="h-3.5 w-3.5" /> },
        { key: "units", label: t("ph_units"), icon: <Layers className="h-3.5 w-3.5" /> },
      ],
      activeKey: tab,
      onSelect: (key) => setTab(key as Tab),
    })
    return () => setPageTabs(null)
  }, [tab, setPageTabs, t])

  return tab === "projects" ? <ContractsPage /> : <AdminUnitsPage />
}
