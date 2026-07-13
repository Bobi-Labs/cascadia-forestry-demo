"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { Bell, ChevronDown, Menu, X, User, LogOut, Settings, Clock, AlertTriangle, CheckCircle, ShieldCheck, RefreshCw, Receipt } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useApp } from '@/lib/app-context'
import { useAuth } from '@/lib/auth-context'
import { IS_DEMO_MODE } from '@/lib/demo-mode'
import { useTimesheetsWithDetails, useComplianceItems, invalidateSupabaseCache } from '@/hooks/use-supabase'
import { useProfilePhoto } from '@/hooks/use-profile-photo'
import type { Company, Language } from '@/lib/mock-data'
import { SyncStatusBadge } from '@/components/sync-status-badge'
import { syncAllRefData } from '@/lib/offline/ref-data-sync'

const pageLabels: Record<string, string> = {
  overview: 'Overview',
  timeSheets: 'Time Sheets',
  payroll: 'Payroll',
  contracts: 'Projects',
  production: 'Production',
  weather: 'Weather',
  crew: 'Crew',
  vehicles: 'Vehicles',
  equipment: 'Equipment',
  safetyCerts: 'Safety & Certs',
  calendar: 'Calendar',
  expenses: 'Expenses',
  pendingExpenses: 'Expense Assignments',
  analytics: 'Analytics',
  competitorData: 'Competitor Data',
  nurseryOps: 'Nursery Ops',
  notifications: 'Notifications',
  settings: 'Settings',
  workTracker: 'Work Tracker',
  communications: 'Communications',
  pendingUnits: 'Pending Units',
  adminUnits: 'Units',
  unitIngestAudit: 'Ingest Audit',
  imports: 'Imports',
  messages: 'Messages',
  myContracts: 'My Projects',
  submitTimesheet: 'Submit Timesheet',
  myCrew: 'My Crew',
  vehicleStatus: 'Vehicle Status',
  myHours: 'My Hours',
  myProfile: 'My Profile',
  myDocuments: 'My Documents',
}

export function Topbar({ onHamburgerClick, mobileOpen }: { onHamburgerClick?: () => void; mobileOpen?: boolean }) {
  const { activePage, setActivePage, language, setLanguage, company, setCompany, role, pageTabs } = useApp()
  const { profile, signOut } = useAuth()
  const { data: timesheets } = useTimesheetsWithDetails()
  const { data: complianceItems } = useComplianceItems()
  const queryClient = useQueryClient()
  const [profileOpen, setProfileOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const alertsRef = useRef<HTMLDivElement>(null)

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [profileOpen])

  // Close alerts dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setAlertsOpen(false)
      }
    }
    if (alertsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [alertsOpen])

  // Pending timesheets count for notification badge
  const pendingCount = timesheets?.filter(ts => ts.status === 'submitted').length || 0

  // Compliance alerts: items due within 14 days or overdue
  const complianceAlerts = useMemo(() => {
    if (!complianceItems) return { nearDeadline: [] as typeof complianceItems, overdue: [] as typeof complianceItems }
    const now = new Date()
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const nearDeadline = complianceItems.filter(ci => {
      if (ci.status === 'completed') return false
      const due = new Date(ci.due_date + 'T00:00:00')
      return due > now && due <= in14Days
    })
    const overdue = complianceItems.filter(ci => {
      if (ci.status === 'completed') return false
      const due = new Date(ci.due_date + 'T00:00:00')
      return due <= now
    })
    return { nearDeadline, overdue }
  }, [complianceItems])

  const totalAlertCount = pendingCount + complianceAlerts.nearDeadline.length + complianceAlerts.overdue.length

  // User info from auth
  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'
  const displayName = profile?.name ?? 'Loading...'
  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : ''
  const { photoUrl } = useProfilePhoto(profile?.id ?? null)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-background px-3 md:h-16 md:px-6">
      {/* Hamburger - mobile only */}
      <button
        type="button"
        onClick={onHamburgerClick}
        className="mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground md:hidden"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        style={{ minHeight: "44px", minWidth: "44px" }}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Breadcrumb — hub pages with multiple sub-tabs replace the
          plain page label with an inline tab strip. Saves a row of
          vertical space + makes the tab grouping feel native. */}
      <div className="flex-1 min-w-0">
        {pageTabs ? (
          <div className="flex items-center gap-1">
            {pageTabs.tabs.map((tab) => {
              const active = tab.key === pageTabs.activeKey
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => pageTabs.onSelect(tab.key)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground truncate">
            {pageLabels[activePage] || activePage}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Language Toggle */}
        <div className="flex items-center rounded-full border border-border bg-card p-0.5">
          <button
            onClick={() => setLanguage('en')}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              language === 'en'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('es')}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              language === 'es'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ES
          </button>
        </div>

        {/* Company Filter — hidden on mobile to save space */}
        {(role === 'admin' || role === 'office') && (
          <div className="hidden sm:flex items-center rounded-full border border-border bg-card p-0.5">
            {(['all', 'cascadia', 'ramos'] as Company[]).map((c) => (
              <button
                key={c}
                onClick={() => setCompany(c)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  company === c
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Sync status badge (offline submissions) */}
        <SyncStatusBadge />

        {/* Refresh + Live indicator */}
        <button
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true)
            // Clear in-memory cache so useSupabaseQuery re-fetches from DB
            invalidateSupabaseCache()
            // Refetch all queries and wait for completion
            await queryClient.refetchQueries()
            // Also sync reference data to IndexedDB
            syncAllRefData().catch(() => {})
            setRefreshing(false)
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-all hover:bg-elevated active:scale-95"
          title="Refresh all data"
        >
          <RefreshCw className={`h-3 w-3 text-primary ${refreshing ? 'animate-spin' : ''}`} />
          <span className="h-2 w-2 rounded-full bg-primary pulse-dot" />
          <span className="hidden sm:inline text-xs font-medium text-primary">Live</span>
        </button>

        {/* Alerts Dropdown */}
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => { setAlertsOpen(!alertsOpen); setProfileOpen(false) }}
            className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
            title={totalAlertCount > 0 ? `${totalAlertCount} alert${totalAlertCount !== 1 ? 's' : ''}` : 'No alerts'}
          >
            <Bell className="h-3.5 w-3.5" />
            {totalAlertCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                {totalAlertCount > 9 ? '9+' : totalAlertCount}
              </span>
            )}
          </button>

          {alertsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card shadow-lg">
              {/* Header */}
              <div className="border-b border-border px-4 py-3">
                <div className="text-sm font-semibold text-foreground">Alerts</div>
              </div>

              <div className="max-h-80 overflow-y-auto p-2">
                {totalAlertCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="mb-2 h-8 w-8 text-primary/40" />
                    <div className="text-sm text-muted-foreground">No alerts</div>
                    <div className="mt-1 text-xs text-muted-foreground">Everything looks good</div>
                  </div>
                ) : (
                  <>
                    {/* Overdue compliance items */}
                    {complianceAlerts.overdue.map(ci => (
                      <button
                        key={ci.id}
                        onClick={() => { setActivePage('safetyCerts'); setAlertsOpen(false) }}
                        className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-elevated"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{ci.title}</div>
                          <div className="text-xs text-destructive">Overdue</div>
                        </div>
                      </button>
                    ))}

                    {/* Pending timesheets */}
                    {pendingCount > 0 && (
                      <button
                        onClick={() => { setActivePage('timeSheets'); setAlertsOpen(false) }}
                        className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-elevated"
                      >
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">
                            {pendingCount} pending timesheet{pendingCount !== 1 ? 's' : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">Awaiting review</div>
                        </div>
                      </button>
                    )}

                    {/* Near-deadline compliance items */}
                    {complianceAlerts.nearDeadline.map(ci => {
                      const daysLeft = Math.ceil((new Date(ci.due_date + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      return (
                        <button
                          key={ci.id}
                          onClick={() => { setActivePage('safetyCerts'); setAlertsOpen(false) }}
                          className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-elevated"
                        >
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{ci.title}</div>
                            <div className="text-xs text-muted-foreground">Due in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</div>
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-elevated"
          >
            {photoUrl ? (
              <Image src={photoUrl} alt={displayName} width={28} height={28} className="h-7 w-7 rounded-full object-cover" unoptimized />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {initials}
              </div>
            )}
            <div className="hidden text-left md:block">
              <div className="text-xs font-medium text-foreground">{displayName}</div>
              <div className="text-[10px] text-muted-foreground">{roleLabel}</div>
            </div>
            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-border bg-card shadow-lg">
              {/* Profile header */}
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-3">
                  {photoUrl ? (
                    <Image src={photoUrl} alt={displayName} width={40} height={40} className="h-10 w-10 rounded-full object-cover" unoptimized />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{displayName}</div>
                    <div className="text-xs text-muted-foreground truncate">{profile?.email ?? ''}</div>
                    <span className="mt-1 inline-block rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-2">
                <button
                  onClick={() => { setActivePage('settings'); setProfileOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
              </div>

              {/* Sign out. Hidden in demo mode, there is no session to end */}
              {!IS_DEMO_MODE && (
                <div className="border-t border-border p-2">
                  <button
                    onClick={() => { setProfileOpen(false); signOut() }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
