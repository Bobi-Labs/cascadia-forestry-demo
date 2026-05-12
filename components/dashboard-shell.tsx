"use client"

import { useState, useCallback, useEffect } from 'react'
import { useApp } from '@/lib/app-context'
import { AppSidebar } from '@/components/app-sidebar'
import { Topbar } from '@/components/topbar'
import { OverviewPage } from '@/components/pages/overview'
import { TimeSheetsPage } from '@/components/pages/timesheets'
import { PayrollPage } from '@/components/pages/payroll'
import { ProjectsHubPage } from '@/components/pages/projects-hub'
import { ExpensesHubPage } from '@/components/pages/expenses-hub'
import { ImportsHubPage } from '@/components/pages/imports-hub'
import { ProductionPage } from '@/components/pages/production'
import { WeatherPage } from '@/components/pages/weather-page'
import { CrewPage } from '@/components/pages/crew'
import { CrewSetsPage } from '@/components/pages/crew-sets'
import {
  VehiclesPage, EquipmentPage, SafetyPage,
  ExpensesPage, AnalyticsPage, CompetitorPage, SettingsPage,
} from '@/components/pages/admin-pages'
import { CalendarPage } from '@/components/pages/calendar-page'
import { ForemanTimesheetPage } from '@/components/pages/foreman-timesheet'
import { WorkTrackerPage } from '@/components/pages/work-tracker'
import { RolePageRouter } from '@/components/pages/role-views'
import { FilesPage } from '@/components/pages/files-page'
import { ContactsPage } from '@/components/pages/contacts-page'
import { CommunicationsPage } from '@/components/pages/communications'
import { PendingExpensesPage } from '@/components/pages/pending-expenses'
import { PendingUnitsPage } from '@/components/pages/pending-units'
// AdminUnitsPage now rendered inside ProjectsHubPage as the "Units" tab.
// Direct import retained as null-op so any remaining `<AdminUnitsPage />`
// references in this file fail loud rather than silently — there should
// be none after the AdminPageRouter switch update below.
import { UnitIngestAuditPage } from '@/components/pages/unit-ingest-audit'
import { OfflineBanner } from '@/components/offline-banner'
import { OfflinePlaceholder } from '@/components/offline-placeholder'
import { useOnlineStatus } from '@/lib/offline/use-online-status'
import { useRefDataSync } from '@/lib/offline/use-ref-data-sync'

// Pages that work fully offline (use cached reference data)
const OFFLINE_CAPABLE_PAGES = new Set(['submitTimesheet', 'officeTimesheet'])

function AdminPageRouter({ page, isOnline }: { page: string; isOnline: boolean }) {
  const { setActivePage } = useApp()

  // Show offline placeholder for pages that need connectivity
  if (!isOnline && !OFFLINE_CAPABLE_PAGES.has(page)) {
    return <OfflinePlaceholder />
  }

  switch (page) {
    case 'overview': return <OverviewPage />
    case 'timeSheets': return <TimeSheetsPage />
    case 'payroll': return <PayrollPage />
    // Projects + Units now share the ProjectsHubPage tabbed wrapper.
    // The legacy 'adminUnits' key keeps working — it routes to the same
    // hub but defaults to the Units tab for backwards compat with deep
    // links + bookmarks.
    case 'contracts': return <ProjectsHubPage defaultTab="projects" />
    case 'adminUnits': return <ProjectsHubPage defaultTab="units" />
    case 'production': return <ProductionPage />
    case 'weather': return <WeatherPage />
    case 'crew': return <CrewPage />
    case 'crewSets': return <CrewSetsPage />
    case 'vehicles': return <VehiclesPage />
    case 'equipment': return <EquipmentPage />
    case 'safetyCerts': return <SafetyPage />
    case 'calendar': return <CalendarPage />
    case 'officeTimesheet': return <ForemanTimesheetPage onNavigate={(p) => setActivePage(p)} />
    // Expenses sidebar entry = pure analytics on landed data (admin
    // only). The Expense Assignments queue + import controls now live
    // under the Imports hub instead.
    case 'expenses': return <ExpensesHubPage defaultTab="expenses" />
    // All ingest queues + run controls + audits live under Imports.
    // Legacy route keys redirect to the right tab so deep links survive.
    case 'imports': return <ImportsHubPage defaultTab="expenses" />
    case 'pendingExpenses': return <ImportsHubPage defaultTab="expenses" />
    case 'pendingUnits': return <ImportsHubPage defaultTab="units" />
    case 'unitIngestAudit': return <ImportsHubPage defaultTab="units" />
    case 'analytics': return <AnalyticsPage />
    case 'competitorData': return <CompetitorPage />
    // notifications removed — alerts now inline in Work Tracker
    case 'settings': return <SettingsPage />
    case 'contacts': return <ContactsPage />
    case 'workTracker': return <WorkTrackerPage />
    case 'communications': return <CommunicationsPage />
    case 'files': return <FilesPage />
    default: return <OverviewPage />
  }
}

export function DashboardShell() {
  const { role, activePage } = useApp()
  const isAdmin = role === 'admin' || role === 'office'
  const isOnline = useOnlineStatus()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Keep reference data synced to IndexedDB in background
  useRefDataSync()

  // Close sidebar when navigating
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  // Close sidebar on page change
  useEffect(() => {
    setMobileOpen(false)
  }, [activePage])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className="flex min-h-screen bg-background overflow-x-hidden">
      {/* Desktop sidebar - always visible at md+ */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeMobile}
            aria-hidden="true"
          />
          {/* Sidebar drawer */}
          <div className="relative z-50 h-full w-[280px] max-w-[85vw]">
            <AppSidebar onNavClick={closeMobile} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden md:ml-[260px]">
        <OfflineBanner />
        <Topbar onHamburgerClick={() => setMobileOpen((v) => !v)} mobileOpen={mobileOpen} />
        <main className="flex-1 min-w-0 p-3 md:p-6">
          {isAdmin ? (
            <AdminPageRouter page={activePage} isOnline={isOnline} />
          ) : (
            <RolePageRouter page={activePage} isOnline={isOnline} />
          )}
        </main>
      </div>
    </div>
  )
}
