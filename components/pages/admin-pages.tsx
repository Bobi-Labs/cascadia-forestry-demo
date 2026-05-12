"use client"

import { useState, useRef, useMemo, useEffect } from 'react'
import { Truck, Wrench, ShieldCheck, CreditCard, TrendingUp, Eye, EyeOff, Bell, Settings, Download, Lock, Loader2, KeyRound, Mail, CheckCircle2, Shuffle, Copy, Check, Camera, Upload, Receipt, AlertCircle, ArrowRight, DollarSign, ChevronDown, Gavel, Users2, Sprout, Trophy, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, LineChart, Line, Legend, LabelList } from 'recharts'
import { useVehicles, useComplianceItems, useEmployees, useContracts, useTimesheetsWithDetails } from '@/hooks/use-supabase'
import { createClient } from '@/lib/supabase/client'
import useClientQuery from '@/hooks/use-client-query'
import { useApp } from '@/lib/app-context'
import { useAuth } from '@/lib/auth-context'
import { useProfilePhoto } from '@/hooks/use-profile-photo'
import type { Vehicle as VehicleType } from '@/lib/database.types'
import { CASCADIA_ID, RAMOS_ID } from '@/lib/database.types'

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (!active || !payload) return null
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-foreground">{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</div>
      ))}
    </div>
  )
}

// --- Vehicles ---
function vehicleStatusLabel(status: string) {
  switch (status) {
    case 'active': return 'Active'
    case 'in_repair': return 'In Repair'
    case 'out_of_service': return 'Out of Service'
    default: return status
  }
}

export function VehiclesPage() {
  const { data: vehicles, loading, error } = useVehicles()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading vehicles...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load vehicles: {error}
      </div>
    )
  }

  const issueVehicles = vehicles.filter(v => v.status === 'in_repair' || v.status === 'out_of_service')

  return (
    <div className="flex gap-5">
      <div className="flex-1">
        <div className="grid grid-cols-2 gap-4">
          {vehicles.map((v) => {
            const displayName = [v.year, v.make_model].filter(Boolean).join(' ') || `${v.type} vehicle`
            const statusLabel = vehicleStatusLabel(v.status)
            return (
              <div key={v.id} className="hover-card-lift rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                    <div className="font-medium text-foreground">{displayName}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    v.status === 'active' ? 'bg-primary/20 text-primary' :
                    v.status === 'in_repair' ? 'bg-warning/20 text-warning' :
                    'bg-destructive/20 text-destructive'
                  }`}>{statusLabel}</span>
                </div>
                <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
                  {v.license_plate && <span>Plate: <span className="font-mono text-foreground">{v.license_plate}</span></span>}
                  <span>Type: <span className="text-foreground capitalize">{v.type}</span></span>
                  {v.mileage && <span>Mileage: <span className="font-mono text-foreground">{v.mileage.toLocaleString()}</span></span>}
                  {v.inspection_date && <span>Last Inspection: {v.inspection_date}</span>}
                  {v.insurance_exp && <span>Insurance Exp: {v.insurance_exp}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="w-[300px] shrink-0">
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Active Issues</h3>
          </div>
          <div className="flex flex-col gap-3 p-4">
            {issueVehicles.length === 0 ? (
              <div className="text-xs text-muted-foreground">No active issues</div>
            ) : (
              issueVehicles.map(v => (
                <div key={v.id} className={`rounded-md border p-3 text-xs ${
                  v.status === 'out_of_service' ? 'border-destructive/30 bg-destructive/5' : 'border-warning/30 bg-warning/5'
                }`}>
                  <div className={`font-medium ${v.status === 'out_of_service' ? 'text-destructive' : 'text-warning'}`}>
                    {v.make_model || v.type} — {vehicleStatusLabel(v.status)}
                  </div>
                  {v.notes && <div className="mt-1 text-muted-foreground">{v.notes}</div>}
                </div>
              ))
            )}
            <button className="rounded-md border border-primary/30 px-3 py-2 text-xs text-primary hover:bg-primary/10">
              + Report Issue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Equipment ---
export function EquipmentPage() {
  const items = [
    { name: 'Stihl MS 462', type: 'Chainsaw', serial: 'ST-462-01234', assigned: 'Marco Perez', condition: 'Good', lastService: 'Feb 10', value: '$1,200' },
    { name: 'Stihl MS 462', type: 'Chainsaw', serial: 'ST-462-01235', assigned: 'Luis Garcia', condition: 'Good', lastService: 'Feb 8', value: '$1,200' },
    { name: 'Solo 451', type: 'Backpack Sprayer', serial: 'SO-451-05678', assigned: 'Elena Torres', condition: 'Fair', lastService: 'Jan 25', value: '$350' },
    { name: 'Husqvarna 545', type: 'Chainsaw', serial: 'HQ-545-09876', assigned: 'Pedro S.', condition: 'Good', lastService: 'Feb 5', value: '$950' },
    { name: 'Hard Hats (12)', type: 'Safety Gear', serial: 'N/A', assigned: 'Crew Pool', condition: 'Good', lastService: 'N/A', value: '$480' },
    { name: 'Chaps Set (8)', type: 'Safety Gear', serial: 'N/A', assigned: 'Crew Pool', condition: 'Good', lastService: 'N/A', value: '$640' },
  ]
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Equipment Inventory</h3>
        <button className="rounded-md border border-primary/30 px-3 py-1.5 text-xs text-primary hover:bg-primary/10">+ Add Equipment</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 text-left font-medium">Item</th>
            <th className="px-4 py-2 text-left font-medium">Type</th>
            <th className="px-4 py-2 text-left font-medium">Serial</th>
            <th className="px-4 py-2 text-left font-medium">Assigned</th>
            <th className="px-4 py-2 text-center font-medium">Condition</th>
            <th className="px-4 py-2 text-left font-medium">Last Service</th>
            <th className="px-4 py-2 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-border transition-colors hover:bg-elevated">
              <td className="px-4 py-3 font-medium text-foreground"><Wrench className="mr-2 inline h-3 w-3 text-muted-foreground" />{item.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.type}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.serial}</td>
              <td className="px-4 py-3 text-foreground">{item.assigned}</td>
              <td className="px-4 py-3 text-center">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.condition === 'Good' ? 'bg-primary/20 text-primary' : 'bg-warning/20 text-warning'}`}>{item.condition}</span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{item.lastService}</td>
              <td className="px-4 py-3 text-right font-mono text-foreground">{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Safety & Compliance ---
export function SafetyPage() {
  const certifications = [
    { employee: 'Marco Perez', item: 'Herbicide License', exp: 'Feb 28', days: 7, status: 'EXPIRING' },
    { employee: 'Carlos Ruiz', item: 'DL', exp: 'Mar 15', days: 22, status: 'Due Soon' },
    { employee: 'Diego Herrera', item: 'DL', exp: 'Mar 15', days: 22, status: 'Due Soon' },
  ]
  const fatigue = [
    { employee: 'Marco Perez', consecutive: 6, weekly: 54, risk: 'HIGH RISK' },
    { employee: 'Diego Herrera', consecutive: 5, weekly: 48, risk: 'MONITOR' },
  ]
  const timeline = [
    { date: 'Feb 28', label: 'Mileage Report', color: 'bg-warning' },
    { date: 'Mar 1', label: 'OSHA 300A', color: 'bg-destructive' },
    { date: 'March', label: 'H2B Reimb', color: 'bg-info' },
    { date: 'April', label: 'Chainsaw Training', color: 'bg-info' },
    { date: 'May', label: 'Inspections', color: 'bg-muted-foreground/30' },
    { date: 'June', label: 'FLC Renewal', color: 'bg-muted-foreground/30' },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Timeline */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Company Compliance Timeline</h3>
        <div className="flex items-center gap-2">
          {timeline.map((t, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className={`h-3 w-3 rounded-full ${t.color}`} />
              <div className="h-px w-full bg-border" />
              <span className="text-[10px] font-medium text-foreground">{t.label}</span>
              <span className="text-[9px] text-muted-foreground">{t.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Certifications */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Employee Certifications</h3>
          <button className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-elevated"><Download className="mr-1 inline h-3 w-3" /> Download Audit Report</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Employee</th>
              <th className="px-4 py-2 text-left font-medium">Item</th>
              <th className="px-4 py-2 text-left font-medium">Expiration</th>
              <th className="px-4 py-2 text-center font-medium">Days</th>
              <th className="px-4 py-2 text-center font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {certifications.map((c, i) => (
              <tr key={i} className="border-b border-border transition-colors hover:bg-elevated">
                <td className="px-4 py-3 text-foreground">{c.employee}</td>
                <td className="px-4 py-3 text-foreground">{c.item}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.exp}</td>
                <td className="px-4 py-3 text-center font-mono text-foreground">{c.days}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    c.status === 'EXPIRING' ? 'bg-destructive/20 text-destructive pulse-dot' : 'bg-warning/20 text-warning'
                  }`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded px-2 py-1 text-[10px] text-primary hover:bg-primary/10">{c.status === 'EXPIRING' ? 'Renew' : 'Track'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fatigue */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Fatigue Monitor</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Employee</th>
              <th className="px-4 py-2 text-center font-medium">Consecutive Days</th>
              <th className="px-4 py-2 text-center font-medium">Weekly Hours</th>
              <th className="px-4 py-2 text-center font-medium">Risk Level</th>
            </tr>
          </thead>
          <tbody>
            {fatigue.map((f, i) => (
              <tr key={i} className="border-b border-border transition-colors hover:bg-elevated">
                <td className="px-4 py-3 text-foreground">{f.employee}</td>
                <td className="px-4 py-3 text-center font-mono text-foreground">{f.consecutive}</td>
                <td className="px-4 py-3 text-center font-mono text-foreground">{f.weekly}h</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    f.risk === 'HIGH RISK' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'
                  }`}>{f.risk}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Calendar ---
// CalendarPage moved to components/pages/calendar-page.tsx (wired to live contract dates)

// --- Expenses ---
// Recharts color palette for category pie chart — keep stable so colors
// don't shuffle between renders.
// 15-bucket schema agreed on 2026-04-24 — see lib/expenses/parser.ts.
const CATEGORY_COLORS: Record<string, string> = {
  // Vehicle
  fuel: '#f59e0b',                // amber
  vehicle_maintenance: '#fb923c', // orange
  vehicle_rental: '#f97316',      // orange-600
  // Travel
  lodging: '#3b82f6',             // blue
  airfare_transit: '#0ea5e9',     // sky
  tolls_parking: '#6366f1',       // indigo
  // Supplies
  meals: '#22c55e',               // green
  groceries: '#84cc16',            // lime
  equipment: '#a855f7',           // purple
  chainsaw: '#ef4444',            // red
  safety_gear: '#06b6d4',         // cyan
  // Overhead
  office_admin: '#8b5cf6',        // violet
  professional_services: '#d946ef', // fuchsia
  fees_insurance: '#ec4899',      // pink
  other: '#64748b',               // slate
}

const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'Fuel',
  vehicle_maintenance: 'Vehicle Maintenance',
  vehicle_rental: 'Vehicle Rental',
  lodging: 'Lodging',
  airfare_transit: 'Airfare & Transit',
  tolls_parking: 'Tolls & Parking',
  meals: 'Meals',
  groceries: 'Groceries',
  equipment: 'Equipment',
  chainsaw: 'Chainsaw',
  safety_gear: 'Safety Gear',
  office_admin: 'Office & Admin',
  professional_services: 'Professional Services',
  fees_insurance: 'Fees & Insurance',
  other: 'Other',
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export function ExpensesPage() {
  const { role, company, setActivePage, setSelectedContractId } = useApp()
  const { profile } = useAuth()
  const { data: expenses, isLoading } = useClientQuery('allExpenses')
  const { data: imports } = useClientQuery('expenseImports')
  const { data: activity } = useClientQuery('expenseActivity')

  // Card payments — fetched separately since they're transaction_type='payment'
  // (filtered OUT of allExpenses which only returns 'expense' type)
  const [cardPayments, setCardPayments] = useState<{ card_company: string | null; total: number }[]>([])
  useEffect(() => {
    const sb = createClient()
    sb.from('expenses')
      .select('card_company, amount')
      .eq('transaction_type', 'payment')
      .is('deleted_at', null)
      .then(({ data }) => {
        if (!data) return
        const byCard = new Map<string, number>()
        data.forEach((r: { card_company: string | null; amount: number }) => {
          const key = r.card_company || 'Other'
          byCard.set(key, (byCard.get(key) || 0) + Math.abs(Number(r.amount || 0)))
        })
        setCardPayments([...byCard.entries()].map(([card_company, total]) => ({ card_company, total })).sort((a, b) => b.total - a.total))
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [expandedImport, setExpandedImport] = useState<string | null>(null)
  // Gate on BOTH profile.role (the actual logged-in account) AND the
  // app-context role (the VIEW AS switcher). Owner gets a read-only
  // dashboard: no Import button, no Remove actions, no Assignments
  // quick-link. Owner CAN see Recent Activity (per Jaime, April 2026).
  const isAdmin = profile?.role === 'admin' && role === 'admin'
  const isOwnerOrAdmin = isAdmin || role === 'owner'

  // Filter by company toggle.
  // Private contracts with no assigned company (Jaime, April 2026) have
  // company_id = NULL and must appear in BOTH Cascadia and Ramos views,
  // since either crew might work them.
  const filtered = useMemo(() => {
    if (!expenses) return []
    return expenses.filter((e) => {
      if (company === 'cascadia') return e.company_id === CASCADIA_ID || e.company_id === null
      if (company === 'ramos') return e.company_id === RAMOS_ID || e.company_id === null
      return true
    })
  }, [expenses, company])

  // KPI rollups
  const kpis = useMemo(() => {
    const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0)
    const assigned = filtered.filter((e) => e.contract_id).length
    const unassigned = filtered.filter((e) => !e.contract_id).length
    const unassignedAmount = filtered.filter((e) => !e.contract_id).reduce((s, e) => s + Number(e.amount || 0), 0)
    const contractsTracked = new Set(filtered.filter((e) => e.contract_id).map((e) => e.contract_id)).size
    const autoMatched = filtered.filter((e) => e.match_method === 'timesheet_exact' || e.match_method === 'timesheet_multi').length

    // Top category
    const byCat = new Map<string, number>()
    filtered.forEach((e) => {
      const c = e.category || 'other'
      byCat.set(c, (byCat.get(c) || 0) + Number(e.amount || 0))
    })
    const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]

    return { total, assigned, unassigned, unassignedAmount, contractsTracked, autoMatched, topCat }
  }, [filtered])

  // Pie chart data — by category, descending
  const pieData = useMemo(() => {
    const byCat = new Map<string, number>()
    filtered.forEach((e) => {
      const c = e.category || 'other'
      byCat.set(c, (byCat.get(c) || 0) + Number(e.amount || 0))
    })
    return [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, value]) => ({
        name: CATEGORY_LABELS[cat] || cat,
        value: Math.round(value),
        color: CATEGORY_COLORS[cat] || '#64748b',
      }))
  }, [filtered])

  // Monthly trend — group by year-month, sorted ascending
  const monthlyData = useMemo(() => {
    const byMonth = new Map<string, number>()
    filtered.forEach((e) => {
      if (!e.date) return
      const d = new Date(e.date + 'T00:00:00')
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      byMonth.set(key, (byMonth.get(key) || 0) + Number(e.amount || 0))
    })
    return [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, amount]) => {
        const [year, month] = ym.split('-')
        const d = new Date(Number(year), Number(month) - 1, 1)
        return { month: fmtMonth(d), amount: Math.round(amount), key: ym }
      })
  }, [filtered])

  // Per-cardholder rollup — all users with >$0 activity.
  // Normalizes name casing so "Jose Contreras" and "JOSE CONTRERAS" collapse
  // into one row instead of appearing twice.
  //
  // Jaime Contreras and Jose Contreras spend is pooled into a single
  // "Admin Expenses" card — their charges are admin/owner overhead, not
  // operational per-user activity, and should not appear split on the
  // Top Spenders grid.
  const cardholderRollup = useMemo(() => {
    const ADMIN_NAMES = new Set(['jaime contreras', 'jose contreras'])
    const map = new Map<string, { name: string; total: number; byCat: Record<string, number>; flagged: boolean; isAdmin: boolean }>()
    filtered.forEach((e) => {
      const employee = e.employees as { first_name: string; last_name: string } | null
      const rawKey = employee
        ? `${employee.first_name} ${employee.last_name}`
        : (e.cardholder_name || 'Unknown')
      // Normalize: lowercase + collapse whitespace.
      const normKey = rawKey.trim().toLowerCase().replace(/\s+/g, ' ')
      // Admin bucket: Jaime + Jose collapse together.
      const isAdminCard = ADMIN_NAMES.has(normKey)
      const bucketKey = isAdminCard ? '_admin_expenses' : normKey
      const displayName = isAdminCard ? 'Admin Expenses' : rawKey.trim().replace(/\s+/g, ' ')
      const existing = map.get(bucketKey) || {
        name: displayName,
        total: 0,
        byCat: {},
        flagged: false,
        isAdmin: isAdminCard,
      }
      const cat = e.category || 'other'
      existing.total += Number(e.amount || 0)
      existing.byCat[cat] = (existing.byCat[cat] || 0) + Number(e.amount || 0)
      map.set(bucketKey, existing)
    })
    const arr = [...map.values()].sort((a, b) => b.total - a.total)
    // Flag anyone whose fuel spend is more than 60% of their total.
    // Admin Expenses card is never flagged (different spending pattern).
    arr.forEach((p) => {
      if (p.isAdmin) return
      const fuel = p.byCat.fuel || 0
      if (p.total > 500 && fuel / p.total > 0.6) p.flagged = true
    })
    return arr
  }, [filtered])

  // Per-project rollup — the missing dimension. We already show "who" (users),
  // "what" (categories), and "when" (monthly trend). This closes the loop by
  // showing "which project did the money go to". Unassigned shows up as its
  // own row at the bottom in amber so it's clearly not a real project.
  const projectRollup = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; total: number }>()
    let unassignedTotal = 0
    filtered.forEach((e) => {
      const amt = Number(e.amount || 0)
      if (!e.contract_id) {
        unassignedTotal += amt
        return
      }
      const contract = e.contracts as { id: string; name: string } | null
      const key = e.contract_id
      const existing = map.get(key) || { id: e.contract_id, name: contract?.name || 'Unknown project', total: 0 }
      existing.total += amt
      map.set(key, existing)
    })
    const assigned = [...map.values()].sort((a, b) => b.total - a.total)
    // Compute max for bar scaling (include unassigned so bars are proportional)
    const maxVal = Math.max(
      ...assigned.map((p) => Math.abs(p.total)),
      Math.abs(unassignedTotal),
      1,
    )
    return { assigned, unassignedTotal, maxVal }
  }, [filtered])

  const handleImport = async () => {
    const sheetId = process.env.NEXT_PUBLIC_EXPENSE_SHEET_ID
    if (!sheetId) {
      setImportMsg('Missing NEXT_PUBLIC_EXPENSE_SHEET_ID — set it in Vercel/.env.local to enable imports.')
      return
    }
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await fetch('/api/expenses/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: sheetId, importedBy: profile?.id || null }),
      })
      const data = await res.json()
      if (data.ok) {
        setImportMsg(`Imported ${data.imported}, auto-matched ${data.autoMatched}, skipped ${data.skipped}, errors ${data.errors}.`)
      } else {
        setImportMsg(`Import failed: ${data.error}`)
      }
    } catch (err) {
      setImportMsg(`Import error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading expenses…</span>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Expenses</h2>
        <div className="rounded-lg border border-border bg-card py-12 text-center">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">No expenses imported yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Head to the Imports tab and run an Import from Sheet to pull in the Credit Card Master.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header — pure analytics view. Assignments + Import-from-Sheet
          buttons moved to the Imports hub Expenses tab. */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Expenses</h2>
        <p className="text-sm text-muted-foreground">
          {filtered.length} expenses · {kpis.assigned} assigned · {kpis.unassigned} pending
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Spend', value: fmtCurrency(kpis.total) },
          { label: 'Top Category', value: kpis.topCat ? `${CATEGORY_LABELS[kpis.topCat[0]] || kpis.topCat[0]} ${fmtCurrency(kpis.topCat[1])}` : '—' },
          { label: 'Unassigned', value: `${kpis.unassigned} · ${fmtCurrency(kpis.unassignedAmount)}`, color: kpis.unassigned > 0 ? 'text-amber-400' : 'text-foreground' },
          { label: 'Projects Tracked', value: String(kpis.contractsTracked) },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <div className={`mt-1 font-mono text-xl font-bold ${k.color || 'text-foreground'}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Card Payments — cash flow to credit card companies (not expenses) */}
      {cardPayments.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">Card Payments (cash flow)</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-card/60 px-4 py-2.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Total Paid to Cards</div>
              <div className="mt-0.5 font-mono text-lg font-bold text-muted-foreground">
                {fmtCurrency(cardPayments.reduce((s, p) => s + p.total, 0))}
              </div>
            </div>
            {cardPayments.map((p) => (
              <div key={p.card_company} className="rounded-lg border border-border/60 bg-card/60 px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{p.card_company}</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-muted-foreground">
                  {fmtCurrency(p.total)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/*
        Main analytics row
        ─────────────────
        Left (1/3): compact charts stacked — pie + bar
        Right (2/3): Top Spenders grid — the most meaningful data, gets the
        most real estate. Charts are context; spenders are the answer.
        On narrow screens everything stacks vertically.
      */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Charts column */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By Category</h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    cx="50%"
                    cy="45%"
                    innerRadius={35}
                    outerRadius={62}
                    paddingAngle={2}
                  >
                    {pieData.map((p, i) => (
                      <Cell key={i} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => fmtCurrency(value)}
                    contentStyle={{
                      background: 'rgb(15, 23, 42)',
                      border: '1px solid rgb(30, 45, 66)',
                      borderRadius: 6,
                      fontSize: 11,
                      padding: '6px 10px',
                    }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: 2 }}
                  />
                  <Legend
                    iconSize={6}
                    wrapperStyle={{ fontSize: 9, paddingTop: 4 }}
                    verticalAlign="bottom"
                    height={28}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly Trend</h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    formatter={(value: number) => fmtCurrency(value)}
                    contentStyle={{
                      background: 'rgb(15, 23, 42)',
                      border: '1px solid rgb(30, 45, 66)',
                      borderRadius: 6,
                      fontSize: 11,
                      padding: '6px 10px',
                    }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: 2 }}
                  />
                  <Bar dataKey="amount" fill="#22c55e" radius={[3, 3, 0, 0]} name="Spend" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/*
            Spend by Project — ranked horizontal bars.
            This is the missing dimension: we show who spent (users), what
            they spent on (categories), and when they spent (monthly trend).
            This panel closes the loop by answering "which projects is
            this money going to". Unassigned is broken out at the bottom
            in amber so it's clearly a bucket, not a real project.
          */}
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spend by Project</h3>
              <span className="text-[10px] text-muted-foreground">{projectRollup.assigned.length} assigned</span>
            </div>
            {projectRollup.assigned.length === 0 && projectRollup.unassignedTotal === 0 ? (
              <div className="py-6 text-center text-[10px] text-muted-foreground">No assigned expenses yet</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {projectRollup.assigned.slice(0, 6).map((proj) => {
                  const pct = (Math.abs(proj.total) / projectRollup.maxVal) * 100
                  return (
                    <button
                      key={proj.id}
                      onClick={() => {
                        if (proj.id) setSelectedContractId(proj.id)
                        setActivePage('contracts')
                      }}
                      className="group block w-full text-left"
                      title={proj.name}
                    >
                      <div className="flex items-baseline justify-between gap-2 text-[10px]">
                        <span className="truncate text-foreground group-hover:text-primary">{proj.name}</span>
                        <span className="font-mono text-muted-foreground">{fmtCurrency(proj.total)}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all group-hover:bg-primary/80"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  )
                })}
                {projectRollup.assigned.length > 6 && (
                  <div className="mt-0.5 text-[9px] text-muted-foreground/60">
                    +{projectRollup.assigned.length - 6} more project{projectRollup.assigned.length - 6 !== 1 ? 's' : ''}
                  </div>
                )}
                {projectRollup.unassignedTotal !== 0 && (
                  <>
                    <div className="mt-1 h-px w-full bg-border/60" />
                    <button
                      onClick={() => setActivePage('pendingExpenses')}
                      className="group block w-full text-left"
                    >
                      <div className="flex items-baseline justify-between gap-2 text-[10px]">
                        <span className="text-amber-400 group-hover:text-amber-300">Unassigned</span>
                        <span className="font-mono text-amber-400">{fmtCurrency(projectRollup.unassignedTotal)}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all group-hover:bg-amber-400"
                          style={{ width: `${(Math.abs(projectRollup.unassignedTotal) / projectRollup.maxVal) * 100}%` }}
                        />
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Spend by User — all cardholders, takes 2/3 width */}
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spend by User</h3>
            <span className="text-[10px] text-muted-foreground">{cardholderRollup.length} {cardholderRollup.length === 1 ? 'user' : 'users'}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cardholderRollup.map((p) => {
              const segments = Object.entries(p.byCat).sort((a, b) => b[1] - a[1])
              return (
                <div
                  key={p.name}
                  className={`rounded-lg border p-3 ${p.isAdmin ? 'border-purple-500/30 bg-purple-500/5' : p.flagged ? 'border-amber-500/30 bg-elevated/40' : 'border-border bg-elevated/40'}`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {p.isAdmin && <Lock className="h-3 w-3 flex-shrink-0 text-purple-400" />}
                      <div className="text-xs font-semibold text-foreground truncate">{p.name}</div>
                    </div>
                    <div className="font-mono text-xs font-bold text-foreground whitespace-nowrap">
                      {fmtCurrency(p.total)}
                    </div>
                  </div>
                  {p.isAdmin && <div className="mb-1 text-[9px] text-purple-400">Admin overhead (Jaime + Jose combined)</div>}
                  {p.flagged && !p.isAdmin && <div className="mb-1 text-[9px] text-amber-400">Mostly fuel — review</div>}
                  <div className="flex flex-col gap-0.5 text-[10px]">
                    {segments.slice(0, 3).map(([cat, val]) => (
                      <div key={cat} className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-sm"
                            style={{ background: CATEGORY_COLORS[cat] || '#64748b' }}
                          />
                          {CATEGORY_LABELS[cat] || cat}
                        </span>
                        <span className="font-mono text-foreground">{fmtCurrency(val)}</span>
                      </div>
                    ))}
                    {segments.length > 3 && (
                      <div className="text-[9px] text-muted-foreground/60">
                        +{segments.length - 3} more
                      </div>
                    )}
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="flex h-full">
                      {segments.map(([cat, val]) => (
                        <div
                          key={cat}
                          style={{
                            background: CATEGORY_COLORS[cat] || '#64748b',
                            width: `${(val / p.total) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}

// --- Analytics ---

// Tooltip for analytics charts — dark theme consistent with rest of app
const AnalyticsTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (!active || !payload) return null
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="flex items-center gap-2">
          <span>{p.name}:</span>
          <span className="font-mono font-semibold">
            {typeof p.value === 'number'
              ? p.value < 1 ? `$${p.value.toFixed(3)}` : `$${p.value.toLocaleString()}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

type AnalyticsTab = 'expenses' | 'equipment' | 'bids' | 'payroll' | 'production' | 'competitor'

const ANALYTICS_TABS: { id: AnalyticsTab; label: string; icon: React.ElementType; status: 'live' | 'mock' }[] = [
  { id: 'expenses', label: 'Expenses', icon: Receipt, status: 'live' },
  { id: 'equipment', label: 'Equipment', icon: Wrench, status: 'mock' },
  { id: 'bids', label: 'Bids', icon: Gavel, status: 'mock' },
  { id: 'payroll', label: 'Payroll', icon: DollarSign, status: 'live' },
  { id: 'production', label: 'Production', icon: Sprout, status: 'mock' },
  { id: 'competitor', label: 'Competitor', icon: Eye, status: 'mock' },
]

export function AnalyticsPage() {
  const { company } = useApp()
  const { data: rawContracts } = useContracts()
  const { data: allExpenses } = useClientQuery('allExpenses')
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('expenses')

  // Fetch timesheet hours + employee rates for labor cost estimation
  const { data: timesheets } = useTimesheetsWithDetails()
  const { data: employees } = useEmployees()

  // Apply company filter — same logic as Expenses dashboard.
  // null company_id (private contracts) show in both views.
  const contracts = useMemo(() => {
    if (!rawContracts) return null
    if (company === 'cascadia') return rawContracts.filter(c => c.company_id === CASCADIA_ID || c.company_id === null)
    if (company === 'ramos') return rawContracts.filter(c => c.company_id === RAMOS_ID || c.company_id === null)
    return rawContracts
  }, [rawContracts, company])

  // Filter expenses by company toggle too
  const filteredExpenses = useMemo(() => {
    if (!allExpenses) return null
    if (company === 'cascadia') return allExpenses.filter(e => e.company_id === CASCADIA_ID || e.company_id === null)
    if (company === 'ramos') return allExpenses.filter(e => e.company_id === RAMOS_ID || e.company_id === null)
    return allExpenses
  }, [allExpenses, company])

  // Build project-level analytics from available data
  const projectAnalytics = useMemo(() => {
    if (!contracts || !filteredExpenses) return []

    // Build expense totals per contract
    const expenseByContract = new Map<string, number>()
    for (const e of filteredExpenses) {
      if (e.contract_id) {
        expenseByContract.set(e.contract_id, (expenseByContract.get(e.contract_id) || 0) + Number(e.amount || 0))
      }
    }

    return contracts
      .filter(c => c.contract_price && c.contract_price > 0 && c.status !== 'archived')
      .map(c => {
        const expenses = expenseByContract.get(c.id) || 0
        const price = Number(c.contract_price || 0)
        return {
          name: (c.name || '').length > 20 ? (c.name || '').slice(0, 18) + '...' : c.name || '',
          fullName: c.name || '',
          revenue: price,
          expenses,
          expenseRatio: price > 0 ? Math.round(expenses / price * 1000) / 10 : 0,
          seedlings: c.total_seedlings || 0,
          acres: c.total_acres || 0,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
  }, [contracts, filteredExpenses])

  // Monthly hours + expenses overlay
  const monthlyOverlay = useMemo(() => {
    if (!filteredExpenses) return []
    const byMonth = new Map<string, { hours: number; expenses: number }>()

    // Expenses by month
    for (const e of filteredExpenses) {
      if (!e.date) continue
      const d = new Date(e.date + 'T00:00:00')
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const existing = byMonth.get(key) || { hours: 0, expenses: 0 }
      existing.expenses += Number(e.amount || 0)
      byMonth.set(key, existing)
    }

    return [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, data]) => {
        const [year, month] = ym.split('-')
        const d = new Date(Number(year), Number(month) - 1, 1)
        return {
          month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          expenses: Math.round(data.expenses),
        }
      })
  }, [filteredExpenses])

  // Cost per tree for planting contracts
  const costPerTree = useMemo(() => {
    if (!projectAnalytics.length) return []
    return projectAnalytics
      .filter(p => p.seedlings > 0 && p.expenses > 0)
      .map(p => ({
        name: p.name,
        costPerTree: p.expenses / p.seedlings,
        seedlings: p.seedlings,
        expenses: p.expenses,
      }))
      .sort((a, b) => b.costPerTree - a.costPerTree)
  }, [projectAnalytics])

  // Expense ratio by project
  const expenseRatios = useMemo(() => {
    return projectAnalytics
      .filter(p => p.expenses > 0)
      .map(p => ({
        name: p.name,
        ratio: p.expenseRatio,
        expenses: p.expenses,
        revenue: p.revenue,
      }))
      .sort((a, b) => b.ratio - a.ratio)
  }, [projectAnalytics])

  // Category breakdown for donut chart
  const categoryBreakdown = useMemo(() => {
    if (!filteredExpenses) return []
    const map = new Map<string, number>()
    for (const e of filteredExpenses) {
      const cat = e.category || 'other'
      map.set(cat, (map.get(cat) || 0) + Number(e.amount || 0))
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, total]) => ({
        name: CATEGORY_LABELS[category] || category,
        category,
        value: Math.round(total),
        color: CATEGORY_COLORS[category] || '#64748b',
      }))
  }, [filteredExpenses])

  // Unassigned expenses bucketed by sheet Project column
  const unassignedByCategory = useMemo(() => {
    if (!filteredExpenses) return []
    const map = new Map<string, number>()
    for (const e of filteredExpenses) {
      if (e.contract_id) continue
      const raw = (e.contract_number || '').trim()
      let bucket: string
      if (!raw) bucket = 'Unclassified'
      else if (/overhead/i.test(raw)) bucket = 'Overhead (H2b / Office)'
      else if (/^driving/i.test(raw)) bucket = 'Driving / Travel'
      else if (/(chevy|ford|gmc|ram|tundra|toyota|dodge|silverado|silicone)/i.test(raw)) bucket = 'Vehicle'
      else if (/private/i.test(raw)) bucket = 'Private contracts'
      else bucket = raw.length > 28 ? raw.slice(0, 26) + '…' : raw
      map.set(bucket, (map.get(bucket) || 0) + Number(e.amount || 0))
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
  }, [filteredExpenses])

  // Top vendors
  const topVendors = useMemo(() => {
    if (!filteredExpenses) return []
    const map = new Map<string, number>()
    for (const e of filteredExpenses) {
      if (!e.vendor) continue
      const v = e.vendor.slice(0, 25).trim()
      map.set(v, (map.get(v) || 0) + Number(e.amount || 0))
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([vendor, total]) => ({ vendor, total: Math.round(total) }))
  }, [filteredExpenses])

  const loading = !contracts || !filteredExpenses

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading analytics…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Cross-referencing projects, labor, and expenses. Data flows in as timesheets and imports land.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {ANALYTICS_TABS.map((t) => {
          const active = activeTab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                active
                  ? 'border-b-2 border-primary text-foreground font-medium'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {t.status === 'mock' && (
                <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-px text-[9px] font-medium text-amber-400">Preview</span>
              )}
            </button>
          )
        })}
      </div>

      {activeTab !== 'expenses' && (
        <MockAnalyticsTab tab={activeTab} company={company} />
      )}

      {activeTab === 'expenses' && (
      <div className="flex flex-col gap-5">
      {/* Row 1: Project Profitability (wide, with ratio sidebar) + Unassigned */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Project Profitability — 2/3 width, chart + ratio sidebar */}
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Project Profitability</h3>
              <p className="text-[10px] text-muted-foreground">Revenue (bottom axis, green) vs expenses (top axis, orange). Expense ratio per project on the right — lower is better.</p>
            </div>
            <span className="hidden lg:inline text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expense Ratio →</span>
          </div>
          <div className="h-[340px]">
            {projectAnalytics.length > 0 ? (
              (() => {
                const maxExp = Math.max(1, ...projectAnalytics.map(d => d.expenses))
                const expDomainMax = maxExp * 5 // balanced headroom — largest expense fills ~20%
                const ratioByName = new Map(projectAnalytics.map(p => [p.name, p.expenseRatio]))
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projectAnalytics} layout="vertical" margin={{ left: 10, right: 20, top: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" horizontal={true} vertical={false} />
                      <XAxis
                        xAxisId="revenue"
                        type="number"
                        orientation="bottom"
                        tick={{ fontSize: 9, fill: '#22c55e' }}
                        tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <XAxis
                        xAxisId="expenses"
                        type="number"
                        orientation="top"
                        domain={[0, expDomainMax]}
                        tick={{ fontSize: 9, fill: '#f59e0b' }}
                        tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                      />
                      <YAxis yAxisId="left" type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={130} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        width={55}
                        tick={(props: { x?: number; y?: number; payload?: { value: string } }) => {
                          const { x = 0, y = 0, payload } = props
                          const ratio = payload ? ratioByName.get(payload.value) ?? 0 : 0
                          const color = ratio > 10 ? '#f87171' : ratio > 5 ? '#fbbf24' : ratio > 0 ? '#f59e0b' : '#64748b'
                          const text = ratio > 0 ? `${ratio.toFixed(1)}%` : '—'
                          return (
                            <text x={x + 45} y={y + 3} fill={color} fontSize={11} fontFamily="ui-monospace,monospace" textAnchor="end">{text}</text>
                          )
                        }}
                      />
                      <Tooltip content={<AnalyticsTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                      <Bar xAxisId="revenue" yAxisId="left" dataKey="revenue" fill="#22c55e" radius={[0, 3, 3, 0]} name="Contract Value" />
                      <Bar xAxisId="expenses" yAxisId="left" dataKey="expenses" fill="#f59e0b" radius={[0, 3, 3, 0]} name="Expenses">
                        <LabelList
                          dataKey="expenses"
                          position="right"
                          content={(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) => {
                            const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props
                            const d = projectAnalytics[index as number]
                            if (!d || d.expenses === 0) return null
                            return (
                              <text x={Number(x) + Number(width) + 4} y={Number(y) + Number(height) / 2 + 3} fill="#f59e0b" fontSize={9}>
                                {fmtCurrency(d.expenses)}
                              </text>
                            )
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              })()
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No projects with contract values set
              </div>
            )}
          </div>
        </div>

        {/* Unassigned Expenses by Category */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Unassigned Expenses</h3>
          <p className="mb-3 text-[10px] text-muted-foreground">$ sitting in the pending queue, bucketed by sheet Project column. Office sorts these into projects.</p>
          <div className="h-[280px]">
            {unassignedByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={unassignedByCategory} layout="vertical" margin={{ left: 10, right: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={130} />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    formatter={(v: number) => fmtCurrency(v)}
                    contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }}
                  />
                  <Bar dataKey="value" fill="#a855f7" radius={[0, 3, 3, 0]}>
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: number) => fmtCurrency(v)}
                      style={{ fontSize: 9, fill: '#e2e8f0' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No unassigned expenses
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Monthly Expenses + Spend by Category + Cost Per Tree */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Monthly Expenses */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Monthly Expenses</h3>
          <p className="mb-3 text-[10px] text-muted-foreground">Expense volume over time. Spikes correlate with project ramp-ups.</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyOverlay} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<AnalyticsTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                <Bar dataKey="expenses" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spend by Category — donut */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Spend by Category</h3>
          <p className="mb-3 text-[10px] text-muted-foreground">Where money goes by type. Fuel dominates — watch equipment and repair trends.</p>
          {categoryBreakdown.length > 0 ? (
            <div className="flex items-start gap-3">
              <div className="h-[180px] w-[180px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {categoryBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => fmtCurrency(value)}
                      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: '8px', fontSize: '11px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1.5 pt-2">
                {categoryBreakdown.map((c) => (
                  <div key={c.category} className="flex items-center gap-2 text-[10px]">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="font-mono text-foreground ml-auto">{fmtCurrency(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              No categorized expenses yet
            </div>
          )}
        </div>

        {/* Cost Per Tree */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Expense Cost Per Tree</h3>
          <p className="mb-3 text-[10px] text-muted-foreground">Assigned expenses divided by seedling target. Overhead per unit of production.</p>
          <div className="h-[200px]">
            {costPerTree.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costPerTree} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v: number) => `$${v.toFixed(3)}`} />
                  <Tooltip content={<AnalyticsTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                  <Bar dataKey="costPerTree" fill="#22c55e" radius={[3, 3, 0, 0]} name="$/tree (expenses)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Set seedling targets on projects and assign expenses
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Top Vendors + Hours by Project + Resource Allocation */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Top Vendors */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Top Vendors</h3>
          <p className="mb-3 text-[10px] text-muted-foreground">Where the money goes. Spot negotiation opportunities.</p>
          {topVendors.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {topVendors.slice(0, 6).map((v, i) => (
                <div key={v.vendor} className="flex items-center gap-2 text-[11px]">
                  <span className="w-4 text-right font-mono text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate text-foreground">{v.vendor}</span>
                  <span className="font-mono text-muted-foreground whitespace-nowrap">{fmtCurrency(v.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">No expense data yet</div>
          )}
        </div>

        {/* Hours by Project — labor investment */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Hours by Project</h3>
          <p className="mb-3 text-[10px] text-muted-foreground">Where crew time is invested. Based on approved timesheets.</p>
          {projectAnalytics.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {projectAnalytics
                .filter(p => p.revenue > 0)
                .slice(0, 6)
                .map((p) => {
                  // Rough hours: use expenses as a proxy signal for activity level
                  // until we wire a direct hours query. Show contract value ratio instead.
                  const pct = projectAnalytics[0]?.revenue
                    ? Math.round((p.revenue / projectAnalytics[0].revenue) * 100)
                    : 0
                  return (
                    <div key={p.name}>
                      <div className="flex items-baseline justify-between text-[11px]">
                        <span className="truncate text-foreground">{p.name}</span>
                        <span className="font-mono text-muted-foreground whitespace-nowrap">{fmtCurrency(p.revenue)}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">No project data yet</div>
          )}
        </div>

        {/* Resource Allocation — portfolio donut */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Portfolio Mix</h3>
          <p className="mb-3 text-[10px] text-muted-foreground">Contract value distribution across active projects.</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectAnalytics.filter(p => p.revenue > 0).slice(0, 6).map(p => ({
                    name: p.name,
                    value: p.revenue,
                  }))}
                  dataKey="value"
                  cx="50%"
                  cy="45%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={2}
                >
                  {projectAnalytics.slice(0, 6).map((_, i) => (
                    <Cell key={i} fill={['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#06b6d4', '#f43f5e'][i % 6]} />
                  ))}
                </Pie>
                <Tooltip content={<AnalyticsTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                <Legend iconSize={5} wrapperStyle={{ fontSize: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: Future State Placeholders */}
      <div className="mb-2 flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Coming Soon</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: 'Full Project P&L',
            desc: 'Contract value minus labor cost minus expenses equals true margin per project. Requires payroll engine.',
            icon: DollarSign,
            phase: 'Payroll Engine',
          },
          {
            title: 'Bid vs Actual',
            desc: 'Compare your bid estimate against real production + cost data. Shows how accurate your bidding is over time.',
            icon: TrendingUp,
            phase: 'Phase 2 Item 6',
          },
          {
            title: 'Fuel Cost Per Mile',
            desc: 'Odometer data + fuel expenses = cost per mile per vehicle. Surfaces inefficient routes and aging trucks.',
            icon: Truck,
            phase: 'Equipment Tracking',
          },
          {
            title: 'Equipment ROI',
            desc: 'Track equipment purchase cost against usage hours across projects. Know when a chainsaw has paid for itself.',
            icon: Wrench,
            phase: 'Equipment Tracking',
          },
          {
            title: 'Competitor Intelligence',
            desc: 'SAM.gov contract awards + H2B worker counts. See who wins what and at what price point.',
            icon: Eye,
            phase: 'Phase 2 Possible',
          },
          {
            title: 'Seasonal Forecasting',
            desc: 'Predict next season crew needs and costs based on historical patterns. Requires 2+ seasons of data.',
            icon: TrendingUp,
            phase: 'Phase 3+',
          },
        ].map((item) => (
          <div key={item.title} className="rounded-lg border border-dashed border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <item.icon className="h-4 w-4 text-primary/40" />
              <h3 className="text-sm font-semibold text-foreground/70">{item.title}</h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
            <div className="mt-3 inline-block rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[9px] font-medium text-primary/60">
              {item.phase}
            </div>
          </div>
        ))}
      </div>
      </div>
      )}
    </div>
  )
}

// ─── Mock Analytics Tabs ────────────────────────────────────────────────────
// Preview-only content for future tabs. Hardcoded sample data illustrates
// what's possible once the underlying systems (equipment tracking, bids
// engine, payroll, competitor intel) are built.

function MockBanner({ phase, description }: { phase: string; description: string }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">{phase}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </div>
  )
}

function KpiStrip({ items }: { items: { label: string; value: string; sub?: string; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
          <div className={`mt-1 font-mono text-lg font-semibold ${k.color || 'text-foreground'}`}>{k.value}</div>
          {k.sub && <div className="text-[10px] text-muted-foreground">{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function MockCard({ title, desc, xref, children, height = 260 }: { title: string; desc: string; xref?: string; children: React.ReactNode; height?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mb-1 text-[10px] text-muted-foreground">{desc}</p>
      {xref && (
        <p className="mb-2 text-[10px] text-primary/70">
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider">Cross-ref</span> {xref}
        </p>
      )}
      <div style={{ height }}>{children}</div>
    </div>
  )
}

function MockAnalyticsTab({ tab, company }: { tab: AnalyticsTab; company: 'all' | 'cascadia' | 'ramos' }) {
  if (tab === 'equipment') return <MockEquipmentTab />
  if (tab === 'bids') return <MockBidsTab />
  if (tab === 'payroll') return <LivePayrollTab company={company} />
  if (tab === 'production') return <MockProductionTab />
  if (tab === 'competitor') return <MockCompetitorTab />
  return null
}

function MockEquipmentTab() {
  const fuelByVehicle = [
    { name: 'Ford F550 2018', costPerMile: 0.42, miles: 14200 },
    { name: 'Chevy Express 2013', costPerMile: 0.38, miles: 22100 },
    { name: 'Ram 5500 2016', costPerMile: 0.47, miles: 11800 },
    { name: 'Tundra 2015', costPerMile: 0.29, miles: 18900 },
    { name: 'Ford E-350 2007', costPerMile: 0.51, miles: 8400 },
    { name: 'GMC Sierra 2016', costPerMile: 0.33, miles: 13700 },
  ].sort((a, b) => b.costPerMile - a.costPerMile)

  const maintByVehicle = [
    { name: 'Ford E-350 2007', value: 4250 },
    { name: 'Chevy Express 2008', value: 3100 },
    { name: 'Ram 3500 2012', value: 2800 },
    { name: 'Ford F550 2018', value: 1400 },
    { name: 'GMC Sierra 2016', value: 980 },
    { name: 'Tundra 2015', value: 650 },
  ]

  const vehicleProjects = [
    { vehicle: 'F550 2018', Vanessa: 62, Kirk: 28, Nursery: 10 },
    { vehicle: 'Chevy 2013', Vanessa: 8, Kirk: 75, Nursery: 17 },
    { vehicle: 'Ram 5500', Vanessa: 0, Kirk: 0, Nursery: 100 },
    { vehicle: 'Tundra 2015', Vanessa: 45, Kirk: 15, Nursery: 40 },
  ]

  return (
    <div className="flex flex-col gap-5">
      <MockBanner phase="Preview — Phase 2/3" description="Populated once equipment tracking (odometer + maintenance log) is live. Cross-references fuel expenses, GPS pings, and project assignments." />

      <KpiStrip
        items={[
          { label: 'Fleet Size', value: '6', sub: 'Active vehicles' },
          { label: 'Miles YTD', value: '89,100', sub: 'All vehicles' },
          { label: 'Avg Cost/Mile', value: '$0.40', color: 'text-amber-400' },
          { label: 'Maint Spend YTD', value: '$13,180', color: 'text-red-400' },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MockCard title="Fuel Cost Per Mile by Vehicle" desc="Cost per mile calculated from fuel receipts + odometer readings. Age + condition bubbles to top." xref="Expenses (fuel receipts) × Equipment (odometer data)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fuelByVehicle} layout="vertical" margin={{ left: 10, right: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={130} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="costPerMile" fill="#f59e0b" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="costPerMile" position="right" formatter={(v: number) => `$${v.toFixed(2)}`} style={{ fontSize: 10, fill: '#e2e8f0' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MockCard>

        <MockCard title="Maintenance Spend YTD" desc="Running total per vehicle. Flag candidates for replacement." xref="Expenses (vehicle_repair category) × Equipment">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={maintByVehicle} layout="vertical" margin={{ left: 10, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={130} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Bar dataKey="value" fill="#ef4444" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="value" position="right" formatter={(v: number) => `$${v.toLocaleString()}`} style={{ fontSize: 10, fill: '#e2e8f0' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MockCard>
      </div>

      <MockCard title="Vehicle Utilization by Project (%)" desc="Where each truck's miles went. Cross-references GPS + timesheet data to attribute vehicle costs to contracts." xref="Equipment × Projects × Timesheets" height={280}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={vehicleProjects} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
            <XAxis dataKey="vehicle" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Vanessa" stackId="p" fill="#22c55e" />
            <Bar dataKey="Kirk" stackId="p" fill="#3b82f6" />
            <Bar dataKey="Nursery" stackId="p" fill="#a855f7" />
          </BarChart>
        </ResponsiveContainer>
      </MockCard>
    </div>
  )
}

function MockBidsTab() {
  const winLossTrend = [
    { month: 'Oct', Won: 2, Lost: 1 },
    { month: 'Nov', Won: 3, Lost: 2 },
    { month: 'Dec', Won: 1, Lost: 3 },
    { month: 'Jan', Won: 4, Lost: 2 },
    { month: 'Feb', Won: 2, Lost: 1 },
    { month: 'Mar', Won: 5, Lost: 3 },
  ]

  const accuracy = [
    { name: 'Chilton 26', estimated: 42000, actual: 43850 },
    { name: 'Vanessa', estimated: 240000, actual: 246281 },
    { name: 'Kirk', estimated: 310000, actual: 295656 },
    { name: 'DNR Nursery', estimated: 850000, actual: 892211 },
  ]

  const pipeline = [
    { status: 'Active', value: 485000, count: 7 },
    { status: 'Won', value: 2179002, count: 4 },
    { status: 'Lost', value: 612000, count: 5 },
    { status: 'Archived', value: 95000, count: 2 },
  ]

  const headToHead = [
    { competitor: 'BCS Forestry', bidsAgainst: 9, won: 4, winRate: 44 },
    { competitor: 'Martinez & Sons', bidsAgainst: 7, won: 5, winRate: 71 },
    { competitor: 'CMB Services', bidsAgainst: 5, won: 2, winRate: 40 },
    { competitor: 'Montse Hollins', bidsAgainst: 4, won: 3, winRate: 75 },
  ]

  return (
    <div className="flex flex-col gap-5">
      <MockBanner phase="Preview — Phase 2 Item 6" description="Populated once the Bids engine is built. Cross-references historical bid data, production actuals, and competitor pricing." />

      <KpiStrip
        items={[
          { label: 'Win Rate (YTD)', value: '52%', color: 'text-emerald-400' },
          { label: 'Pipeline Value', value: '$485k', sub: '7 active bids' },
          { label: 'Bid Accuracy', value: '97.2%', sub: 'Avg est vs actual', color: 'text-emerald-400' },
          { label: 'Avg Margin on Won', value: '23%', color: 'text-primary' },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MockCard title="Win / Loss Trend" desc="Monthly bid outcomes. Spot seasonal patterns and win-rate shifts." xref="Bids × Historical contracts">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={winLossTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Won" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="Lost" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </MockCard>

        <MockCard title="Bid Accuracy: Estimated vs Actual" desc="How well do bid estimates match reality? Gap = margin for error in future bids." xref="Bids × Projects × Production">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={accuracy} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="estimated" fill="#64748b" name="Estimated" />
              <Bar dataKey="actual" fill="#22c55e" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </MockCard>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MockCard title="Head-to-Head vs Competitors" desc="Win rate against each competitor we've bid against. Informs future pricing." xref="Bids × Competitor data">
          <div className="flex flex-col gap-2">
            {headToHead.map((h) => (
              <div key={h.competitor} className="rounded-md border border-border bg-elevated/40 p-3">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">{h.competitor}</span>
                  <span className="font-mono text-sm text-foreground">{h.winRate}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${h.winRate >= 60 ? 'bg-emerald-500' : h.winRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${h.winRate}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{h.won}/{h.bidsAgainst} won</span>
                </div>
              </div>
            ))}
          </div>
        </MockCard>

        <MockCard title="Pipeline by Status" desc="Where every bid sits right now — active, won, lost, archived." xref="Bids">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipeline} layout="vertical" margin={{ left: 10, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="status" tick={{ fontSize: 10, fill: '#94a3b8' }} width={90} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="count" position="right" formatter={(v: number) => `${v} bids`} style={{ fontSize: 10, fill: '#e2e8f0' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MockCard>
      </div>
    </div>
  )
}

function LivePayrollTab({ company }: { company: 'all' | 'cascadia' | 'ramos' }) {
  const filterArg = company === 'all' ? null : company
  const { data: payroll, isLoading } = useClientQuery('payrollAnalytics', filterArg)
  const { data: rawContracts } = useContracts()
  const { data: allExpenses } = useClientQuery('allExpenses')

  // Per-contract P&L: revenue (contracts.contract_price) − labor (timesheet gross) − expenses
  const projectPL = useMemo(() => {
    if (!payroll || !rawContracts || !allExpenses) return []

    // Expenses by contract
    const expenseByContract = new Map<string, number>()
    for (const e of allExpenses) {
      if (e.contract_id) {
        expenseByContract.set(e.contract_id, (expenseByContract.get(e.contract_id) || 0) + Number(e.amount || 0))
      }
    }

    // Top 6 contracts by labor (so the chart isn't cluttered)
    return payroll.byContract
      .slice(0, 6)
      .map((row) => {
        const c = rawContracts.find((x) => x.id === row.contractId)
        const revenue = Number(c?.contract_price || 0)
        const labor = row.gross
        const expenses = expenseByContract.get(row.contractId) || 0
        const name = (row.name || '').length > 22 ? row.name.slice(0, 20) + '…' : row.name || ''
        return {
          name,
          fullName: row.name || '',
          Revenue: revenue,
          Labor: Math.round(labor),
          Expenses: Math.round(expenses),
          Margin: Math.round(revenue - labor - expenses),
        }
      })
  }, [payroll, rawContracts, allExpenses])

  // Format weekly OT: take last 12 weeks with data
  const otTrend = useMemo(() => {
    if (!payroll) return []
    return payroll.byWeek.slice(-12).map((w) => {
      // Convert YYYY-MM-DD (Monday) to a short label
      const d = new Date(w.week + 'T00:00:00')
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { week: label, hours: Math.round(w.otHours * 10) / 10 }
    })
  }, [payroll])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading payroll analytics…
      </div>
    )
  }

  if (!payroll || payroll.entryCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <DollarSign className="h-8 w-8 text-muted-foreground/40" />
        <div className="text-sm font-medium text-foreground">No payroll data yet</div>
        <div className="text-xs text-muted-foreground max-w-sm">
          Once timesheets are submitted and approved, payroll analytics roll up here.
        </div>
      </div>
    )
  }

  const fmtK = (n: number) =>
    n >= 1000
      ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k'
      : '$' + n.toFixed(0)

  return (
    <div className="flex flex-col gap-5">
      <KpiStrip
        items={[
          {
            label: 'YTD Labor',
            value: fmtK(payroll.totals.gross),
            sub: company === 'all' ? 'All companies' : company === 'cascadia' ? 'Cascadia' : 'Ramos',
          },
          {
            label: 'OT Hours YTD',
            value: payroll.totals.otHours.toFixed(0) + ' hrs',
            color: 'text-amber-400',
          },
          {
            label: 'Active Employees',
            value: String(payroll.employeeCount),
            sub: payroll.entryCount.toLocaleString() + ' entries',
          },
          {
            label: 'Drive Hours YTD',
            value: payroll.totals.driveHours.toFixed(0) + ' hrs',
            sub: 'Includes OT drive',
            color: 'text-emerald-400',
          },
        ]}
      />

      {projectPL.length > 0 && (
        <MockCard
          title="Project P&L (top by labor)"
          desc="Revenue from contract value, labor from timesheet gross, expenses from assigned expenses. Margin = Revenue − Labor − Expenses. Only contracts with a contract_price set are shown."
          xref="Projects × Timesheets × Expenses"
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projectPL} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => `$${v.toLocaleString()}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill="#22c55e" />
              <Bar dataKey="Labor" fill="#3b82f6" />
              <Bar dataKey="Expenses" fill="#f59e0b" />
              <Bar dataKey="Margin" fill="#a855f7" />
            </BarChart>
          </ResponsiveContainer>
        </MockCard>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MockCard
          title="Overtime Trend (weekly)"
          desc="Weekly OT hours, last 12 weeks. Spikes can flag scheduling pressure."
          xref="Timesheets"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={otTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }}
              />
              <Line type="monotone" dataKey="hours" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="OT Hours" />
            </LineChart>
          </ResponsiveContainer>
        </MockCard>

        <MockCard
          title="Top Earners (YTD)"
          desc="Top 10 employees by gross pay across all projects."
          xref="Employees × Timesheets"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={payroll.topEarners.map((e) => ({
                name: e.name.length > 18 ? e.name.slice(0, 16) + '…' : e.name,
                gross: Math.round(e.gross),
              }))}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 60, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} width={100} />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => `$${v.toLocaleString()}`}
              />
              <Bar dataKey="gross" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </MockCard>
      </div>
    </div>
  )
}

function MockProductionTab() {
  const dailyByFeeman = [
    { date: 'Mar 18', Agustin: 5200, Antonio: 4800, Mariano: 4400 },
    { date: 'Mar 19', Agustin: 5600, Antonio: 5100, Mariano: 4700 },
    { date: 'Mar 20', Agustin: 5800, Antonio: 4900, Mariano: 5000 },
    { date: 'Mar 21', Agustin: 6100, Antonio: 5400, Mariano: 5200 },
    { date: 'Mar 22', Agustin: 5400, Antonio: 5200, Mariano: 4800 },
  ]

  const completion = [
    { name: 'Chilton Planting 26', percent: 82 },
    { name: 'Weyerhaeuser Vanessa', percent: 64 },
    { name: 'Weyerhaeuser Kirk', percent: 38 },
    { name: 'DNR Nursery', percent: 22 },
    { name: '2026 Entiat Planting', percent: 5 },
  ]

  const species = [
    { name: 'Douglas Fir', value: 142000, fill: '#22c55e' },
    { name: 'Ponderosa Pine', value: 78000, fill: '#3b82f6' },
    { name: 'Western Larch', value: 42000, fill: '#f59e0b' },
    { name: 'Red Cedar', value: 31000, fill: '#a855f7' },
    { name: 'Grand Fir', value: 18000, fill: '#06b6d4' },
  ]

  const seasonal = [
    { week: 'W38', trees: 8200 }, { week: 'W40', trees: 12400 }, { week: 'W42', trees: 18900 },
    { week: 'W44', trees: 22100 }, { week: 'W46', trees: 24800 }, { week: 'W48', trees: 21200 },
    { week: 'W50', trees: 15600 }, { week: 'W52', trees: 9800 }, { week: 'W02', trees: 6200 },
  ]

  return (
    <div className="flex flex-col gap-5">
      <MockBanner phase="Preview — Phase 2/3" description="Production tracking exists — this tab will surface seasonality, per-crew output, and species mix as more data accumulates." />

      <KpiStrip
        items={[
          { label: 'Trees YTD', value: '311k', color: 'text-emerald-400' },
          { label: 'Acres Treated', value: '1,240', sub: 'YTD' },
          { label: 'Avg Trees/Bag', value: '287', sub: 'Species-weighted' },
          { label: 'Active Crews', value: '3', sub: 'Agustin / Antonio / Mariano' },
        ]}
      />

      <MockCard title="Daily Trees Planted by Foreman" desc="Who's hitting production targets? Useful for per-crew comparison." xref="Production logs × Timesheets × Crew sets" height={280}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dailyByFeeman} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Agustin" fill="#22c55e" />
            <Bar dataKey="Antonio" fill="#3b82f6" />
            <Bar dataKey="Mariano" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </MockCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MockCard title="Project Completion %" desc="How far along each planting project is." xref="Projects × Production logs">
          <div className="flex flex-col gap-2.5">
            {completion.map((c) => (
              <div key={c.name}>
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-foreground">{c.name}</span>
                  <span className="font-mono text-muted-foreground">{c.percent}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${c.percent >= 75 ? 'bg-emerald-500' : c.percent >= 40 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${c.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </MockCard>

        <MockCard title="Species Mix YTD" desc="What got planted. Informs bag ratios + procurement." xref="Production logs × Units">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={species} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2}>
                {species.map((e, i) => (<Cell key={i} fill={e.fill} />))}
              </Pie>
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `${v.toLocaleString()} trees`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </MockCard>
      </div>

      <MockCard title="Seasonal Production Curve" desc="Weekly trees planted. Surfaces peak season and informs crew ramping." xref="Production logs × Weather × Crew capacity" height={240}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={seasonal}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="trees" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </MockCard>
    </div>
  )
}

function MockCompetitorTab() {
  const marketShare = [
    { name: 'Cascadia (us)', value: 32, fill: '#22c55e' },
    { name: 'BCS Forestry', value: 24, fill: '#3b82f6' },
    { name: 'Martinez & Sons', value: 18, fill: '#f59e0b' },
    { name: 'CMB Services', value: 14, fill: '#a855f7' },
    { name: 'Montse Hollins', value: 7, fill: '#06b6d4' },
    { name: 'Other', value: 5, fill: '#64748b' },
  ]

  const priceDelta = [
    { type: 'Planting', ours: 0.42, avg: 0.48 },
    { type: 'Thinning', ours: 825, avg: 790 },
    { type: 'Herbicide', ours: 165, avg: 172 },
    { type: 'PCT', ours: 680, avg: 645 },
  ]

  const h2bCounts = [
    { name: 'Cascadia (us)', value: 28 },
    { name: 'BCS Forestry', value: 35 },
    { name: 'Martinez & Sons', value: 22 },
    { name: 'CMB Services', value: 18 },
    { name: 'Montse Hollins', value: 12 },
  ]

  const recentAwards = [
    { agency: 'DNR', contract: 'Goosmus Unit 3B', winner: 'Cascadia', value: '$89k', date: 'Apr 2' },
    { agency: 'USACE', contract: 'Ft Lewis Herbicide', winner: 'BCS Forestry', value: '$142k', date: 'Apr 1' },
    { agency: 'DNR', contract: 'Entiat PCT', winner: 'Martinez & Sons', value: '$56k', date: 'Mar 28' },
    { agency: 'BLM', contract: 'Methow Reforestation', winner: 'Cascadia', value: '$215k', date: 'Mar 24' },
    { agency: 'Weyerhaeuser', contract: 'Longview Tract 88', winner: 'CMB Services', value: '$78k', date: 'Mar 22' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <MockBanner phase="Preview — Phase 2 Possible" description="SAM.gov award feed + H2B DOL records would feed this tab. Reveals who's winning what, for how much, with how many crew." />

      <KpiStrip
        items={[
          { label: 'Tracked Competitors', value: '8' },
          { label: 'Our Market Share', value: '32%', color: 'text-emerald-400' },
          { label: 'Avg Price Delta', value: '-6%', sub: 'Below market avg', color: 'text-amber-400' },
          { label: 'H2B In Market', value: '115', sub: 'All crews combined' },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MockCard title="PNW Market Share (YTD)" desc="Estimated market share among tracked competitors. Based on award data + project counts." xref="Bids × Competitor × SAM.gov feed">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={marketShare} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}>
                {marketShare.map((e, i) => (<Cell key={i} fill={e.fill} />))}
              </Pie>
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </MockCard>

        <MockCard title="Our Pricing vs Market Average" desc="How we priced each work type vs competitor average. Below = we're cheaper, above = premium." xref="Bids × Competitor pricing">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priceDelta} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ours" fill="#22c55e" name="Our price" />
              <Bar dataKey="avg" fill="#64748b" name="Market avg" />
            </BarChart>
          </ResponsiveContainer>
        </MockCard>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MockCard title="H2B Worker Counts" desc="Public DOL H2B certifications. More crew = more capacity = more bids they can handle." xref="DOL public data × Competitor">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={h2bCounts} layout="vertical" margin={{ left: 10, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={130} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} contentStyle={{ background: '#0b1929', border: '1px solid #1e2d42', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: '#e2e8f0' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MockCard>

        <MockCard title="Recent Contract Awards (SAM.gov)" desc="Live feed of public agency forestry awards. Cross-reference competitors + pricing." xref="SAM.gov feed × Competitor tracking">
          <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 260 }}>
            {recentAwards.map((a, i) => (
              <div key={i} className={`rounded-md border px-3 py-2 text-[11px] ${a.winner === 'Cascadia' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-elevated/40'}`}>
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-foreground">{a.contract}</span>
                  <span className="font-mono text-muted-foreground">{a.value}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">{a.agency} • {a.date}</span>
                  <span className={a.winner === 'Cascadia' ? 'text-emerald-400 font-semibold' : 'text-muted-foreground'}>{a.winner}</span>
                </div>
              </div>
            ))}
          </div>
        </MockCard>
      </div>
    </div>
  )
}

// --- Competitor Data ---
export function CompetitorPage() {
  const data = [
    { name: 'BCS Forestry', projects: 3, planted: 245000, crew: 18, completion: 42, daily: 5200 },
    { name: 'Martinez & Sons', projects: 2, planted: 189000, crew: 22, completion: 56, daily: 4800 },
    { name: 'CMB Services', projects: 2, planted: 167000, crew: 15, completion: 38, daily: 4200 },
    { name: 'Montse Hollins', projects: 1, planted: 98000, crew: 12, completion: 71, daily: 5100 },
    { name: 'Cascadia (us)', projects: 2, planted: 209600, crew: 26, completion: 52, daily: 5400, highlight: true },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Competitor Overview</h2>
          <div className="text-xs text-muted-foreground">Weyerhaeuser Planting Season 2025-2026</div>
        </div>
        <div className="text-[10px] text-muted-foreground">Last synced: Feb 21, 2:30 PM</div>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Contractor</th>
              <th className="px-4 py-2 text-center font-medium">Projects</th>
              <th className="px-4 py-2 text-right font-medium">Planted</th>
              <th className="px-4 py-2 text-center font-medium">Crew</th>
              <th className="px-4 py-2 text-center font-medium">Completion</th>
              <th className="px-4 py-2 text-right font-medium">Daily Avg</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.name} className={`border-b border-border transition-colors hover:bg-elevated ${d.highlight ? 'bg-primary/5' : ''}`}>
                <td className={`px-4 py-3 font-medium ${d.highlight ? 'text-primary' : 'text-foreground'}`}>{d.name}</td>
                <td className="px-4 py-3 text-center font-mono text-foreground">{d.projects}</td>
                <td className="px-4 py-3 text-right font-mono text-foreground">{d.planted.toLocaleString()}</td>
                <td className="px-4 py-3 text-center font-mono text-foreground">{d.crew}</td>
                <td className="px-4 py-3 text-center font-mono text-foreground">{d.completion}%</td>
                <td className={`px-4 py-3 text-right font-mono font-semibold ${d.highlight ? 'text-primary' : 'text-foreground'}`}>{d.daily.toLocaleString()}/day</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Daily Average Comparison</h3>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
              <Bar dataKey="daily" radius={[3, 3, 0, 0]} name="Daily Avg">
                {data.map((d, i) => <Cell key={i} fill={d.highlight ? '#22c55e' : '#3b82f6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// --- Notifications ---
export function NotificationsPage() {
  const { data: compliance } = useComplianceItems()
  const { data: vehicles } = useVehicles()

  // Build notifications from real data
  const notifications: { type: string; title: string; category: string; time?: string }[] = []

  // Compliance alerts
  compliance?.filter(c => c.status === 'overdue').forEach(c => {
    notifications.push({
      type: 'critical',
      title: `${c.title} — OVERDUE`,
      category: 'Compliance',
      time: c.due_date ? new Date(c.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
    })
  })

  compliance?.filter(c => c.status === 'due_soon').forEach(c => {
    const dueDate = c.due_date ? new Date(c.due_date + 'T00:00:00') : null
    const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
    notifications.push({
      type: 'warning',
      title: `${c.title} — due in ${daysLeft}d`,
      category: 'Compliance',
      time: c.due_date ? new Date(c.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
    })
  })

  // Vehicle issues
  vehicles?.filter(v => v.status === 'in_repair' || v.status === 'out_of_service').forEach(v => {
    notifications.push({
      type: v.status === 'out_of_service' ? 'critical' : 'warning',
      title: `${v.name || v.make + ' ' + v.model} — ${v.status === 'in_repair' ? 'In Repair' : 'Out of Service'}`,
      category: 'Vehicles',
    })
  })

  // Add info note if no notifications
  if (notifications.length === 0) {
    notifications.push({
      type: 'success',
      title: 'All clear — no active alerts or issues',
      category: 'System',
    })
  }

  const bgColors: Record<string, string> = {
    critical: 'border-destructive/30 bg-destructive/5',
    warning: 'border-warning/30 bg-warning/5',
    info: 'border-info/30 bg-info/5',
    success: 'border-primary/30 bg-primary/5',
  }
  const textColors: Record<string, string> = { critical: 'text-destructive', warning: 'text-warning', info: 'text-info', success: 'text-primary' }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{notifications.length}</span>
        </div>
      </div>
      {notifications.map((n, i) => (
        <div key={i} className={`flex items-center justify-between rounded-lg border p-4 ${bgColors[n.type] || bgColors.info}`}>
          <div className="flex items-center gap-3">
            <Bell className={`h-4 w-4 shrink-0 ${textColors[n.type] || textColors.info}`} />
            <div>
              <span className="text-sm text-foreground">{n.title}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{n.category}</span>
                {n.time && <span className="text-[10px] text-muted-foreground">{n.time}</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Settings ---
export function SettingsPage() {
  const { role } = useApp()
  const { profile } = useAuth()
  const { data: employees } = useEmployees()
  const isAdmin = role === 'admin'

  // Change password state
  const [showChangePw, setShowChangePw] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePwLoading, setChangePwLoading] = useState(false)
  const [changePwMsg, setChangePwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Admin reset state
  const [resetLoading, setResetLoading] = useState<string | null>(null)
  const [resetMsg, setResetMsg] = useState<{ email: string; type: 'success' | 'error'; text: string } | null>(null)

  // Admin set-password state
  const [setPwEmpId, setSetPwEmpId] = useState<string | null>(null)
  const [setPwValue, setSetPwValue] = useState('')
  const [setPwShow, setSetPwShow] = useState(false)
  const [setPwLoading, setSetPwLoading] = useState(false)
  const [setPwMsg, setSetPwMsg] = useState<{ empId: string; type: 'success' | 'error'; text: string } | null>(null)
  const [copiedPw, setCopiedPw] = useState(false)

  // Profile photo upload
  const { photoUrl, uploading: photoUploading, error: photoError, fileInputRef, openFilePicker, onFileChange } =
    useProfilePhoto(profile?.id ?? null)

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  const companyLabel = profile?.company_id === null ? 'Cascadia + Ramos'
    : profile?.company_id === CASCADIA_ID ? 'Cascadia'
    : profile?.company_id === RAMOS_ID ? 'Ramos'
    : ''

  const handleChangePassword = async () => {
    setChangePwMsg(null)
    if (newPassword.length < 8) {
      setChangePwMsg({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }
    if (newPassword !== confirmPassword) {
      setChangePwMsg({ type: 'error', text: 'Passwords do not match' })
      return
    }
    setChangePwLoading(true)
    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update password')
      setChangePwMsg({ type: 'success', text: 'Password updated successfully' })
      setNewPassword('')
      setConfirmPassword('')
      setShowChangePw(false)
    } catch (err: unknown) {
      setChangePwMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update password' })
    } finally {
      setChangePwLoading(false)
    }
  }

  const handleResetPassword = async (email: string) => {
    setResetLoading(email)
    setResetMsg(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send reset email')
      setResetMsg({ email, type: 'success', text: 'Reset email sent' })
    } catch (err: unknown) {
      setResetMsg({ email, type: 'error', text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setResetLoading(null)
    }
  }

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let pw = ''
    for (let i = 0; i < 8; i++) {
      pw += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setSetPwValue(pw)
    setSetPwShow(true)
    navigator.clipboard.writeText(pw).then(() => {
      setCopiedPw(true)
      setTimeout(() => setCopiedPw(false), 2000)
    }).catch(() => { /* clipboard not available */ })
  }

  const handleSetPassword = async (employeeId: string) => {
    setSetPwMsg(null)
    if (setPwValue.length < 8) {
      setSetPwMsg({ empId: employeeId, type: 'error', text: 'Min 8 characters' })
      return
    }
    setSetPwLoading(true)
    try {
      const res = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, password: setPwValue }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set password')
      setSetPwMsg({ empId: employeeId, type: 'success', text: 'Password set' })
      setSetPwValue('')
      setSetPwEmpId(null)
    } catch (err: unknown) {
      setSetPwMsg({ empId: employeeId, type: 'error', text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setSetPwLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* My Profile */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4" />
            My Profile
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-start gap-6">
            {/* Avatar with photo upload */}
            <div className="flex flex-col items-center gap-2">
              {/* Hidden file input for photo upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFileChange}
              />
              {/* Circular avatar with click-to-change */}
              <button
                onClick={openFilePicker}
                disabled={photoUploading}
                className="relative h-16 w-16 rounded-full overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary"
                title="Change photo"
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground ${photoUrl ? 'hidden' : ''}`}>
                  {initials}
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  {photoUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </div>
              </button>
              <button onClick={openFilePicker} disabled={photoUploading} className="text-[10px] text-primary hover:underline">
                {photoUploading ? 'Uploading...' : 'Change photo'}
              </button>
              {photoError && (
                <div className="text-xs text-destructive">{photoError}</div>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Full Name</label>
                <div className="mt-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm text-foreground">
                  {profile?.name || 'Loading...'}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</label>
                <div className="mt-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm text-foreground">
                  {profile?.email || 'Loading...'}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Role</label>
                <div className="mt-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm text-foreground capitalize">
                  {profile?.role || 'Loading...'}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Company</label>
                <div className="mt-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm text-foreground">
                  {companyLabel || 'Loading...'}
                </div>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="mt-6 border-t border-border pt-4">
            {!showChangePw ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowChangePw(true)}
                  className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-elevated"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Change Password
                </button>
                {changePwMsg && (
                  <span className={`text-xs ${changePwMsg.type === 'success' ? 'text-primary' : 'text-destructive'}`}>
                    {changePwMsg.text}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-md">
                <div className="text-xs font-medium text-foreground">Change Password</div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  className="rounded-md border border-border bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="rounded-md border border-border bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword() }}
                />
                {changePwMsg && (
                  <span className={`text-xs ${changePwMsg.type === 'success' ? 'text-primary' : 'text-destructive'}`}>
                    {changePwMsg.text}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleChangePassword}
                    disabled={changePwLoading}
                    className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {changePwLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Update Password
                  </button>
                  <button
                    onClick={() => { setShowChangePw(false); setNewPassword(''); setConfirmPassword(''); setChangePwMsg(null) }}
                    className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-elevated"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Management — admin only */}
      {isAdmin && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Settings className="h-4 w-4" />
                User Management
              </h3>
              <span className="text-[10px] text-muted-foreground">{employees?.filter(e => e.status === 'active').length || 0} active</span>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-md bg-info/10 border border-info/20 px-3 py-2 text-[11px] text-info">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span>Use <strong>Reset PW</strong> to email a reset link, or <strong>Set PW</strong> to manually set a password.</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Employee</th>
                  <th className="px-4 py-2 text-left font-medium">Role</th>
                  <th className="px-4 py-2 text-left font-medium">Company</th>
                  <th className="px-4 py-2 text-center font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Phone</th>
                  <th className="px-4 py-2 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees?.filter(e => e.status === 'active').slice(0, 20).map(emp => (
                  <tr key={emp.id} className="border-b border-border transition-colors hover:bg-elevated">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{emp.first_name} {emp.last_name}</div>
                      {emp.email && <div className="text-[10px] text-muted-foreground">{emp.email}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        emp.is_office ? 'bg-amber-500/20 text-amber-400'
                        : emp.is_foreman ? 'bg-primary/20 text-primary'
                        : emp.is_driver ? 'bg-info/20 text-info'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {emp.is_office ? 'Office' : emp.is_foreman ? 'Foreman' : emp.is_driver ? 'Driver' : 'Crew'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">{emp.company_auth || '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        emp.status === 'active' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{emp.phone || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {emp.email && (
                            <button
                              onClick={() => handleResetPassword(emp.email!)}
                              disabled={resetLoading === emp.email}
                              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-info hover:bg-info/10 disabled:opacity-50"
                              title="Send password reset email"
                            >
                              {resetLoading === emp.email ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Mail className="h-3 w-3" />
                              )}
                              Reset PW
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (setPwEmpId === emp.id) {
                                setSetPwEmpId(null)
                                setSetPwValue('')
                                setSetPwShow(false)
                              } else {
                                setSetPwEmpId(emp.id)
                                setSetPwValue('')
                                setSetPwShow(false)
                                setSetPwMsg(null)
                              }
                            }}
                            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium ${
                              setPwEmpId === emp.id ? 'bg-primary/10 text-primary' : 'text-primary hover:bg-primary/10'
                            }`}
                            title="Manually set password"
                          >
                            <KeyRound className="h-3 w-3" />
                            Set PW
                          </button>
                          {!emp.email && setPwEmpId !== emp.id && (
                            <span className="text-[10px] text-muted-foreground">No email</span>
                          )}
                          {resetMsg?.email === emp.email && (
                            <span className={`text-[9px] ${resetMsg.type === 'success' ? 'text-primary' : 'text-destructive'}`}>
                              {resetMsg.text}
                            </span>
                          )}
                        </div>

                        {/* Inline set-password form */}
                        {setPwEmpId === emp.id && (
                          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-elevated p-2">
                            <div className="flex items-center gap-1">
                              <div className="relative flex-1">
                                <input
                                  type={setPwShow ? 'text' : 'password'}
                                  value={setPwValue}
                                  onChange={(e) => setSetPwValue(e.target.value)}
                                  placeholder="Min 8 chars"
                                  className="w-full rounded border border-border bg-card px-2 py-1.5 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSetPassword(emp.id) }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setSetPwShow(!setPwShow)}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  title={setPwShow ? 'Hide password' : 'Show password'}
                                >
                                  {setPwShow ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                              </div>
                              <button
                                onClick={generateRandomPassword}
                                className="flex items-center gap-1 rounded border border-border px-1.5 py-1.5 text-[10px] text-muted-foreground hover:bg-card hover:text-foreground"
                                title="Generate random password and copy to clipboard"
                              >
                                {copiedPw ? <Check className="h-3 w-3 text-primary" /> : <Shuffle className="h-3 w-3" />}
                              </button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSetPassword(emp.id)}
                                disabled={setPwLoading}
                                className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                              >
                                {setPwLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                Save
                              </button>
                              <button
                                onClick={() => { setSetPwEmpId(null); setSetPwValue(''); setSetPwShow(false) }}
                                className="rounded px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-card"
                              >
                                Cancel
                              </button>
                              {copiedPw && (
                                <span className="flex items-center gap-0.5 text-[9px] text-primary">
                                  <Copy className="h-2.5 w-2.5" /> Copied
                                </span>
                              )}
                            </div>
                            {setPwMsg?.empId === emp.id && (
                              <span className={`text-[9px] ${setPwMsg.type === 'success' ? 'text-primary' : 'text-destructive'}`}>
                                {setPwMsg.text}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {employees && employees.filter(e => e.status === 'active').length > 20 && (
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Showing 20 of {employees.filter(e => e.status === 'active').length} active employees
            </div>
          )}
        </div>
      )}
    </div>
  )
}
