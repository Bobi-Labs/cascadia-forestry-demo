"use client"

import { useState, useCallback, useEffect } from 'react'
import { useApp } from '@/lib/app-context'
import { AppSidebar } from '@/components/app-sidebar'
import { Topbar } from '@/components/topbar'
import { OverviewPage } from '@/components/pages/overview'
import { TimeSheetsPage } from '@/components/pages/timesheets'
import { PayrollPage } from '@/components/pages/payroll'
import { ContractsPage } from '@/components/pages/contracts'
import { ProductionPage } from '@/components/pages/production'
import { CrewPage } from '@/components/pages/crew'
import { CrewSetsPage } from '@/components/pages/crew-sets'
import {
  VehiclesPage, EquipmentPage, SafetyPage,
  AnalyticsPage, CompetitorPage, SettingsPage,
} from '@/components/pages/admin-pages'
import { CalendarPage } from '@/components/pages/calendar-page'
import { ForemanTimesheetPage } from '@/components/pages/foreman-timesheet'
import { RolePageRouter } from '@/components/pages/role-views'
import { ContactsPage } from '@/components/pages/contacts-page'
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
    case 'contracts': return <ContractsPage />
    case 'production': return <ProductionPage />
    case 'crew': return <CrewPage />
    case 'crewSets': return <CrewSetsPage />
    case 'vehicles': return <VehiclesPage />
    case 'equipment': return <EquipmentPage />
    case 'safetyCerts': return <SafetyPage />
    case 'calendar': return <CalendarPage />
    case 'officeTimesheet': return <ForemanTimesheetPage onNavigate={(p) => setActivePage(p)} />
    case 'analytics': return <AnalyticsPage />
    case 'competitorData': return <CompetitorPage />
    case 'settings': return <SettingsPage />
    case 'contacts': return <ContactsPage />
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
