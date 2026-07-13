"use client"

import { useMemo, useState } from 'react'
import { Users, TreePine, DollarSign, AlertTriangle, FileText, ArrowUp, Snowflake, Wind, Loader2, ChevronDown, ChevronUp, Mountain, Clock, Receipt, ClipboardCheck, CalendarClock, ChevronRight, Activity, CloudRain } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Cell, Tooltip as RechartsTooltip } from 'recharts'
import { MiniAreaSparkline, MiniBarSparkline } from '@/components/mini-sparkline'
import { useApp } from '@/lib/app-context'
import { useContracts, useEmployees, useUnits, useComplianceItems, useTimesheetsWithDetails, useWeeklyOTData, useProductionLogs } from '@/hooks/use-supabase'
import useClientQuery from '@/hooks/use-client-query'
import { CASCADIA_ID, RAMOS_ID } from '@/lib/database.types'
import { IS_DEMO_MODE, nowForDemo } from '@/lib/demo-mode'
// Sparklines and alerts are now computed from live data below

function KPICard({
  title, value, sub, delta, deltaColor, icon: Icon, iconColor, sparkline, sparkType = 'area', accentColor, onClick,
}: {
  title: string
  value: string
  sub: string
  delta?: string
  deltaColor?: string
  icon: React.ElementType
  iconColor?: string
  sparkline: number[]
  sparkType?: 'area' | 'bar'
  accentColor?: string
  onClick?: () => void
}) {
  return (
    <div
      className={`hover-card-lift relative flex flex-col justify-between rounded-lg border border-border bg-card p-4 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className={`mt-1 font-mono text-[32px] font-bold leading-none count-up ${accentColor || 'text-foreground'}`}>
            {value}
          </div>
        </div>
        <Icon className={`h-5 w-5 ${iconColor || 'text-muted-foreground'}`} />
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{sub}</div>
          {delta && (
            <div className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${deltaColor || 'text-muted-foreground'}`}>
              {deltaColor?.includes('primary') && <ArrowUp className="h-3 w-3" />}
              {delta}
            </div>
          )}
        </div>
        {sparkType === 'area' ? (
          <MiniAreaSparkline data={sparkline} color={accentColor === 'text-warning' ? '#f59e0b' : '#22c55e'} />
        ) : (
          <MiniBarSparkline data={sparkline} color={accentColor === 'text-warning' ? '#f59e0b' : '#22c55e'} />
        )}
      </div>
    </div>
  )
}

interface ProductionMetric {
  label: string
  completed: number
  total: number
  unit: string
  icon: React.ElementType
}

function ContractProductionCard({ contract, units: allUnits, productionLogs, onClick }: {
  contract: { id: string; name: string; contract_number: string | null; landowner: string | null; company_id: string; work_types: string[] | null; location: string | null; status: string }
  units: { id: string; contract_id: string; status: string; amount: number | null; amount_type: string | null; completion_pct: number | null }[]
  productionLogs: { unit_id: string; quantity: number | null }[]
  onClick: () => void
}) {
  const contractUnits = allUnits.filter(u => u.contract_id === contract.id)
  const completedUnits = contractUnits.filter(u => u.status === 'completed').length

  // Build a map of production log totals per unit
  const logsByUnit = useMemo(() => {
    const m = new Map<string, number>()
    for (const log of productionLogs) {
      const cur = m.get(log.unit_id) || 0
      m.set(log.unit_id, cur + (log.quantity || 0))
    }
    return m
  }, [productionLogs])

  // Compute production metrics grouped by amount_type, using production logs for in-progress units
  const metrics = useMemo(() => {
    const byType: Record<string, { completed: number; total: number }> = {}
    for (const u of contractUnits) {
      const aType = u.amount_type || 'unknown'
      if (!byType[aType]) byType[aType] = { completed: 0, total: 0 }
      byType[aType].total += u.amount || 0
      if (u.status === 'completed') {
        byType[aType].completed += u.amount || 0
      } else if (u.status === 'in_progress') {
        // Prefer production logs over completion_pct for in-progress units
        const logged = logsByUnit.get(u.id)
        if (logged != null && logged > 0) {
          byType[aType].completed += logged
        } else if (u.completion_pct && u.amount) {
          byType[aType].completed += Math.round((u.completion_pct / 100) * u.amount)
        }
      }
    }

    const result: ProductionMetric[] = []
    if (byType['tree']) {
      result.push({
        label: 'Trees',
        completed: byType['tree'].completed,
        total: byType['tree'].total,
        unit: 'trees',
        icon: TreePine,
      })
    }
    if (byType['acre']) {
      result.push({
        label: 'Acres',
        completed: byType['acre'].completed,
        total: byType['acre'].total,
        unit: 'acres',
        icon: Mountain,
      })
    }
    if (byType['hour']) {
      result.push({
        label: 'Hours',
        completed: byType['hour'].completed,
        total: byType['hour'].total,
        unit: 'hrs',
        icon: Clock,
      })
    }
    return result
  }, [contractUnits, logsByUnit])

  // Overall progress based on unit completion
  const overallProgress = contractUnits.length > 0
    ? Math.round(contractUnits.reduce((sum, u) => sum + (u.completion_pct || 0), 0) / contractUnits.length)
    : 0

  return (
    <div
      className="cursor-pointer rounded-lg border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:bg-elevated"
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-foreground">{contract.name}</h4>
            <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {contract.company_id === CASCADIA_ID
                ? 'Cascadia'
                : contract.company_id === RAMOS_ID
                  ? 'Ramos'
                  : 'Both'}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            {contract.contract_number && <span className="font-mono">{contract.contract_number}</span>}
            {contract.landowner && <span>{contract.landowner}</span>}
            {contract.location && <span>{contract.location}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full pulse-dot bg-primary" />
          <span className="text-xs font-medium text-primary capitalize">{contract.status}</span>
        </div>
      </div>

      {/* Work types */}
      {contract.work_types && contract.work_types.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {contract.work_types.map((wt, i) => (
            <span key={i} className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {wt}
            </span>
          ))}
        </div>
      )}

      {/* Overall progress bar */}
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
          <div
            className={`h-full rounded-full transition-all duration-500 ${overallProgress > 50 ? 'bg-primary' : 'bg-info'} shimmer-bar`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {completedUnits}/{contractUnits.length} units
        </span>
      </div>

      {/* Production metrics */}
      {metrics.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => {
            const pct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0
            const MetricIcon = m.icon
            return (
              <div key={m.label} className="flex items-center gap-2 rounded-md bg-elevated/60 px-3 py-2">
                <MetricIcon className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-medium text-foreground">
                    {m.completed.toLocaleString()} <span className="text-muted-foreground">of</span> {m.total.toLocaleString()}
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-card">
                    <div
                      className={`h-full rounded-full ${pct >= 75 ? 'bg-primary' : pct >= 25 ? 'bg-info' : 'bg-muted-foreground/30'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* No units fallback */}
      {contractUnits.length === 0 && (
        <div className="mt-3 rounded-md bg-warning/5 px-3 py-2 text-[11px] text-warning">
          No units assigned yet
        </div>
      )}
    </div>
  )
}

function ContractsSection() {
  const { setActivePage, setSelectedContractId, setPageHint, t, company } = useApp()
  const { data: contracts, loading } = useContracts()
  const { data: units } = useUnits()
  const { data: productionLogs } = useProductionLogs()

  // Filter by company
  const filtered = useMemo(() => {
    if (!contracts) return []
    if (company === 'cascadia') return contracts.filter(c => c.company_id === CASCADIA_ID)
    if (company === 'ramos') return contracts.filter(c => c.company_id === RAMOS_ID)
    return contracts
  }, [contracts, company])

  const activeContracts = filtered.filter(c => c.status === 'active')
  const recentContracts = filtered.filter(c => c.status === 'closed' || c.status === 'seasonal').slice(0, 2)

  // Flatten units for passing down (include id for production log matching)
  const unitList = useMemo(() => {
    return (units || []).map(u => ({
      id: u.id,
      contract_id: u.contract_id,
      status: u.status,
      amount: u.amount,
      amount_type: u.amount_type,
      completion_pct: u.completion_pct,
    }))
  }, [units])

  // Flatten production logs for passing down
  const prodLogList = useMemo(() => {
    return (productionLogs || []).map(l => ({
      unit_id: l.unit_id,
      quantity: l.quantity,
    }))
  }, [productionLogs])

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading contracts...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <h3 className="text-base font-semibold text-foreground">{t('activeContracts')}</h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono font-medium text-primary">{activeContracts.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setPageHint('action:create'); setActivePage('contracts') }} className="rounded-md border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
            + New Project
          </button>
          <button onClick={() => setActivePage('contracts')} className="text-xs text-muted-foreground hover:text-primary">
            {'View All \u2192'}
          </button>
        </div>
      </div>

      {/* Contract cards grid */}
      {activeContracts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No active contracts
        </div>
      ) : (
        <div className="max-h-[600px] overflow-y-auto rounded-lg">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {activeContracts.map((c) => (
              <ContractProductionCard
                key={c.id}
                contract={c}
                units={unitList}
                productionLogs={prodLogList}
                onClick={() => { setSelectedContractId(c.id); setActivePage('contracts') }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent contracts */}
      {recentContracts.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card">
          <div className="flex items-center gap-2 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            <span className="text-xs text-muted-foreground">Recent</span>
          </div>
          {recentContracts.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-t border-border/50 px-4 py-2 text-xs text-muted-foreground">
              <span>{c.name}</span>
              <span>{c.landowner || 'N/A'}</span>
              <span>{c.work_types?.join(', ') || 'N/A'}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                c.status === 'closed' ? 'bg-muted text-muted-foreground' : 'bg-warning/20 text-warning'
              }`}>
                {c.status === 'closed' ? 'Closed' : 'Seasonal'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Returns Mon-Fri of the display week.
// On weekends: show the week that just ended.
// On weekdays: show the current week.
function getDisplayWeek(offset = 0): { start: string; end: string; label: string } {
  const now = nowForDemo()
  const day = now.getDay() // 0=Sun, 1=Mon, ...

  const monday = new Date(now)
  if (day === 0) {
    // Sunday — show last week
    monday.setDate(now.getDate() - 6)
  } else if (day === 6) {
    // Saturday — show last week
    monday.setDate(now.getDate() - 5)
  } else {
    // Weekday — show current week
    monday.setDate(now.getDate() - (day - 1))
  }
  // Apply week offset
  monday.setDate(monday.getDate() + offset * 7)
  monday.setHours(0, 0, 0, 0)

  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const label = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return { start: fmt(monday), end: fmt(friday), label }
}

function AlertsPanel() {
  const { t, setActivePage } = useApp()
  const { data: compliance } = useComplianceItems()
  const { data: timesheets } = useTimesheetsWithDetails()

  const pendingSheets = timesheets?.filter(ts => ts.status === 'submitted').length || 0

  // Build alerts from real data
  const realAlerts = useMemo(() => {
    const items: { id: string; type: 'critical' | 'warning' | 'info'; title: string; countdown?: string }[] = []

    // Overdue compliance items
    compliance?.filter(c => c.status === 'overdue').forEach(c => {
      items.push({
        id: `comp-${c.id}`,
        type: 'critical',
        title: `${c.title} — OVERDUE`,
        countdown: 'Overdue',
      })
    })

    // Due soon compliance items
    compliance?.filter(c => c.status === 'due_soon').forEach(c => {
      const dueDate = c.due_date ? new Date(c.due_date) : null
      const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
      items.push({
        id: `comp-${c.id}`,
        type: 'warning',
        title: c.title,
        countdown: daysLeft !== null ? `${daysLeft}d` : undefined,
      })
    })

    // Pending timesheets alert
    if (pendingSheets > 0) {
      items.push({
        id: 'pending-sheets',
        type: pendingSheets >= 3 ? 'warning' : 'info',
        title: `${pendingSheets} timesheet${pendingSheets > 1 ? 's' : ''} awaiting approval`,
      })
    }

    return items
  }, [compliance, pendingSheets])

  if (realAlerts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{t('alertsDeadlines')}</h3>
        </div>
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          No active alerts — all clear
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{t('alertsDeadlines')}</h3>
      </div>
      <div className="divide-y divide-border/50">
        {realAlerts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              a.type === 'critical' ? 'bg-destructive' :
              a.type === 'warning' ? 'bg-warning' :
              'bg-info'
            }`} />
            <span className="flex-1 text-xs text-foreground">{a.title}</span>
            {a.countdown && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                a.type === 'critical' ? 'bg-destructive/20 text-destructive' :
                a.type === 'warning' ? 'bg-warning/20 text-warning' :
                'bg-info/20 text-info'
              }`}>
                {a.countdown}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-border px-4 py-2">
        <button onClick={() => setActivePage('calendar')} className="text-xs text-muted-foreground hover:text-primary">{'View Calendar →'}</button>
      </div>
    </div>
  )
}

function OTMonitorPanel() {
  const { t } = useApp()
  const week = useMemo(() => getDisplayWeek(), [])
  const { data: otData, loading } = useWeeklyOTData(week.start, week.end)

  const crewData = useMemo(() =>
    otData.filter(e => !e.is_driver).map(e => ({
      name: `${e.first_name} ${e.last_name.charAt(0)}.`,
      hours: Math.round(e.total_hours * 10) / 10,
    })),
    [otData]
  )

  const driverData = useMemo(() =>
    otData.filter(e => e.is_driver).map(e => ({
      name: `${e.first_name} ${e.last_name.charAt(0)}.`,
      hours: Math.round((e.total_hours + e.total_drive_hours) * 10) / 10,
    })),
    [otData]
  )

  const otCount = otData.filter(e => e.total_hours > 40).length
  const maxHours = Math.max(...[...crewData, ...driverData].map(d => d.hours), 45)

  function barColor(hours: number): string {
    if (hours > 50) return '#ef4444'  // red
    if (hours > 40) return '#ef4444'  // red
    if (hours >= 38) return '#f59e0b' // amber
    return '#3b82f6'                  // blue
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-center rounded-lg border border-border bg-card py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading OT data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Week Label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{week.label}</span>
      </div>

      {/* OT Alert Banner */}
      {otCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-xs">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="font-medium text-destructive">{otCount} employee{otCount > 1 ? 's' : ''} over 40h this week</span>
        </div>
      )}

      {/* Crew OT */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 rounded bg-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t('crewOtMonitor')}</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">{crewData.length} crew</span>
          </div>
        </div>
        <div className="p-4">
          {crewData.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">No crew hours this week</div>
          ) : (
            <div style={{ height: Math.max(crewData.length * 28, 60) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={crewData} layout="vertical" margin={{ left: 70, right: 20 }}>
                  <XAxis type="number" domain={[0, Math.ceil(maxHours / 5) * 5]} hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={70} />
                  <ReferenceLine x={40} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} />
                  <Bar dataKey="hours" radius={[0, 3, 3, 0]} barSize={16}>
                    {crewData.map((entry, i) => (
                      <Cell key={i} fill={barColor(entry.hours)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Driver OT */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 rounded bg-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t('driverOtMonitor')}</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">{driverData.length} drivers</span>
          </div>
        </div>
        <div className="p-4">
          {driverData.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">No driver hours this week</div>
          ) : (
            <div style={{ height: Math.max(driverData.length * 28, 60) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={driverData} layout="vertical" margin={{ left: 70, right: 20 }}>
                  <XAxis type="number" domain={[0, Math.ceil(maxHours / 5) * 5]} hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={70} />
                  <ReferenceLine x={40} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} />
                  <Bar dataKey="hours" radius={[0, 3, 3, 0]} barSize={16}>
                    {driverData.map((entry, i) => (
                      <Cell key={i} fill={barColor(entry.hours)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Driver hours include work + drive time. Regularly exceeds 40h.
          </div>
        </div>
      </div>

      {/* Alerts — wired to real compliance + pending sheets */}
      <AlertsPanel />

      {/* Weather */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{t('weatherSnapshot')}</h3>
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs">
            <Snowflake className="h-3.5 w-3.5 text-warning" />
            <span className="text-foreground">Frost Warning — Cowlitz CO tomorrow AM, low 28 F</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs">
            <Wind className="h-3.5 w-3.5 text-warning" />
            <span className="text-foreground">Wind Advisory — Columbia CO Thu-Fri, gusts 25mph</span>
          </div>
          <button className="mt-1 text-left text-xs text-muted-foreground hover:text-primary">{'Open Weather \u2192'}</button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Redesigned Overview sub-components (2026-04-28)
// ──────────────────────────────────────────────────────────────────────

function PendingDecisionsCard() {
  const { setActivePage, setPageHint, company } = useApp()
  const filter: 'cascadia' | 'ramos' | null =
    company === 'cascadia' ? 'cascadia' : company === 'ramos' ? 'ramos' : null
  const { data: pending, isLoading } = useClientQuery('pendingDecisions', filter)

  const totalCount =
    (pending?.pendingTimesheets.count || 0) +
    (pending?.pendingExpenses.count || 0) +
    (pending?.complianceDeadlines.count || 0) +
    (pending?.endingContracts.count || 0)

  const items = [
    {
      icon: ClipboardCheck,
      label: 'Timesheets to approve',
      count: pending?.pendingTimesheets.count || 0,
      onClick: () => { setPageHint('filter:submitted'); setActivePage('timeSheets') },
      color: pending && pending.pendingTimesheets.count > 0 ? 'text-amber-400' : 'text-muted-foreground',
    },
    {
      icon: Receipt,
      label: 'Expenses to assign',
      count: pending?.pendingExpenses.count || 0,
      sub: pending?.pendingExpenses.totalAmount
        ? `$${pending.pendingExpenses.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} total`
        : undefined,
      onClick: () => { setPageHint('section:pending'); setActivePage('admin') },
      color: pending && pending.pendingExpenses.count > 0 ? 'text-amber-400' : 'text-muted-foreground',
    },
    {
      icon: AlertTriangle,
      label: 'Compliance items due',
      count: pending?.complianceDeadlines.count || 0,
      sub: 'Next 14 days',
      color: pending && pending.complianceDeadlines.count > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
    {
      icon: CalendarClock,
      label: 'Contracts ending soon',
      count: pending?.endingContracts.count || 0,
      sub: 'Next 14 days',
      onClick: () => setActivePage('contracts'),
      color: pending && pending.endingContracts.count > 0 ? 'text-warning' : 'text-muted-foreground',
    },
  // Expenses were stripped from the demo, so this row is always zero and
  // its target page is gone. Drop it in demo mode.
  ].filter(item => !(IS_DEMO_MODE && item.label === 'Expenses to assign'))

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Pending Decisions</h3>
          {totalCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-400">
              {totalCount}
            </span>
          )}
        </div>
      </div>
      <div className="divide-y divide-border">
        {isLoading && (
          <div className="px-4 py-6 text-xs text-muted-foreground">Loading…</div>
        )}
        {!isLoading && items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              disabled={!item.onClick || item.count === 0}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs transition-colors hover:bg-elevated disabled:hover:bg-transparent disabled:cursor-default"
            >
              <Icon className={`h-4 w-4 shrink-0 ${item.color}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">{item.label}</div>
                {item.sub && <div className="text-muted-foreground text-[10px] mt-0.5">{item.sub}</div>}
              </div>
              <div className={`font-mono text-base font-bold ${item.color}`}>
                {item.count}
              </div>
              {item.onClick && item.count > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TodaysPulseCard({ overview, hideFinancials }: {
  overview: { week: { start: string; end: string; gross: number; regHours: number; otHours: number; driveHours: number; uniqueEmployees: number } } | null
  activeContracts: number
  hideFinancials?: boolean
}) {
  const fmt$ = (n: number) =>
    n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : '$' + n.toFixed(0)
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Today's Pulse</h3>
        </div>
      </div>
      <div className="divide-y divide-border">
        {!hideFinancials && (
          <div className="flex items-center justify-between px-4 py-3 text-xs">
            <div>
              <div className="font-medium text-foreground">Most recent 7 days</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {overview ? (() => {
                  const fmt = (d: string) => {
                    const dt = new Date(d + 'T00:00:00')
                    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                  return `${fmt(overview.week.start)} – ${fmt(overview.week.end)}`
                })() : 'Awaiting data'}
              </div>
            </div>
            <div className="font-mono text-base font-bold text-foreground">
              {overview ? fmt$(overview.week.gross) : '—'}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 text-xs">
          <div>
            <div className="font-medium text-foreground">Employees working</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">This week</div>
          </div>
          <div className="font-mono text-base font-bold text-foreground">
            {overview ? overview.week.uniqueEmployees : '—'}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-xs">
          <div>
            <div className="font-medium text-foreground">Reg / OT / Drive hrs</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">This week</div>
          </div>
          <div className="font-mono text-xs font-bold text-foreground">
            {overview
              ? `${overview.week.regHours.toFixed(0)} / ${overview.week.otHours.toFixed(0)} / ${overview.week.driveHours.toFixed(0)}`
              : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

function WeatherTodayCard() {
  const { setActivePage } = useApp()
  const { data: weather, isLoading } = useClientQuery('weatherToday')
  return (
    <div className="rounded-lg border border-border bg-card flex flex-col">
      <button
        onClick={() => setActivePage('weather')}
        className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 transition-colors hover:bg-elevated"
      >
        <div className="flex items-center gap-2">
          <CloudRain className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Active Site Weather</h3>
          {weather && weather.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary">
              {weather.length}
            </span>
          )}
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-6 text-xs text-muted-foreground">Loading forecasts…</div>
        )}
        {!isLoading && (!weather || weather.length === 0) && (
          <div className="px-4 py-6 text-xs text-muted-foreground">
            No active project locations with units — weather forecast will appear when units are added.
          </div>
        )}
        {!isLoading &&
          weather &&
          weather.map((w) => (
            <div key={`${w.county}-${w.state}`} className="flex items-start gap-3 px-4 py-2.5 text-xs">
              <div className="text-2xl shrink-0">{w.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {w.county}{w.state ? `, ${w.state}` : ''}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {w.unitCount} unit{w.unitCount !== 1 ? 's' : ''} · {w.contractCount} project{w.contractCount !== 1 ? 's' : ''}
                  {w.contractNames.length > 0 && (
                    <span className="ml-1 text-muted-foreground/70">· {w.contractNames.slice(0, 2).join(', ')}{w.contractNames.length > 2 ? `…` : ''}</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">{w.condition}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-foreground">
                  {w.high !== null ? `${w.high}°` : '—'}
                  {w.low !== null && (
                    <span className="ml-1 text-muted-foreground/70">/ {w.low}°</span>
                  )}
                </div>
                {w.rainChance !== null && w.rainChance > 0 && (
                  <div className="text-[10px] text-blue-400">{w.rainChance}% rain</div>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function DailyTrendsCard() {
  const { company } = useApp()
  const filter: 'cascadia' | 'ramos' | null =
    company === 'cascadia' ? 'cascadia' : company === 'ramos' ? 'ramos' : null
  const { data: overview, isLoading } = useClientQuery('overviewMetrics', filter)

  const data = useMemo(() => {
    if (!overview) return []
    const today = nowForDemo()
    return overview.sparklines.dailyGross.map((g, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (13 - i))
      return {
        day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        gross: g,
        ot: overview.sparklines.dailyOTHours[i] || 0,
      }
    })
  }, [overview])

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Daily Trends — last 14 days</h3>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#64748b' }} interval={1} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <RechartsTooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }}
                formatter={(value: number, name: string) => {
                  if (name === 'gross') return [`$${value.toLocaleString()}`, 'Gross']
                  return [value, name === 'ot' ? 'OT hrs' : name]
                }}
              />
              <Bar dataKey="gross" fill="#22c55e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function CompactContractsGrid() {
  const { setActivePage, setSelectedContractId, setPageHint, company, t } = useApp()
  const { data: contracts, loading } = useContracts()
  const { data: units } = useUnits()
  const { data: productionLogs } = useProductionLogs()
  const filter: 'cascadia' | 'ramos' | null =
    company === 'cascadia' ? 'cascadia' : company === 'ramos' ? 'ramos' : null
  const { data: payroll } = useClientQuery('payrollAnalytics', filter)

  const filtered = useMemo(() => {
    if (!contracts) return []
    if (company === 'cascadia') return contracts.filter(c => c.company_id === CASCADIA_ID)
    if (company === 'ramos') return contracts.filter(c => c.company_id === RAMOS_ID)
    return contracts
  }, [contracts, company])

  const activeContracts = useMemo(() => filtered.filter(c => c.status === 'active'), [filtered])

  // Sort by recent payroll activity (gross spent), then alphabetical
  const sortedActive = useMemo(() => {
    if (!payroll) return activeContracts
    const grossById = new Map(payroll.byContract.map((b) => [b.contractId, b.gross]))
    return [...activeContracts].sort((a, b) => {
      const ga = grossById.get(a.id) || 0
      const gb = grossById.get(b.id) || 0
      if (gb !== ga) return gb - ga
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [activeContracts, payroll])

  const top8 = sortedActive.slice(0, 8)
  const remaining = sortedActive.length - top8.length

  const unitList = useMemo(() => {
    return (units || []).map(u => ({
      id: u.id, contract_id: u.contract_id, status: u.status,
      amount: u.amount, amount_type: u.amount_type, completion_pct: u.completion_pct,
    }))
  }, [units])

  const prodLogList = useMemo(() => {
    return (productionLogs || []).map(l => ({ unit_id: l.unit_id, quantity: l.quantity }))
  }, [productionLogs])

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card py-8">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="ml-2 text-xs text-muted-foreground">Loading contracts…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('activeContracts') || 'Active Projects'}</h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary">
            {top8.length}{remaining > 0 ? ` of ${activeContracts.length}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setPageHint('action:create'); setActivePage('contracts') }}
            className="rounded-md border border-primary/30 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
          >
            + New
          </button>
          <button
            onClick={() => setActivePage('contracts')}
            className="text-[11px] text-muted-foreground hover:text-primary"
          >
            View All →
          </button>
        </div>
      </div>
      {top8.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-xs text-muted-foreground">
          No active contracts
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {top8.map((c) => (
            <ContractProductionCard
              key={c.id}
              contract={c}
              units={unitList}
              productionLogs={prodLogList}
              onClick={() => { setSelectedContractId(c.id); setActivePage('contracts') }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RecentActivityCard() {
  const { company } = useApp()
  const filter: 'cascadia' | 'ramos' | null =
    company === 'cascadia' ? 'cascadia' : company === 'ramos' ? 'ramos' : null
  const { data: events, isLoading } = useClientQuery('recentActivity', filter)

  const fmtRelative = (ts: string) => {
    const d = new Date(ts)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const iconForKind = (kind: string) => {
    if (kind === 'timesheet') return ClipboardCheck
    if (kind === 'expense_batch') return Receipt
    if (kind === 'contract') return FileText
    return Activity
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
        </div>
      </div>
      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-6 text-xs text-muted-foreground">Loading…</div>
        )}
        {!isLoading && (!events || events.length === 0) && (
          <div className="px-4 py-6 text-xs text-muted-foreground">No recent activity</div>
        )}
        {!isLoading && events && events.map((e) => {
          const Icon = iconForKind(e.kind)
          return (
            <div key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-xs">
              <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{e.title}</div>
                {e.subtitle && (
                  <div className="text-[10px] text-muted-foreground truncate">{e.subtitle}</div>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground shrink-0">
                {fmtRelative(e.timestamp)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompactOTMonitor() {
  const { setActivePage } = useApp()
  const week = useMemo(() => getDisplayWeek(), [])
  const { data: otData, loading } = useWeeklyOTData(week.start, week.end)

  const top5 = useMemo(() => {
    return otData
      .map(e => ({
        name: `${e.first_name} ${e.last_name.charAt(0)}.`,
        hours: Math.round(e.total_hours * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)
  }, [otData])

  const overCount = otData.filter(e => e.total_hours > 40).length
  const maxHours = Math.max(...top5.map(d => d.hours), 45)

  function barColor(hours: number): string {
    if (hours > 40) return '#ef4444'
    if (hours >= 38) return '#f59e0b'
    return '#3b82f6'
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setActivePage('timeSheets')}
        className="flex w-full items-center justify-between border-b border-border px-4 py-3 transition-colors hover:bg-elevated"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">OT Monitor — top 5</h3>
          {overCount > 0 && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-mono font-medium text-destructive">
              {overCount} over 40h
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">{week.label}</span>
      </button>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Loading…
          </div>
        ) : top5.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No hours this week</div>
        ) : (
          <div style={{ height: Math.max(top5.length * 28, 60) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5} layout="vertical" margin={{ left: 60, right: 10 }}>
                <XAxis type="number" domain={[0, Math.ceil(maxHours / 5) * 5]} hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={70} />
                <ReferenceLine x={40} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} />
                <Bar dataKey="hours" radius={[0, 3, 3, 0]} barSize={16}>
                  {top5.map((entry, i) => (
                    <Cell key={i} fill={barColor(entry.hours)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

export function OverviewPage() {
  const { t, company, role, setActivePage, setPageHint } = useApp()
  // Office role doesn't see financial data — same enforcement layer as
  // contract values, rates, fringe. Per Bees + Jaime call 2026-04-28.
  const hideFinancials = role === 'office'
  const { data: contracts, loading: contractsLoading } = useContracts()
  const { data: employees, loading: employeesLoading } = useEmployees()
  const { data: compliance } = useComplianceItems()
  const { data: timesheets } = useTimesheetsWithDetails()
  const { data: productionLogs } = useProductionLogs()
  const week = useMemo(() => getDisplayWeek(), [])
  const { data: otData } = useWeeklyOTData(week.start, week.end)

  // Real overview metrics — current-week gross + 14-day daily series for sparklines
  const overviewFilter: 'cascadia' | 'ramos' | null =
    company === 'cascadia' ? 'cascadia' : company === 'ramos' ? 'ramos' : null
  const { data: overview } = useClientQuery('overviewMetrics', overviewFilter)

  // Filter by company
  const filteredContracts = useMemo(() => {
    if (!contracts) return []
    if (company === 'cascadia') return contracts.filter(c => c.company_id === CASCADIA_ID)
    if (company === 'ramos') return contracts.filter(c => c.company_id === RAMOS_ID)
    return contracts
  }, [contracts, company])

  const filteredEmployees = useMemo(() => {
    if (!employees) return []
    if (company === 'cascadia') return employees.filter(e => e.company_auth === 'cascadia' || e.company_auth === 'both')
    if (company === 'ramos') return employees.filter(e => e.company_auth === 'ramos' || e.company_auth === 'both')
    return employees
  }, [employees, company])

  // Compute KPIs from live data
  const activeContracts = filteredContracts.filter(c => c.status === 'active')
  const activeEmployees = filteredEmployees.filter(e => e.status === 'active')
  const foremanCount = filteredEmployees.filter(e => e.is_foreman).length
  const pendingCompliance = compliance?.filter(c => c.status === 'due_soon' || c.status === 'overdue').length || 0

  // Pending timesheets (submitted, awaiting approval)
  const pendingTimesheets = timesheets?.filter(ts => ts.status === 'submitted').length || 0

  // OT risk count
  const otRiskCount = otData.filter(e => e.total_hours >= 38).length
  const otOverCount = otData.filter(e => e.total_hours > 40).length

  // Weekly production from production_logs
  const weeklyProduction = useMemo(() => {
    if (!productionLogs || !timesheets) return { trees: 0, acres: 0 }
    // Get timesheet IDs for this week
    const weekTsIds = new Set(
      timesheets.filter(ts => ts.date >= week.start && ts.date <= week.end).map(ts => ts.id)
    )
    let trees = 0
    let acres = 0
    for (const log of productionLogs) {
      if (!weekTsIds.has(log.timesheet_id)) continue
      if (log.quantity_type === 'tree') trees += log.quantity || 0
      if (log.quantity_type === 'acre') acres += log.quantity || 0
    }
    return { trees, acres }
  }, [productionLogs, timesheets, week])

  // Real weekly payroll — sums actual gross_pay from timesheet_entries.
  // Falls back to the old hours × avg-rate approximation if the live
  // metrics haven't loaded yet (preserves the old behaviour briefly
  // during initial render).
  const estPayroll = useMemo(() => {
    if (overview) return Math.round(overview.week.gross)
    if (!otData || otData.length === 0) return null
    const totalHours = otData.reduce((sum, e) => sum + e.total_hours, 0)
    const totalDrive = otData.reduce((sum, e) => sum + e.total_drive_hours, 0)
    return Math.round(totalHours * 22.50 + totalDrive * 17.13)
  }, [overview, otData])

  const loading = contractsLoading || employeesLoading

  // Compute sparklines from real data — build mini bar chart from OT hours distribution
  const otHoursSparkline = useMemo(() => {
    if (!otData || otData.length === 0) return [0, 0, 0, 0, 0]
    // Bin hours: 0-20, 20-30, 30-38, 38-40, 40+
    const bins = [0, 0, 0, 0, 0]
    otData.forEach(e => {
      const h = e.total_hours
      if (h > 40) bins[4]++
      else if (h >= 38) bins[3]++
      else if (h >= 30) bins[2]++
      else if (h >= 20) bins[1]++
      else bins[0]++
    })
    return bins
  }, [otData])

  // Sparkline: 14-day daily reg-hours trend (proxy for crew activity).
  // Falls back to a flat synthetic line if metrics haven't loaded yet.
  const crewSparkline = useMemo(() => {
    if (overview && overview.sparklines.dailyRegHours.length > 0) {
      return overview.sparklines.dailyRegHours
    }
    const count = activeEmployees.length
    return [count * 0.8, count * 0.9, count * 0.85, count * 0.95, count, count]
  }, [overview, activeEmployees.length])

  // Sparkline: 14-day daily gross trend (proxy for active project intensity).
  const contractSparkline = useMemo(() => {
    if (overview && overview.sparklines.dailyGross.length > 0) {
      return overview.sparklines.dailyGross
    }
    return [filteredContracts.length, activeContracts.length, activeContracts.length, activeContracts.length]
  }, [overview, filteredContracts.length, activeContracts.length])

  // Sparkline for Est Payroll card: actual 14-day daily gross
  const payrollSparkline = useMemo(() => {
    if (overview && overview.sparklines.dailyGross.length > 0) {
      return overview.sparklines.dailyGross
    }
    return estPayroll ? [estPayroll * 0.9, estPayroll * 0.95, estPayroll] : [0]
  }, [overview, estPayroll])

  const [otSectionOpen, setOtSectionOpen] = useState(true)

  return (
    <div className="flex flex-col gap-5">
      {/* KPI Row */}
      <div data-tour="kpi-cards" className="grid grid-cols-5 gap-4">
        <KPICard
          title={t('activeCrew')}
          value={loading ? '...' : String(activeEmployees.length)}
          sub={`${foremanCount} foremen`}
          icon={Users}
          iconColor="text-muted-foreground"
          sparkline={crewSparkline}
          sparkType="bar"
          accentColor="text-primary"
        />
        <KPICard
          title={t('activeContracts') || 'Active Projects'}
          value={loading ? '...' : String(activeContracts.length)}
          sub={`${filteredContracts.length} total`}
          icon={TreePine}
          iconColor="text-muted-foreground"
          sparkline={contractSparkline}
          sparkType="bar"
        />
        {!hideFinancials && (
          <KPICard
            title={t('estPayroll')}
            value={estPayroll !== null ? `$${estPayroll.toLocaleString()}` : '\u2014'}
            sub={overview ? (() => {
              const fmt = (d: string) => {
                const dt = new Date(d + 'T00:00:00')
                return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
              return `${fmt(overview.week.start)} \u2013 ${fmt(overview.week.end)}, ${overview.week.uniqueEmployees} employees`
            })() : (estPayroll !== null ? 'weekly (approx)' : 'Awaiting timesheet data')}
            icon={DollarSign}
            iconColor="text-muted-foreground"
            sparkline={payrollSparkline}
          />
        )}
        {hideFinancials && (
          <KPICard
            title="Crew Hours"
            value={overview ? overview.week.regHours.toFixed(0) : '\u2014'}
            sub={overview ? `${overview.week.uniqueEmployees} employees this week` : 'Awaiting timesheet data'}
            icon={Clock}
            iconColor="text-muted-foreground"
            sparkline={overview?.sparklines.dailyRegHours ?? [0]}
          />
        )}
        <KPICard
          title={t('otRisk')}
          value={otData.length > 0 ? String(otRiskCount) : '\u2014'}
          sub={otData.length > 0
            ? (otOverCount > 0 ? `${otOverCount} over 40h` : 'All under 40h')
            : 'Awaiting timesheet data'
          }
          delta={otOverCount > 0 ? 'Review OT \u2192' : undefined}
          deltaColor={otOverCount > 0 ? 'text-destructive' : undefined}
          icon={AlertTriangle}
          iconColor="text-primary"
          sparkline={otHoursSparkline}
          accentColor={otRiskCount > 0 ? "text-primary" : undefined}
          onClick={() => setActivePage('timeSheets')}
        />
        <KPICard
          title="Pending Sheets"
          value={String(pendingTimesheets)}
          sub={pendingTimesheets > 0 ? 'awaiting approval' : 'all caught up'}
          delta={pendingTimesheets > 0 ? 'Review Now \u2192' : undefined}
          deltaColor={pendingTimesheets > 0 ? 'text-primary' : undefined}
          icon={FileText}
          iconColor="text-muted-foreground"
          sparkline={[pendingTimesheets]}
          onClick={() => { setPageHint('filter:submitted'); setActivePage('timeSheets') }}
        />
      </div>

      {/* Strip: Pending Decisions / Today's Pulse / Today's Weather.
          The weather card has no live feed in the demo (it reads an empty
          stub), so it is hidden and the strip drops to two columns. */}
      <div className={`grid grid-cols-1 gap-4 ${IS_DEMO_MODE ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        <PendingDecisionsCard />
        <TodaysPulseCard overview={overview ?? null} activeContracts={activeContracts.length} hideFinancials={hideFinancials} />
        {!IS_DEMO_MODE && <WeatherTodayCard />}
      </div>

      {/* Daily Trends bar chart — last 14 days of payroll. Hidden from
          office (financial data). They see hours-only Crew Hours KPI. */}
      {!hideFinancials && <DailyTrendsCard />}

      {/* Active Contracts — compact top 8 grid */}
      <div data-tour="contracts-section">
        <CompactContractsGrid />
      </div>

      {/* Bottom row: Recent Activity (left, 2 cols) + Compact OT Monitor (right, 1 col) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivityCard />
        </div>
        <div data-tour="ot-monitor">
          <CompactOTMonitor />
        </div>
      </div>
    </div>
  )
}
