"use client"

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, TreePine, Building, MapPin, Calendar, DollarSign, Lock, Users, Mail, ClipboardList, Send, Loader2, Phone, AtSign, Mountain, Leaf, Pencil, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, CheckCircle2, FileText, Clock, Eye, Ban, CircleDollarSign, Trash2, MessageSquare, Archive, UserPlus, X, Upload, StickyNote, File, Layers, Folder, FolderOpen, ExternalLink, Home, Star } from 'lucide-react'
import { useContracts, useUnits, useCompanies, useEmployees, useUnitDraws, useProductionLogs, useContractHours } from '@/hooks/use-supabase'
import useClientQuery from '@/hooks/use-client-query'
import useClientMutation from '@/hooks/use-client-mutation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/app-context'
import { toast } from '@/hooks/use-toast'
import { CASCADIA_ID, RAMOS_ID } from '@/lib/database.types'
import type { Contract, Unit, UnitDraw, ProductionLog } from '@/lib/database.types'
import { CreateContractSheet } from './create-contract-sheet'
import { EditContractSheet } from './edit-contract-sheet'
import { UnitFormSheet } from './unit-form-sheet'

const statusGroups = [
  { status: 'active', label: 'Active', color: 'bg-primary', dotColor: 'bg-primary' },
  { status: 'upcoming', label: 'Upcoming', color: 'bg-info', dotColor: 'bg-info' },
  { status: 'seasonal', label: 'Seasonal', color: 'bg-warning', dotColor: 'bg-warning' },
  { status: 'pending_approval', label: 'Pending Approval', color: 'bg-amber-500', dotColor: 'bg-amber-500' },
  { status: 'closed', label: 'Closed', color: 'bg-muted-foreground/30', dotColor: 'bg-muted-foreground/40' },
  { status: 'archived', label: 'Archived', color: 'bg-muted-foreground/30', dotColor: 'bg-muted-foreground/20' },
]

const tabs = ['Overview', 'Units', 'Files', 'Notes', 'Contacts', 'Calendar', 'Expenses', 'Payroll', 'Weather', 'Production', 'Onboarding']

function companyLabel(companyId: string | null | undefined) {
  if (companyId === CASCADIA_ID) return 'Cascadia'
  if (companyId === RAMOS_ID) return 'Ramos'
  // Private contracts with no assigned company can be worked by either
  // crew — display "Both" so it's obvious in the UI this is intentional.
  if (!companyId) return 'Both'
  return 'Unknown'
}

function contractTypeLabel(type: string | null) {
  const map: Record<string, string> = {
    private: 'Private', dnr_gna: 'DNR GNA', federal: 'Federal',
    weyerhaeuser: 'Weyerhaeuser', state: 'State', county: 'County', other: 'Other',
  }
  return type ? map[type] || type : null
}

function contractTypeBadgeColor(type: string | null) {
  switch (type) {
    case 'federal': return 'bg-info/20 text-info'
    case 'dnr_gna': return 'bg-warning/20 text-warning'
    case 'weyerhaeuser': return 'bg-purple/20 text-purple'
    case 'state': return 'bg-info/20 text-info'
    case 'county': return 'bg-amber-500/20 text-amber-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'pending_approval': return 'Pending Approval'
    default: return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

function statusBadgeColor(status: string) {
  switch (status) {
    case 'active': return 'bg-primary/20 text-primary'
    case 'upcoming': return 'bg-info/20 text-info'
    case 'seasonal': return 'bg-warning/20 text-warning'
    case 'pending_approval': return 'bg-amber-500/20 text-amber-400'
    case 'closed': return 'bg-muted text-muted-foreground'
    case 'archived': return 'bg-muted text-muted-foreground'
    default: return 'bg-muted text-muted-foreground'
  }
}

function unitStatusBadge(status: string) {
  switch (status) {
    case 'completed': return { color: 'bg-primary/20 text-primary', label: 'Completed' }
    case 'in_progress': return { color: 'bg-info/20 text-info', label: 'In Progress' }
    case 'not_started': return { color: 'bg-muted text-muted-foreground', label: 'Not Started' }
    case 'pending': return { color: 'bg-amber-500/20 text-amber-400', label: 'Pending Approval' }
    default: return { color: 'bg-muted text-muted-foreground', label: status }
  }
}

const UNIT_STATUS_ORDER: Record<string, number> = { not_started: 0, in_progress: 1, completed: 2, pending: 0 }

function getContractUnits(contract: Contract, units: Unit[]) {
  return units
    .filter(u => u.contract_id === contract.id)
    .sort((a, b) => (UNIT_STATUS_ORDER[a.status] ?? 1) - (UNIT_STATUS_ORDER[b.status] ?? 1))
}

function computeProgress(contractUnits: Unit[]) {
  if (contractUnits.length === 0) return 0
  return Math.round(
    contractUnits.reduce((sum, u) => sum + (u.completion_pct || 0), 0) / contractUnits.length
  )
}

// ─── Production Progress Helpers ─────────────────────────

interface ProductionProgress {
  trees: { done: number; target: number }
  acres: { done: number; target: number }
  hours: { done: number; target: number }
}

function computeProductionProgress(contractUnits: Unit[], productionLogs: ProductionLog[]): ProductionProgress {
  const result: ProductionProgress = {
    trees: { done: 0, target: 0 },
    acres: { done: 0, target: 0 },
    hours: { done: 0, target: 0 },
  }

  // Build a map of production log totals per unit
  const logsByUnit = new Map<string, number>()
  for (const log of productionLogs) {
    const cur = logsByUnit.get(log.unit_id) || 0
    logsByUnit.set(log.unit_id, cur + (log.quantity || 0))
  }

  for (const u of contractUnits) {
    const aType = u.amount_type || 'tree'
    const bucket = aType === 'acre' ? result.acres : aType === 'hour' ? result.hours : result.trees
    const unitTarget = u.amount || 0
    bucket.target += unitTarget

    if (u.status === 'completed') {
      // Completed units contribute their full target
      bucket.done += unitTarget
    } else if (u.status === 'in_progress') {
      // In-progress units: use production logs if available, otherwise estimate from completion_pct
      const logged = logsByUnit.get(u.id)
      if (logged != null && logged > 0) {
        bucket.done += logged
      } else if (u.completion_pct && unitTarget > 0) {
        bucket.done += Math.round((u.completion_pct / 100) * unitTarget)
      }
    }
  }

  return result
}

function ProductionProgressBar({ progress }: { progress: ProductionProgress }) {
  const items = [
    { key: 'trees', label: 'Trees', ...progress.trees, unit: 'trees' },
    { key: 'acres', label: 'Acres', ...progress.acres, unit: 'acres' },
    { key: 'hours', label: 'Hours', ...progress.hours, unit: 'hrs' },
  ].filter(i => i.target > 0)

  if (items.length === 0) {
    return <span className="text-[10px] text-muted-foreground">No target set</span>
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map(item => {
        const pct = Math.min(100, Math.round((item.done / item.target) * 100))
        return (
          <div key={item.key}>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
              <span>
                <span className="font-mono text-foreground">{item.done.toLocaleString()}</span>
                {' / '}
                <span className="font-mono">{item.target.toLocaleString()}</span>
                {' '}{item.unit}
              </span>
              <span className="font-mono text-foreground">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e2d42]">
              <div
                className={`h-full rounded-full transition-all ${pct >= 75 ? 'bg-primary' : pct >= 25 ? 'bg-info' : 'bg-muted-foreground/30'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Draw Status Helpers ─────────────────────────────────

function drawStatusBadge(status: string) {
  switch (status) {
    case 'draft': return { color: 'bg-muted text-muted-foreground', label: 'Draft', icon: FileText }
    case 'submitted': return { color: 'bg-info/20 text-info', label: 'Submitted', icon: Send }
    case 'inspected': return { color: 'bg-warning/20 text-warning', label: 'Inspected', icon: Eye }
    case 'approved': return { color: 'bg-primary/20 text-primary', label: 'Approved', icon: CheckCircle2 }
    case 'paid': return { color: 'bg-primary/20 text-primary', label: 'Paid', icon: CircleDollarSign }
    case 'rejected': return { color: 'bg-destructive/20 text-destructive', label: 'Rejected', icon: Ban }
    default: return { color: 'bg-muted text-muted-foreground', label: status, icon: FileText }
  }
}

// ─── Draw dot color helper ───────────────────────────────

function drawDotColor(status: string): { dot: string; line: string } {
  switch (status) {
    case 'paid': return { dot: 'bg-primary', line: 'bg-primary/60' }
    case 'approved': return { dot: 'bg-amber-400', line: 'bg-amber-400/40' }
    case 'inspected': return { dot: 'bg-amber-400', line: 'bg-amber-400/40' }
    case 'submitted': return { dot: 'bg-amber-400', line: 'bg-amber-400/40' }
    case 'rejected': return { dot: 'bg-destructive', line: 'bg-destructive/40' }
    case 'draft':
    default: return { dot: 'bg-muted-foreground/50', line: 'bg-border' }
  }
}

// ─── Unit Draws Section ──────────────────────────────────

function UnitDrawsSection({ unit, draws, loading, refetch }: { unit: Unit; draws: UnitDraw[]; loading: boolean; refetch: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingDrawId, setEditingDrawId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    description: '',
    acres_submitted: '',
    amount_invoiced: '',
    amount_paid: '',
    inspection_requested_at: '',
    inspection_completed_at: '',
    inspector_name: '',
    payment_received_at: '',
    notes: '',
    status: 'draft' as string,
  })

  const startEdit = (draw: UnitDraw) => {
    setEditingDrawId(draw.id)
    setShowForm(false)
    setFormData({
      description: draw.description || '',
      acres_submitted: draw.acres_submitted != null ? String(draw.acres_submitted) : '',
      amount_invoiced: draw.amount_invoiced != null ? String(draw.amount_invoiced) : '',
      amount_paid: draw.amount_paid != null ? String(draw.amount_paid) : '',
      inspection_requested_at: draw.inspection_requested_at ? draw.inspection_requested_at.split('T')[0] : '',
      inspection_completed_at: draw.inspection_completed_at ? draw.inspection_completed_at.split('T')[0] : '',
      inspector_name: draw.inspector_name || '',
      payment_received_at: draw.payment_received_at ? draw.payment_received_at.split('T')[0] : '',
      notes: draw.notes || '',
      status: draw.status || 'draft',
    })
  }

  const totalInvoiced = draws.reduce((sum, d) => sum + (d.amount_invoiced || 0), 0)
  const totalPaid = draws.reduce((sum, d) => sum + (d.amount_paid || 0), 0)
  const totalAcresDrawn = draws.reduce((sum, d) => sum + (d.acres_submitted || 0), 0)
  const unitAcres = unit.amount_type === 'acre' ? (unit.amount || 0) : 0
  const acresProgress = unitAcres > 0 ? Math.min(100, Math.round((totalAcresDrawn / unitAcres) * 100)) : 0

  const resetForm = () => {
    setFormData({ description: '', acres_submitted: '', amount_invoiced: '', amount_paid: '', inspection_requested_at: '', inspection_completed_at: '', inspector_name: '', payment_received_at: '', notes: '', status: 'draft' })
    setEditingDrawId(null)
  }

  return (
    <div className="mt-3 border-t border-border/50 pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <CircleDollarSign className="h-3 w-3" />
          Partial Payments
          {draws.length > 0 && <span className="font-mono text-[10px]">({draws.length})</span>}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading partial payments...
            </div>
          ) : (
            <>
              {/* Acres progress bar */}
              {unitAcres > 0 && draws.length > 0 && (
                <div className="rounded-md bg-elevated/50 px-3 py-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Acres submitted: <span className="font-mono text-foreground">{totalAcresDrawn.toLocaleString()}</span> / {unitAcres.toLocaleString()}</span>
                    <span className="font-mono text-foreground">{acresProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e2d42]">
                    <div
                      className={`h-full rounded-full transition-all ${acresProgress >= 100 ? 'bg-primary' : 'bg-info'}`}
                      style={{ width: `${acresProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Invoice vs Paid totals */}
              {draws.length > 0 && (totalInvoiced > 0 || totalPaid > 0) && (
                <div className="flex items-center gap-4 rounded-md bg-elevated/50 px-3 py-2 text-[10px]">
                  <div>
                    <span className="text-muted-foreground">Invoiced:</span>{' '}
                    <span className="font-mono font-medium text-foreground">${totalInvoiced.toLocaleString()}</span>
                  </div>
                  <div className="h-3 w-px bg-border" />
                  <div>
                    <span className="text-muted-foreground">Paid:</span>{' '}
                    <span className="font-mono font-medium text-primary">${totalPaid.toLocaleString()}</span>
                  </div>
                  {totalInvoiced > totalPaid && (
                    <>
                      <div className="h-3 w-px bg-border" />
                      <div>
                        <span className="text-muted-foreground">Outstanding:</span>{' '}
                        <span className="font-mono font-medium text-warning">${(totalInvoiced - totalPaid).toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Vertical timeline of partial payments */}
              {draws.length > 0 && (
                <div className="relative pl-4">
                  {draws.map((draw, idx) => {
                    const badge = drawStatusBadge(draw.status)
                    const BadgeIcon = badge.icon
                    const dotColors = drawDotColor(draw.status)
                    const isLast = idx === draws.length - 1

                    return (
                      <div key={draw.id} className="relative pb-3 last:pb-0">
                        {/* Vertical line connecting dots */}
                        {!isLast && (
                          <div className={`absolute left-0 top-[10px] w-0.5 ${dotColors.line}`} style={{ height: 'calc(100% - 2px)' }} />
                        )}
                        {/* Dot */}
                        <div className={`absolute -left-[3px] top-[5px] h-2 w-2 rounded-full ring-2 ring-background ${dotColors.dot}`} />

                        {/* Partial payment content */}
                        <div className={`ml-4 rounded-md border px-3 py-2 ${editingDrawId === draw.id ? 'border-primary/50 bg-elevated/60' : 'border-border/50 bg-elevated/30'}`}>
                          {editingDrawId === draw.id ? (
                            /* Inline edit form for this partial payment */
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] font-semibold text-foreground">Edit Partial Payment #{draw.draw_number}</span>
                                <select
                                  value={formData.status}
                                  onChange={e => setFormData(f => ({ ...f, status: e.target.value }))}
                                  className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                  <option value="draft">Draft</option>
                                  <option value="submitted">Submitted</option>
                                  <option value="inspected">Inspected</option>
                                  <option value="approved">Approved</option>
                                  <option value="paid">Paid</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                              </div>
                              <input type="text" placeholder="Description" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Acres</label>
                                  <input type="number" step="0.01" value={formData.acres_submitted} onChange={e => setFormData(f => ({ ...f, acres_submitted: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Invoiced</label>
                                  <input type="number" step="0.01" value={formData.amount_invoiced} onChange={e => setFormData(f => ({ ...f, amount_invoiced: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Paid</label>
                                  <input type="number" step="0.01" value={formData.amount_paid} onChange={e => setFormData(f => ({ ...f, amount_paid: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Inspection Requested</label>
                                  <input type="date" value={formData.inspection_requested_at} onChange={e => setFormData(f => ({ ...f, inspection_requested_at: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Inspection Completed</label>
                                  <input type="date" value={formData.inspection_completed_at} onChange={e => setFormData(f => ({ ...f, inspection_completed_at: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Inspector</label>
                                  <input type="text" value={formData.inspector_name} onChange={e => setFormData(f => ({ ...f, inspector_name: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Payment Received</label>
                                  <input type="date" value={formData.payment_received_at} onChange={e => setFormData(f => ({ ...f, payment_received_at: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                              </div>
                              <textarea placeholder="Notes..." value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={resetForm} disabled={saving} className="rounded-md px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                                <button
                                  onClick={async () => {
                                    setSaving(true)
                                    try {
                                      const { error } = await supabase.from('unit_draws').update({
                                        description: formData.description || null,
                                        acres_submitted: formData.acres_submitted ? parseFloat(formData.acres_submitted) : null,
                                        amount_invoiced: formData.amount_invoiced ? parseFloat(formData.amount_invoiced) : null,
                                        amount_paid: formData.amount_paid ? parseFloat(formData.amount_paid) : null,
                                        inspection_requested_at: formData.inspection_requested_at || null,
                                        inspection_completed_at: formData.inspection_completed_at || null,
                                        inspector_name: formData.inspector_name || null,
                                        payment_received_at: formData.payment_received_at || null,
                                        notes: formData.notes || null,
                                        status: formData.status,
                                      }).eq('id', draw.id)
                                      if (error) throw error
                                      resetForm()
                                      refetch()
                                    } catch (err: any) {
                                      console.error('Error updating partial payment:', err)
                                      alert('Failed to update: ' + (err.message || 'Unknown error'))
                                    } finally {
                                      setSaving(false)
                                    }
                                  }}
                                  disabled={saving}
                                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                          <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-semibold text-foreground">Partial Payment #{draw.draw_number}</span>
                              {draw.description && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{draw.description}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => startEdit(draw)} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors" title="Edit partial payment">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${badge.color}`}>
                                <BadgeIcon className="h-2.5 w-2.5" />
                                {badge.label}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                            {draw.acres_submitted != null && (
                              <span><span className="font-mono text-foreground">{draw.acres_submitted.toLocaleString()}</span> acres</span>
                            )}
                            {draw.amount_invoiced != null && (
                              <span>Invoiced: <span className="font-mono text-foreground">${draw.amount_invoiced.toLocaleString()}</span></span>
                            )}
                            {draw.amount_paid != null && (
                              <span>Paid: <span className="font-mono text-primary">${draw.amount_paid.toLocaleString()}</span></span>
                            )}
                          </div>
                          {/* Inspection & Payment dates */}
                          {(draw.inspection_requested_at || draw.inspection_completed_at || draw.inspector_name || draw.payment_received_at) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                              {draw.inspection_requested_at && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  Requested {new Date(draw.inspection_requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {draw.inspection_completed_at && (
                                <span className="flex items-center gap-0.5">
                                  <Eye className="h-2.5 w-2.5" />
                                  Inspected {new Date(draw.inspection_completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {draw.inspector_name && (
                                <span className="flex items-center gap-0.5">
                                  <Users className="h-2.5 w-2.5" />
                                  {draw.inspector_name}
                                </span>
                              )}
                              {draw.payment_received_at && (
                                <span className="flex items-center gap-0.5">
                                  <CircleDollarSign className="h-2.5 w-2.5 text-primary" />
                                  Paid {new Date(draw.payment_received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          )}
                          {draw.notes && (
                            <div className="mt-1.5 flex items-start gap-1 text-[10px] text-muted-foreground italic">
                              <MessageSquare className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                              {draw.notes}
                            </div>
                          )}
                          </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {draws.length === 0 && (
                <div className="py-2 text-center text-[10px] text-muted-foreground italic">
                  No partial payments yet for this unit.
                </div>
              )}

              {/* Add Partial Payment inline form */}
              {showForm ? (
                <div className="rounded-md border border-border bg-elevated/50 p-3 flex flex-col gap-2">
                  <div className="text-[11px] font-semibold text-foreground">New Partial Payment #{draws.length + 1}</div>
                  <input
                    type="text"
                    placeholder="e.g., North section partial completion"
                    value={formData.description}
                    onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">Acres Submitted</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={formData.acres_submitted}
                        onChange={e => setFormData(f => ({ ...f, acres_submitted: e.target.value }))}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">Amount Invoiced</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.amount_invoiced}
                          onChange={e => setFormData(f => ({ ...f, amount_invoiced: e.target.value }))}
                          className="w-full rounded-md border border-border bg-background pl-5 pr-2.5 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">Inspection Requested</label>
                      <input
                        type="date"
                        value={formData.inspection_requested_at}
                        onChange={e => setFormData(f => ({ ...f, inspection_requested_at: e.target.value }))}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">Inspector Name</label>
                      <input
                        type="text"
                        placeholder="e.g., John Smith"
                        value={formData.inspector_name}
                        onChange={e => setFormData(f => ({ ...f, inspector_name: e.target.value }))}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-0.5 block">Notes</label>
                    <textarea
                      placeholder="Optional notes about this partial payment..."
                      value={formData.notes}
                      onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button
                      onClick={() => { setShowForm(false); resetForm() }}
                      disabled={saving}
                      className="rounded-md px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setSaving(true)
                        try {
                          const { error } = await supabase.from('unit_draws').insert({
                            unit_id: unit.id,
                            draw_number: draws.length + 1,
                            status: 'draft',
                            description: formData.description || null,
                            acres_submitted: formData.acres_submitted ? parseFloat(formData.acres_submitted) : null,
                            amount_invoiced: formData.amount_invoiced ? parseFloat(formData.amount_invoiced) : null,
                            inspection_requested_at: formData.inspection_requested_at || null,
                            inspector_name: formData.inspector_name || null,
                            notes: formData.notes || null,
                          })
                          if (error) throw error
                          setShowForm(false)
                          resetForm()
                          refetch()
                        } catch (err: any) {
                          console.error('Error creating partial payment:', err)
                          alert('Failed to save partial payment: ' + (err.message || 'Unknown error'))
                        } finally {
                          setSaving(false)
                        }
                      }}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                      {saving ? 'Saving...' : 'Save Partial Payment'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/30 px-3 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add Partial Payment
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Unit Detail Card ───────────────────────────────────

function UnitDetailCard({ unit, onEdit, role, onStatusChange }: { unit: Unit; onEdit?: (unit: Unit) => void; role?: string; onStatusChange?: () => void }) {
  const pct = unit.completion_pct || 0
  const badge = unitStatusBadge(unit.status)
  const unitHideFinancials = role === 'office' || role === 'foreman'
  // Always fetch draws so we can show the summary on the card even when collapsed
  const { data: draws, loading: drawsLoading, refetch: refetchDraws } = useUnitDraws(unit.id)

  const totalInvoiced = draws.reduce((sum, d) => sum + (d.amount_invoiced || 0), 0)
  const contractValue = unit.amount != null && unit.price_per_unit != null
    ? unit.amount * unit.price_per_unit
    : 0
  const invoicePct = contractValue > 0 ? Math.min(100, Math.round((totalInvoiced / contractValue) * 100)) : 0

  return (
    <div className="rounded-lg border border-border bg-elevated/50 p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{unit.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            {unit.work_type && <span>{unit.work_type}</span>}
            {unit.county && <><span>&middot;</span><span>{unit.county}{unit.state ? `, ${unit.state}` : ''}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>{badge.label}</span>
          {onEdit && (
            <button
              onClick={() => onEdit(unit)}
              className="rounded p-1 text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
              title="Edit unit"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1e2d42]">
          <div className={`h-full rounded-full ${pct === 100 ? 'bg-primary' : pct > 0 ? 'bg-info' : 'bg-muted'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{Math.round(pct)}%</span>
      </div>

      {/* Pending Approval actions for units */}
      {unit.status === 'pending' && role === 'admin' && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="flex-1 text-[10px] text-amber-400 font-medium">Pending Approval</span>
          <button
            onClick={async () => {
              const { error } = await supabase.from('units').update({ status: 'not_started' }).eq('id', unit.id)
              if (error) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' })
              } else {
                toast({ title: 'Unit approved', description: `${unit.name} is now active.` })
                onStatusChange?.()
              }
            }}
            className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            <CheckCircle2 className="h-3 w-3" /> Approve
          </button>
          <button
            onClick={async () => {
              const { error } = await supabase.from('units').delete().eq('id', unit.id)
              if (error) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' })
              } else {
                toast({ title: 'Unit rejected', description: `${unit.name} has been removed.` })
                onStatusChange?.()
              }
            }}
            className="flex items-center gap-1 rounded border border-red-500/50 px-2 py-1 text-[10px] font-medium text-red-400 hover:bg-red-500/10"
          >
            <Ban className="h-3 w-3" /> Reject
          </button>
        </div>
      )}

      {/* Partial payments invoice summary — always visible on the card (hidden for office/foreman) */}
      {!unitHideFinancials && draws.length > 0 && totalInvoiced > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">
              <span className="font-mono text-foreground">${totalInvoiced.toLocaleString()}</span>
              {contractValue > 0 && (
                <> of <span className="font-mono text-foreground">${contractValue.toLocaleString()}</span></>
              )}
              {' '}invoiced
              {contractValue > 0 && (
                <span className="ml-1 font-mono text-foreground">({invoicePct}%)</span>
              )}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{draws.length} partial payment{draws.length !== 1 ? 's' : ''}</span>
          </div>
          {contractValue > 0 && (
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#1e2d42]">
              <div
                className={`h-full rounded-full transition-all ${invoicePct >= 100 ? 'bg-primary' : 'bg-amber-400/70'}`}
                style={{ width: `${invoicePct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Amount + type */}
      {unit.amount != null && (
        <div className="mt-2 text-xs text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{unit.amount.toLocaleString()}</span>{' '}
          {unit.amount_type === 'tree' ? 'trees' : unit.amount_type === 'acre' ? 'acres' : unit.amount_type === 'hour' ? 'hours' : unit.amount_type || ''}
          {!unitHideFinancials && unit.price_per_unit != null && (
            <span className="ml-2 text-muted-foreground">&middot; <span className="font-mono">${unit.price_per_unit.toLocaleString()}</span>/{unit.amount_type === 'acre' ? 'acre' : 'unit'}</span>
          )}
        </div>
      )}

      {/* Multi-price strip — renders only when ANY of the per-tree /
          per-acre / per-hour fields are populated. Lets office see all
          billing dimensions at a glance for thinning/PCT-style units
          that bid two ways. */}
      {!unitHideFinancials && (unit.price_per_tree != null || unit.price_per_acre != null || unit.price_per_hour != null) && (
        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {unit.price_per_tree != null && (
            <span className="rounded border border-border/50 bg-muted/30 px-1.5 py-0.5">
              <span className="font-mono text-foreground">${Number(unit.price_per_tree).toFixed(4)}</span>/tree
            </span>
          )}
          {unit.price_per_acre != null && (
            <span className="rounded border border-border/50 bg-muted/30 px-1.5 py-0.5">
              <span className="font-mono text-foreground">${Number(unit.price_per_acre).toFixed(2)}</span>/acre
            </span>
          )}
          {unit.price_per_hour != null && (
            <span className="rounded border border-border/50 bg-muted/30 px-1.5 py-0.5">
              <span className="font-mono text-foreground">${Number(unit.price_per_hour).toFixed(2)}</span>/hour
            </span>
          )}
        </div>
      )}

      {/* Hours logged */}
      {unit.total_hours_logged > 0 && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          <span className="font-mono text-foreground">{unit.total_hours_logged}</span> hours logged
        </div>
      )}

      {/* Detail fields — only show non-null */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
        {/* Planting fields */}
        {unit.species && unit.species.length > 0 && (
          <div className="flex items-center gap-1">
            <Leaf className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">Species:</span>
            <span className="flex gap-1">
              {unit.species.map(s => (
                <span key={s} className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">{s}</span>
              ))}
            </span>
          </div>
        )}
        {unit.target_spacing && (
          <div><span className="text-muted-foreground">Spacing:</span> <span className="font-mono text-foreground">{unit.target_spacing}</span></div>
        )}
        {unit.seedlings_per_acre != null && (
          <div><span className="text-muted-foreground">Seedlings/acre:</span> <span className="font-mono text-foreground">{unit.seedlings_per_acre.toLocaleString()}</span></div>
        )}
        {unit.total_seedlings != null && (
          <div><span className="text-muted-foreground">Total seedlings:</span> <span className="font-mono text-foreground">{unit.total_seedlings.toLocaleString()}</span></div>
        )}
        {unit.stock_type && (
          <div><span className="text-muted-foreground">Stock:</span> <span className="text-foreground">{unit.stock_type}</span></div>
        )}

        {/* Thinning/HFR fields */}
        {unit.tpa_target != null && (
          <div><span className="text-muted-foreground">TPA target:</span> <span className="font-mono text-foreground">{unit.tpa_target}</span></div>
        )}
        {unit.prescription && (
          <div><span className="text-muted-foreground">Rx:</span> <span className="text-foreground">{unit.prescription}</span></div>
        )}
        {unit.avg_slope_pct != null && (
          <div><span className="text-muted-foreground">Avg slope:</span> <span className="font-mono text-foreground">{unit.avg_slope_pct}%</span></div>
        )}
        {unit.fire_shutdown_zone != null && (
          <div><span className="text-muted-foreground">Fire zone:</span> <span className="font-mono text-foreground">{unit.fire_shutdown_zone}</span></div>
        )}

        {/* Common fields */}
        {unit.terrain_difficulty && (
          <div>
            <span className="text-muted-foreground">Terrain:</span>{' '}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              unit.terrain_difficulty === 'easy' ? 'bg-primary/20 text-primary' :
              unit.terrain_difficulty === 'moderate' ? 'bg-warning/20 text-warning' :
              'bg-destructive/20 text-destructive'
            }`}>{unit.terrain_difficulty}</span>
          </div>
        )}
        {(unit.elevation_min != null || unit.elevation_max != null) && (
          <div className="flex items-center gap-1">
            <Mountain className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Elev:</span>
            <span className="font-mono text-foreground">
              {unit.elevation_min != null && unit.elevation_max != null
                ? `${unit.elevation_min.toLocaleString()} – ${unit.elevation_max.toLocaleString()} ft`
                : unit.elevation_max != null
                  ? `${unit.elevation_max.toLocaleString()} ft`
                  : `${unit.elevation_min?.toLocaleString()} ft`
              }
            </span>
          </div>
        )}
      </div>

      {/* Unit Partial Payments — hidden for office/foreman */}
      {!unitHideFinancials && <UnitDrawsSection unit={unit} draws={draws} loading={drawsLoading} refetch={refetchDraws} />}
    </div>
  )
}

// ─── Unit Summary Stats ─────────────────────────────────

function UnitSummaryStats({ units }: { units: Unit[] }) {
  const completed = units.filter(u => u.status === 'completed').length
  const inProgress = units.filter(u => u.status === 'in_progress').length
  const notStarted = units.filter(u => u.status === 'not_started').length
  const avgCompletion = computeProgress(units)

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2.5 text-xs">
      <div><span className="text-muted-foreground">Total:</span> <span className="font-mono font-medium text-foreground">{units.length}</span></div>
      <div className="h-3 w-px bg-border" />
      <div><span className="text-muted-foreground">Completed:</span> <span className="font-mono font-medium text-primary">{completed}</span></div>
      <div className="h-3 w-px bg-border" />
      <div><span className="text-muted-foreground">In Progress:</span> <span className="font-mono font-medium text-info">{inProgress}</span></div>
      <div className="h-3 w-px bg-border" />
      <div><span className="text-muted-foreground">Not Started:</span> <span className="font-mono font-medium text-muted-foreground">{notStarted}</span></div>
      <div className="h-3 w-px bg-border" />
      <div><span className="text-muted-foreground">Avg:</span> <span className="font-mono font-medium text-foreground">{avgCompletion}%</span></div>
    </div>
  )
}

// ─── Contract Contacts (Supabase-backed) ───────────────

interface ContractContact {
  id: string
  name: string
  title: string
  email: string
  phone: string
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const CONTACT_TITLE_OPTIONS = [
  'Contracting Officer', 'COR', 'Inspector', 'Field Technician',
  'CEO', 'Project Manager', 'Landowner Rep', 'Forester', 'Other',
]

function ContractContactsTab({ contractId, initialContact }: {
  contractId: string
  initialContact?: { name?: string | null; email?: string | null; phone?: string | null }
}) {
  const [contacts, setContacts] = useState<ContractContact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')

  // Fetch contacts from Supabase
  const fetchContacts = useCallback(async () => {
    const { data, error } = await supabase
      .from('contract_contacts')
      .select('id, name, title, email, phone')
      .eq('contract_id', contractId)
      .order('created_at')
    if (error) {
      console.error('Failed to load contacts:', error)
      return
    }
    // Seed from the contract's primary contact if no rows yet
    if (data.length === 0 && initialContact?.name) {
      const { data: seeded, error: seedErr } = await supabase
        .from('contract_contacts')
        .insert({
          contract_id: contractId,
          name: initialContact.name,
          title: 'Primary Contact',
          email: initialContact.email || '',
          phone: initialContact.phone || '',
        })
        .select('id, name, title, email, phone')
      if (!seedErr && seeded) {
        setContacts(seeded)
      }
    } else {
      setContacts(data)
    }
    setLoading(false)
  }, [contractId, initialContact?.name, initialContact?.email, initialContact?.phone])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const resetForm = useCallback(() => {
    setFormName('')
    setFormTitle('')
    setFormEmail('')
    setFormPhone('')
    setEditingId(null)
    setShowForm(false)
  }, [])

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    if (editingId) {
      const { error } = await supabase
        .from('contract_contacts')
        .update({ name: formName.trim(), title: formTitle.trim(), email: formEmail.trim(), phone: formPhone.trim() })
        .eq('id', editingId)
      if (error) { toast({ title: 'Failed to update contact', variant: 'destructive' }); return }
      toast({ title: 'Contact updated' })
    } else {
      const { error } = await supabase
        .from('contract_contacts')
        .insert({ contract_id: contractId, name: formName.trim(), title: formTitle.trim(), email: formEmail.trim(), phone: formPhone.trim() })
      if (error) { toast({ title: 'Failed to add contact', variant: 'destructive' }); return }
      toast({ title: 'Contact added' })
    }
    resetForm()
    fetchContacts()
  }, [contractId, editingId, formName, formTitle, formEmail, formPhone, resetForm, fetchContacts])

  const handleEdit = useCallback((c: ContractContact) => {
    setFormName(c.name)
    setFormTitle(c.title)
    setFormEmail(c.email)
    setFormPhone(c.phone)
    setEditingId(c.id)
    setShowForm(true)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from('contract_contacts').delete().eq('id', id)
    if (error) { toast({ title: 'Failed to remove contact', variant: 'destructive' }); return }
    toast({ title: 'Contact removed' })
    fetchContacts()
  }, [fetchContacts])

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Contacts</h3>
          <p className="text-xs text-muted-foreground">People associated with this project</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Contact
          </button>
        )}
      </div>

      {/* Inline Add/Edit Form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-elevated/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{editingId ? 'Edit Contact' : 'New Contact'}</span>
            <button onClick={resetForm} className="rounded p-1 hover:bg-muted transition-colors">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Jane Smith"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Title / Role</label>
              {(() => {
                const knownRoles = CONTACT_TITLE_OPTIONS.filter(t => t !== 'Other')
                const isCustom = formTitle !== '' && !knownRoles.includes(formTitle)
                const selectValue = isCustom ? 'Other' : formTitle
                return (
                  <>
                    <select
                      value={selectValue}
                      onChange={e => setFormTitle(e.target.value === 'Other' ? '' : e.target.value)}
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select role...</option>
                      {CONTACT_TITLE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {(selectValue === 'Other') && (
                      <input
                        type="text"
                        value={isCustom ? formTitle : ''}
                        onChange={e => setFormTitle(e.target.value)}
                        placeholder="Enter custom role (e.g., COR, COTR, CO)"
                        autoFocus
                        className="mt-1 h-8 rounded-md border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </>
                )
              })()}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                placeholder="jane@example.com"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Phone</label>
              <input
                type="tel"
                value={formPhone}
                onChange={e => setFormPhone(formatPhoneInput(e.target.value))}
                placeholder="(360) 555-0123" maxLength={14}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              {editingId ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </div>
      )}

      {/* Contact Cards */}
      {contacts.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
          <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <span>No contacts yet</span>
          <span className="text-xs">Add landowner reps, CORs, inspectors, and other contacts</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {contacts.map(contact => (
          <div key={contact.id} className="flex items-start gap-3 rounded-lg border border-border bg-elevated/50 p-4">
            {/* Avatar */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
              {getInitials(contact.name)}
            </div>
            {/* Info */}
            <div className="flex flex-1 flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium text-foreground truncate">{contact.name}</span>
              {contact.title && (
                <span className="text-xs text-muted-foreground">{contact.title}</span>
              )}
              <div className="mt-1 flex flex-col gap-0.5">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate">
                    <Mail className="h-3 w-3 flex-shrink-0" />
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    {contact.phone}
                  </a>
                )}
              </div>
            </div>
            {/* Actions */}
            <div className="flex flex-shrink-0 gap-1">
              <button
                onClick={() => handleEdit(contact)}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Edit contact"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(contact.id)}
                className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                title="Delete contact"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Contract Notes (uses contracts.notes field) ───────────

function ContractNotesTab({ contractId, initialNotes, initialAdminNotes, role, onSaved }: {
  contractId: string
  initialNotes: string | null
  initialAdminNotes: string | null
  role: string
  onSaved: () => void
}) {
  const [notes, setNotes] = useState(initialNotes || '')
  const [adminNotes, setAdminNotes] = useState(initialAdminNotes || '')
  const [saving, setSaving] = useState(false)
  const [dirtyNotes, setDirtyNotes] = useState(false)
  const [dirtyAdmin, setDirtyAdmin] = useState(false)

  const canSeeAdmin = role === 'admin' || role === 'office'

  useEffect(() => {
    setNotes(initialNotes || '')
    setAdminNotes(initialAdminNotes || '')
    setDirtyNotes(false)
    setDirtyAdmin(false)
  }, [initialNotes, initialAdminNotes, contractId])

  const handleSave = useCallback(async () => {
    setSaving(true)
    const updates: Record<string, string | null> = {}
    if (dirtyNotes) updates.notes = notes.trim() || null
    if (dirtyAdmin && canSeeAdmin) updates.admin_notes = adminNotes.trim() || null

    const { error } = await supabase
      .from('contracts')
      .update(updates)
      .eq('id', contractId)
    setSaving(false)
    if (error) {
      toast({ title: 'Failed to save notes', variant: 'destructive' })
      return
    }
    toast({ title: 'Notes saved' })
    setDirtyNotes(false)
    setDirtyAdmin(false)
    onSaved()
  }, [contractId, notes, adminNotes, dirtyNotes, dirtyAdmin, canSeeAdmin, onSaved])

  const isDirty = dirtyNotes || dirtyAdmin

  return (
    <div className="flex flex-col gap-6">
      {/* Contract Notes — visible to all */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" /> Project Notes
            </h3>
            <p className="text-xs text-muted-foreground">Visible to all roles — instructions, site details, reminders</p>
          </div>
        </div>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setDirtyNotes(true) }}
          placeholder="Site access instructions, planting specs, foreman reminders, contact info..."
          className="min-h-[160px] w-full rounded-lg border border-border bg-background p-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        />
        {dirtyNotes && <p className="text-[10px] text-amber-400">Unsaved changes</p>}
      </div>

      {/* Admin Notes — admin + office only */}
      {canSeeAdmin && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-warning" /> Admin Notes
            </h3>
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">Admin &amp; Office only</span>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Internal notes — pricing rationale, bid strategy, legal, payroll flags</p>
          <textarea
            value={adminNotes}
            onChange={e => { setAdminNotes(e.target.value); setDirtyAdmin(true) }}
            placeholder="Bid notes, pricing rationale, payroll flags, legal reminders, internal decisions..."
            className="min-h-[140px] w-full rounded-lg border border-warning/20 bg-warning/5 p-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-warning resize-y"
          />
          {dirtyAdmin && <p className="text-[10px] text-amber-400">Unsaved changes</p>}
        </div>
      )}

      {/* Single save button for both */}
      <button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className={`self-start flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
          isDirty
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
        {saving ? 'Saving...' : 'Save Notes'}
      </button>
    </div>
  )
}

// ─── Contract Files (Google Drive) ────────────────────────────

type DriveFile = {
  id: string
  name: string
  mimeType: string
  size: number
  createdTime: string
  webViewLink: string
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

function formatDriveSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DriveFileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === FOLDER_MIME) return <Folder className="h-5 w-5 flex-shrink-0 text-yellow-400" />
  if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 flex-shrink-0 text-red-400" />
  if (mimeType.includes('image')) return <File className="h-5 w-5 flex-shrink-0 text-blue-400" />
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <File className="h-5 w-5 flex-shrink-0 text-green-400" />
  return <FileText className="h-5 w-5 flex-shrink-0 text-primary/70" />
}

function DriveFolderView({
  rootFolderId,
  label,
  canUpload,
}: {
  rootFolderId: string
  label: string
  canUpload: boolean
}) {
  type Crumb = { id: string; name: string }
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([{ id: rootFolderId, name: label }])
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id

  const fetchFiles = useCallback(async (folderId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/drive/list?folderId=${folderId}`)
      const json = await res.json()
      if (json.files) setFiles(json.files)
      else setFiles([])
    } catch {
      setFiles([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchFiles(currentFolderId) }, [currentFolderId, fetchFiles])

  const navigateInto = (file: DriveFile) => {
    setBreadcrumbs(prev => [...prev, { id: file.id, name: file.name }])
  }

  const navigateTo = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1))
  }

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.name.startsWith('.')) {
      toast({ title: 'Upload blocked', description: 'Dotfiles cannot be uploaded.', variant: 'destructive' })
      return
    }
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folderId', currentFolderId)
    try {
      const res = await fetch('/api/drive/upload', { method: 'POST', body: formData })
      const body = await res.json().catch(() => ({} as { error?: string }))
      if (res.ok) {
        toast({ title: 'File uploaded to Drive' })
        fetchFiles(currentFolderId)
      } else {
        toast({
          title: 'Upload failed',
          description: body?.error || `Server returned ${res.status}. Try again, or check the file.`,
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Network error — check your connection and retry.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }, [currentFolderId, fetchFiles])

  const folders = files.filter(f => f.mimeType === FOLDER_MIME)
  const docs = files.filter(f => f.mimeType !== FOLDER_MIME)

  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 flex-wrap">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <button
              onClick={() => navigateTo(i)}
              className={`text-xs rounded px-1.5 py-0.5 transition-colors ${i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              {i === 0 ? <span className="flex items-center gap-1"><Home className="h-3 w-3" />{crumb.name}</span> : crumb.name}
            </button>
          </div>
        ))}
      </div>

      {/* Upload */}
      {canUpload && (
        <label className={`self-start flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading...' : 'Upload File'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
          <div className="text-sm text-muted-foreground">This folder is empty</div>
          {canUpload && <div className="text-xs text-muted-foreground">Upload files using the button above</div>}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {[...folders, ...docs].map(file => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-elevated/50 px-4 py-2.5 group"
            >
              <DriveFileIcon mimeType={file.mimeType} />
              <div className="flex flex-1 flex-col min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{file.name}</span>
                {file.mimeType !== FOLDER_MIME && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {file.size > 0 && <span>{formatDriveSize(file.size)}</span>}
                    <span>{new Date(file.createdTime).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              {file.mimeType === FOLDER_MIME ? (
                <button
                  onClick={() => navigateInto(file)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Open <ChevronRight className="h-3 w-3" />
                </button>
              ) : (
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ContractFilesTab({
  contract,
  role,
}: {
  contract: Contract
  role: string
}) {
  const [activeTree, setActiveTree] = useState<'everyone' | 'admin'>('everyone')
  const isAdmin = role === 'admin'
  const canUpload = role === 'admin' || role === 'office'

  if (!contract.drive_folder_everyone_id) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
        <div className="text-sm text-muted-foreground">Drive folders are being set up for this project</div>
        <div className="text-xs text-muted-foreground">This usually completes within a few seconds of project creation</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Folder className="h-4 w-4 text-primary" /> Project Files
            {contract.drive_folder_everyone_id && (
              <a
                href={`https://drive.google.com/drive/folders/${activeTree === 'admin' && contract.drive_folder_admin_id ? contract.drive_folder_admin_id : contract.drive_folder_everyone_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                title="Open in Google Drive"
              >
                <svg className="h-3 w-3" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.25z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-27.5l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h45.5c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
                Open in Drive
              </a>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">Files are stored in Google Drive — click to open in a new tab</p>
        </div>
        {isAdmin && contract.drive_folder_admin_id && (
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            <button
              onClick={() => setActiveTree('everyone')}
              className={`px-3 py-1.5 transition-colors ${activeTree === 'everyone' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Everyone
            </button>
            <button
              onClick={() => setActiveTree('admin')}
              className={`px-3 py-1.5 transition-colors ${activeTree === 'admin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Admin
            </button>
          </div>
        )}
      </div>

      {activeTree === 'everyone' && (
        <DriveFolderView
          key={`everyone-${contract.drive_folder_everyone_id}`}
          rootFolderId={contract.drive_folder_everyone_id}
          label="Everyone"
          canUpload={canUpload}
        />
      )}
      {activeTree === 'admin' && isAdmin && contract.drive_folder_admin_id && (
        <DriveFolderView
          key={`admin-${contract.drive_folder_admin_id}`}
          rootFolderId={contract.drive_folder_admin_id}
          label="Admin"
          canUpload={canUpload}
        />
      )}
    </div>
  )
}

// ─── Contract Expenses Tab ────────────────────────────────

// 15-bucket schema (see lib/expenses/parser.ts). Labels + Tailwind badge
// classes for the contract Expenses tab and related badge renders.
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
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

const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  // Vehicle
  fuel: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  vehicle_maintenance: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  vehicle_rental: 'bg-orange-600/20 text-orange-200 border-orange-600/40',
  // Travel
  lodging: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  airfare_transit: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  tolls_parking: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  // Supplies
  meals: 'bg-green-500/20 text-green-300 border-green-500/40',
  groceries: 'bg-lime-500/20 text-lime-300 border-lime-500/40',
  equipment: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  chainsaw: 'bg-red-500/20 text-red-300 border-red-500/40',
  safety_gear: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  // Overhead
  office_admin: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  professional_services: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
  fees_insurance: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  other: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
}

function ContractExpensesTab({ contractId, role }: { contractId: string; role: string }) {
  const isAdmin = role === 'admin'
  const { data: expenses, isLoading } = useClientQuery('contractExpenses', contractId)
  const unassignMutation = useClientMutation('unassignExpense', {
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: 'Removed', description: 'Expense moved back to the pending queue.' })
      } else {
        toast({ title: 'Could not remove', description: result.error, variant: 'destructive' })
      }
    },
  })

  const totals = useMemo(() => {
    const rows = expenses || []
    const byCategory = new Map<string, number>()
    let grand = 0
    rows.forEach((e) => {
      const amt = Number(e.amount || 0)
      const cat = e.category || 'other'
      byCategory.set(cat, (byCategory.get(cat) || 0) + amt)
      grand += amt
    })
    return {
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
      grand,
      count: rows.length,
    }
  }, [expenses])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading expenses…
      </div>
    )
  }

  if (!expenses || expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <CircleDollarSign className="h-8 w-8 text-muted-foreground/40" />
        <div className="text-sm font-medium text-foreground">No expenses assigned yet</div>
        <div className="text-xs text-muted-foreground max-w-sm">
          Imported expenses get assigned here automatically when a crew member&apos;s
          timesheet matches. Office staff can also assign expenses manually from
          the Expense Assignments queue.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header summary */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-primary" /> Project Expenses
          </h3>
          <p className="text-xs text-muted-foreground">
            {totals.count} item{totals.count !== 1 ? 's' : ''} assigned
          </p>
        </div>
        {isAdmin && (
          <div className="rounded-md border border-border bg-elevated px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="font-mono text-base font-bold text-foreground">
              {totals.grand.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </div>
          </div>
        )}
      </div>

      {/* Category subtotals — admin only */}
      {isAdmin && totals.byCategory.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {totals.byCategory.map(([cat, total]) => (
            <div key={cat} className="rounded-md border border-border bg-card px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {EXPENSE_CATEGORY_LABELS[cat] || cat}
              </div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Line items */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Cardholder</th>
              <th className="px-3 py-2">Category</th>
              {isAdmin && <th className="px-3 py-2 text-right">Amount</th>}
              <th className="px-3 py-2">Match</th>
              {isAdmin && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => {
              const employee = e.employees as { first_name: string; last_name: string } | null
              const cardholder = employee
                ? `${employee.first_name} ${employee.last_name}`
                : (e.cardholder_name || '—')
              const matchLabel =
                e.match_method === 'manual'
                  ? 'Manual'
                  : e.match_method === 'timesheet_exact'
                    ? 'Auto'
                    : e.match_method === 'timesheet_multi'
                      ? `Auto (${Math.round(Number(e.match_confidence || 0) * 100)}%)`
                      : '—'
              return (
                <tr key={e.id} className="border-t border-border/60 hover:bg-muted/20">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {e.date ? new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{e.vendor || '—'}</div>
                    {e.description && (
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{e.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-foreground">{cardholder}</td>
                  <td className="px-3 py-2">
                    {e.category && (
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${EXPENSE_CATEGORY_COLORS[e.category] || EXPENSE_CATEGORY_COLORS.other}`}
                      >
                        {EXPENSE_CATEGORY_LABELS[e.category] || e.category}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right font-mono text-foreground">
                      {Number(e.amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </td>
                  )}
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{matchLabel}</td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => unassignMutation.mutate({ expenseId: e.id, userId: null })}
                        className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-destructive hover:border-destructive/40"
                        title="Remove from this project"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────

export function ContractsPage() {
  const { company, role, selectedContractId: contextContractId, setSelectedContractId: setContextContractId, pageHint, setPageHint } = useApp()
  const hideFinancials = role === 'office' || role === 'foreman'
  const { data: contracts, loading: contractsLoading, error: contractsError, refetch: refetchContracts } = useContracts()
  const { data: units, refetch: refetchUnits } = useUnits()
  const { data: productionLogs } = useProductionLogs()
  const { data: employees } = useEmployees()
  const foremanMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of employees || []) {
      if (e.is_foreman) m.set(e.id, `${e.first_name} ${e.last_name}`)
    }
    return m
  }, [employees])
  const [selectedContractId, setSelectedContractId] = useState<string | null>(contextContractId || null)

  // Consume context contract ID on mount / when it changes (e.g. clicked from Overview)
  useEffect(() => {
    if (contextContractId) {
      setSelectedContractId(contextContractId)
      setContextContractId(null) // clear so returning later doesn't re-select
    }
  }, [contextContractId, setContextContractId])

  const [activeTab, setActiveTab] = useState('Overview')
  const [showCreateSheet, setShowCreateSheet] = useState(false)

  // Handle page hints (e.g. "action:create" from Overview's + New Project button)
  useEffect(() => {
    if (pageHint === 'action:create') {
      setShowCreateSheet(true)
      setPageHint(null)
    }
  }, [pageHint, setPageHint])
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [unitStatusFilter, setUnitStatusFilter] = useState<string>('all')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string> | null>(null)

  const toggleGroup = useCallback((groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupName)) next.delete(groupName)
      else next.add(groupName)
      return next
    })
  }, [])

  // Filter by company toggle + search
  const filteredContracts = useMemo(() => {
    if (!contracts) return []
    let filtered = contracts
    // Private contracts with no company (company_id = null) show in BOTH
    // Cascadia and Ramos views — per Jaime, either crew might work them.
    if (company === 'cascadia') filtered = filtered.filter(c => c.company_id === CASCADIA_ID || c.company_id === null)
    else if (company === 'ramos') filtered = filtered.filter(c => c.company_id === RAMOS_ID || c.company_id === null)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase()
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.landowner?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.contract_number?.toLowerCase().includes(q) ||
        c.work_types?.some(wt => wt.toLowerCase().includes(q))
      )
    }
    return filtered
  }, [contracts, company, searchTerm])

  // Group contracts by landowner
  const landownerGroups = useMemo(() => {
    const groupMap = new Map<string, typeof filteredContracts>()
    for (const c of filteredContracts) {
      const key = c.landowner || 'Other'
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(c)
    }
    // Sort: named groups alphabetically, "Other" at the end
    const sorted = Array.from(groupMap.entries()).sort((a, b) => {
      if (a[0] === 'Other') return 1
      if (b[0] === 'Other') return -1
      return a[0].localeCompare(b[0])
    })
    return sorted
  }, [filteredContracts])

  // Initialize all groups as collapsed on first load
  useEffect(() => {
    if (collapsedGroups === null && landownerGroups.length > 0) {
      setCollapsedGroups(new Set(landownerGroups.map(([name]) => name)))
    }
  }, [landownerGroups, collapsedGroups])

  // Auto-expand group containing selected contract
  const selectedLandownerGroup = useMemo(() => {
    if (!selectedContractId) return null
    const c = filteredContracts.find(c => c.id === selectedContractId)
    return c ? (c.landowner || 'Other') : null
  }, [selectedContractId, filteredContracts])

  // When selected contract changes, ensure its group is expanded
  useEffect(() => {
    if (selectedLandownerGroup && collapsedGroups?.has(selectedLandownerGroup)) {
      setCollapsedGroups(prev => {
        const next = new Set(prev)
        next.delete(selectedLandownerGroup)
        return next
      })
    }
  }, [selectedLandownerGroup]) // eslint-disable-line react-hooks/exhaustive-deps

  // Only show a contract if explicitly selected (no auto-select)
  const selectedContract = selectedContractId ? (filteredContracts.find(c => c.id === selectedContractId) || null) : null
  const contractUnits = selectedContract ? getContractUnits(selectedContract, units) : []
  const progress = computeProgress(contractUnits)
  const completedUnits = contractUnits.filter(u => u.status === 'completed').length

  // Fetch aggregated hours from approved timesheets for selected contract
  const { data: contractHours } = useContractHours(selectedContract?.id || null)

  if (contractsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading projects...</span>
      </div>
    )
  }

  if (contractsError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load contracts: {contractsError}
      </div>
    )
  }

  return (
    <div className="flex gap-5" style={{ minHeight: 'calc(100vh - 128px)' }}>
      {/* Left List */}
      <div data-tour="contracts-filters" className="w-[300px] shrink-0 rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full rounded-md border border-border bg-elevated py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#2a3f5f] focus:outline-none" placeholder="Search projects..." />
          </div>
        </div>
        <div data-tour="contracts-list" className="overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {landownerGroups.map(([groupName, items]) => {
            const isCollapsed = collapsedGroups?.has(groupName) ?? true
            return (
              <div key={groupName} className="mb-1">
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="sticky top-0 z-10 mb-0.5 flex w-full items-center gap-1.5 rounded-md bg-elevated/80 backdrop-blur-sm px-2 py-1.5 text-left transition-colors hover:bg-elevated"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  }
                  <span className="flex-1 truncate text-[11px] font-semibold text-muted-foreground">{groupName}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{items.length}</span>
                </button>
                {!isCollapsed && items.map(c => {
                  const cUnits = getContractUnits(c, units)
                  const cProd = computeProductionProgress(cUnits, productionLogs)
                  const primaryMetric = cProd.trees.target > 0 ? cProd.trees
                    : cProd.acres.target > 0 ? cProd.acres
                    : cProd.hours.target > 0 ? cProd.hours
                    : null
                  const primaryPct = primaryMetric && primaryMetric.target > 0
                    ? Math.min(100, Math.round((primaryMetric.done / primaryMetric.target) * 100))
                    : 0
                  const primaryLabel = cProd.trees.target > 0 ? 'trees'
                    : cProd.acres.target > 0 ? 'acres'
                    : cProd.hours.target > 0 ? 'hrs'
                    : ''
                  const isSelected = selectedContract?.id === c.id
                  const sg = statusGroups.find(s => s.status === c.status)
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedContractId(c.id); setActiveTab('Overview'); }}
                      className={`mb-1 w-full rounded-md px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border border-primary/30 bg-[rgba(34,197,94,0.08)]'
                          : 'border border-transparent hover:bg-elevated'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground flex-1 truncate">{c.name}</span>
                        {sg && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sg.dotColor}`} title={sg.label} />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{c.work_types?.join(', ') || 'N/A'}</span>
                        {c.foreman_id && foremanMap.get(c.foreman_id) && (
                          <>
                            <span>&middot;</span>
                            <span className="text-primary">{foremanMap.get(c.foreman_id)}</span>
                          </>
                        )}
                        {!c.foreman_id && role === 'admin' && (
                          <>
                            <span>&middot;</span>
                            <span className="text-amber-400/70">Unassigned</span>
                          </>
                        )}
                        {c.contract_number && (
                          <>
                            <span>&middot;</span>
                            <span className="font-mono">{c.contract_number}</span>
                          </>
                        )}
                      </div>
                      {c.status === 'active' && (
                        <div className="mt-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-elevated">
                              <div
                                className={`h-full rounded-full transition-all ${primaryPct >= 75 ? 'bg-primary' : primaryPct >= 25 ? 'bg-info' : 'bg-muted-foreground/30'}`}
                                style={{ width: `${primaryPct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground">{primaryPct}%</span>
                          </div>
                          {primaryMetric ? (
                            <div className="mt-0.5 text-[9px] text-muted-foreground">
                              <span className="font-mono">{primaryMetric.done.toLocaleString()}</span> / <span className="font-mono">{primaryMetric.target.toLocaleString()}</span> {primaryLabel}
                            </div>
                          ) : (
                            <div className="mt-0.5 text-[9px] text-muted-foreground">{cUnits.length} units</div>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
          <button
            onClick={() => setShowCreateSheet(true)}
            className="mt-2 w-full rounded-md border border-dashed border-primary/30 px-3 py-2 text-xs text-primary hover:bg-primary/5"
          >
            + New Project
          </button>
        </div>
      </div>

      {/* Right Detail */}
      {!selectedContract && (
        <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border bg-card/50">
          <div className="text-center">
            <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Select a project to view details</p>
          </div>
        </div>
      )}
      {selectedContract && (
        <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card">
          {/* Header */}
          <div className="border-b border-border px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-foreground flex-1">{selectedContract.name}</h2>
              <button
                onClick={() => setShowEditSheet(true)}
                className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-elevated px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              {role === 'admin' && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border/50 px-2.5 text-xs font-medium text-muted-foreground hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {selectedContract.contract_number && (
                <span className="rounded bg-elevated px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{selectedContract.contract_number}</span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeColor(selectedContract.status)}`}>{statusLabel(selectedContract.status)}</span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">{companyLabel(selectedContract.company_id)}</span>
              {contractTypeLabel(selectedContract.contract_type) && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${contractTypeBadgeColor(selectedContract.contract_type)}`}>
                  {contractTypeLabel(selectedContract.contract_type)}
                </span>
              )}
              {selectedContract.work_types?.map(wt => (
                <span key={wt} className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">{wt}</span>
              ))}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {selectedContract.landowner || 'No landowner'} &middot; {selectedContract.location || 'No location'}
              {selectedContract.foreman_id && foremanMap.get(selectedContract.foreman_id) && (
                <> &middot; <span className="text-primary">Foreman: {foremanMap.get(selectedContract.foreman_id)}</span></>
              )}
              {!selectedContract.foreman_id && role === 'admin' && (
                <> &middot; <span className="text-amber-400">Unassigned</span></>
              )}
            </div>
            {selectedContract.display_id && (
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{selectedContract.display_id}</div>
            )}
            {/* Contact info */}
            {(selectedContract.contact_name || selectedContract.contact_phone || selectedContract.contact_email) && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                {selectedContract.contact_name && (
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {selectedContract.contact_name}</span>
                )}
                {selectedContract.contact_phone && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedContract.contact_phone}</span>
                )}
                {selectedContract.contact_email && (
                  <span className="flex items-center gap-1"><AtSign className="h-3 w-3" /> {selectedContract.contact_email}</span>
                )}
              </div>
            )}

            {/* Foreman Assignment (Admin only) */}
            {role === 'admin' && (
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={selectedContract.foreman_id || ''}
                  onChange={async (e) => {
                    const newForemanId = e.target.value || null
                    await supabase.from('contracts').update({ foreman_id: newForemanId } as never).eq('id', selectedContract.id)
                    refetchContracts()
                  }}
                  className="h-7 rounded border border-border bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Assign foreman...</option>
                  {Array.from(foremanMap.entries()).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
                {selectedContract.foreman_id && (
                  <button
                    onClick={async () => {
                      await supabase.from('foreman_favorites' as never).upsert({
                        employee_id: selectedContract.foreman_id,
                        contract_id: selectedContract.id,
                        added_by: 'admin',
                      } as never, { onConflict: 'employee_id,contract_id' })
                      const name = foremanMap.get(selectedContract.foreman_id!) || 'Foreman'
                      alert(`Added to ${name}'s favorites`)
                    }}
                    className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:border-amber-500/30 hover:text-amber-400 transition-colors"
                    title="Add this project to the assigned foreman's favorites"
                  >
                    <Star className="h-3 w-3" /> Add to Favorites
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pending Approval Banner */}
          {selectedContract.status === 'pending_approval' && (
            <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 px-4 py-3">
              <Clock className="h-5 w-5 shrink-0 text-amber-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-400">Pending Approval</p>
                <p className="text-xs text-muted-foreground">This project was submitted by a non-admin and needs approval before it goes live.</p>
              </div>
              {role === 'admin' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from('contracts').update({ status: 'active' }).eq('id', selectedContract.id)
                      if (error) {
                        toast({ title: 'Error', description: error.message, variant: 'destructive' })
                      } else {
                        toast({ title: 'Project approved', description: `${selectedContract.name} is now active.` })
                        refetchContracts()
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from('contracts').update({ status: 'archived' }).eq('id', selectedContract.id)
                      if (error) {
                        toast({ title: 'Error', description: error.message, variant: 'destructive' })
                      } else {
                        toast({ title: 'Project rejected', description: `${selectedContract.name} has been archived.` })
                        refetchContracts()
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-md border border-red-500/50 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Ban className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Delete / Archive Confirmation */}
          {showDeleteConfirm && selectedContract && (
            <div className="mx-6 mt-4 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-4">
              <p className="text-sm font-medium text-foreground">
                Remove {selectedContract.name}?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <strong className="text-amber-400">Archive</strong> removes from the active view but preserves data for rebidding.{' '}
                <strong className="text-red-400">Delete</strong> permanently removes the project and its units.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting || archiving}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setArchiving(true)
                    const { error } = await supabase
                      .from('contracts')
                      .update({ status: 'archived' as const, archived_at: new Date().toISOString() })
                      .eq('id', selectedContract.id)
                    setArchiving(false)
                    if (error) {
                      toast({ title: 'Error', description: `Failed to archive project: ${error.message}`, variant: 'destructive' })
                    } else {
                      toast({ title: 'Project archived', description: `${selectedContract.name} has been moved to the archive.` })
                      setShowDeleteConfirm(false)
                      refetchContracts()
                    }
                  }}
                  disabled={deleting || archiving}
                  className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {archiving && <Loader2 className="h-3 w-3 animate-spin" />}
                  <Archive className="h-3 w-3" />
                  Archive
                </button>
                <button
                  onClick={async () => {
                    setDeleting(true)
                    const { error } = await supabase.from('contracts').delete().eq('id', selectedContract.id)
                    setDeleting(false)
                    if (error) {
                      toast({ title: 'Error', description: `Failed to delete project: ${error.message}`, variant: 'destructive' })
                    } else {
                      toast({ title: 'Project deleted', description: `${selectedContract.name} has been removed.` })
                      setShowDeleteConfirm(false)
                      setSelectedContractId(null)
                      refetchContracts()
                    }
                  }}
                  disabled={deleting || archiving}
                  className="flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                >
                  {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Tabs — hide Expenses for foreman (no dollars at all).
              For Office, the Payroll tab renders as 'Hours' — same data
              source minus the financial columns. */}
          <div className="flex border-b border-border px-6">
            {tabs.filter(tab => tab !== 'Expenses' || role !== 'foreman').map(tab => {
              const isFuture = ['Weather', 'Production', 'Onboarding'].includes(tab)
              const tabLabel = tab === 'Payroll' && role === 'office' ? 'Hours' : tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : isFuture
                        ? 'border-transparent text-muted-foreground/40 hover:text-muted-foreground/60'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tabLabel}
                  {tab === 'Units' && <span className="ml-1 font-mono text-[10px]">({contractUnits.length})</span>}
                  {isFuture && <Lock className="ml-1 inline h-3 w-3 text-muted-foreground/40" />}
                </button>
              )
            })}
          </div>

          {/* Tab Content */}
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {activeTab === 'Overview' && (
              <div className="flex flex-col gap-5">
                {/* Info Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Building, label: 'Landowner', value: selectedContract.landowner || 'N/A' },
                    ...(selectedContract.master_contract ? [{ icon: Layers, label: 'Master Project', value: selectedContract.master_contract }] : []),
                    { icon: MapPin, label: 'Location', value: selectedContract.location || 'N/A' },
                    // Address is separate from Location — region vs street address.
                    // Only render when populated so contracts without one stay compact.
                    ...(selectedContract.landowner_address ? [{ icon: Home, label: 'Address', value: selectedContract.landowner_address }] : []),
                    { icon: Calendar, label: 'Dates', value: [selectedContract.start_date, selectedContract.end_date].filter(Boolean).join(' – ') || 'TBD' },
                    ...(selectedContract.total_seedlings ? [{ icon: TreePine, label: 'Total Seedlings', value: selectedContract.total_seedlings.toLocaleString() }] : []),
                    ...(selectedContract.total_acres ? [{ icon: TreePine, label: 'Total Acres', value: selectedContract.total_acres.toLocaleString() }] : []),
                    ...(!hideFinancials ? [
                      { icon: DollarSign, label: 'Project Value', value: selectedContract.contract_price ? `$${selectedContract.contract_price.toLocaleString()}` : 'N/A', lock: true },
                      { icon: DollarSign, label: 'Bond', value: selectedContract.bond_amount ? `$${selectedContract.bond_amount.toLocaleString()}` : 'N/A', badge: selectedContract.bond_paid ? 'Paid' : undefined },
                    ] : []),
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-border bg-elevated/50 p-3">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</span>
                        {'lock' in item && item.lock && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.value}</span>
                        {'badge' in item && item.badge && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary">{item.badge}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress Elements */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Circular Progress */}
                  <div className="flex flex-col items-center rounded-lg border border-border bg-elevated/50 p-4">
                    <div className="relative h-24 w-24">
                      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#1e2d42" strokeWidth="8" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#22c55e" strokeWidth="8"
                          strokeDasharray={`${progress * 2.64} ${264 - progress * 2.64}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-mono text-lg font-bold text-foreground">{completedUnits}/{contractUnits.length}</span>
                        <span className="text-[10px] text-muted-foreground">units</span>
                      </div>
                    </div>
                    <span className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">Completion</span>
                  </div>

                  {/* Unit Progress Bar */}
                  <div className="flex flex-col justify-center rounded-lg border border-border bg-elevated/50 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Unit Progress</div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#1e2d42]">
                      <div className="h-full rounded-full bg-info" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs">
                      <span className="font-mono text-foreground">{completedUnits} completed</span>
                      <span className="font-mono text-muted-foreground">{contractUnits.length} total</span>
                    </div>
                    <div className="mt-0.5 text-center font-mono text-lg font-bold text-info">{progress}%</div>

                    {/* Per-type breakdown */}
                    {(() => {
                      const byType = contractUnits.reduce<Record<string, { total: number; completed: number }>>((acc, u) => {
                        const wt = u.work_type || 'Unspecified'
                        if (!acc[wt]) acc[wt] = { total: 0, completed: 0 }
                        acc[wt].total += 1
                        if (u.status === 'completed') acc[wt].completed += 1
                        return acc
                      }, {})
                      const types = Object.entries(byType)
                      if (types.length <= 1) return null
                      return (
                        <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                          {types.map(([wt, { total, completed }]) => {
                            const pct = Math.round((completed / total) * 100)
                            return (
                              <div key={wt} className="flex items-center gap-2 text-[10px]">
                                <span className="w-20 truncate text-muted-foreground">{wt}</span>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1e2d42]">
                                  <div className="h-full rounded-full bg-info/70" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-12 text-right font-mono text-foreground">{completed}/{total}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Contract Type + Elevation */}
                  <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-elevated/50 p-4">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Project Type</span>
                    <span className="mt-2 text-lg font-bold text-foreground">{contractTypeLabel(selectedContract.contract_type) || 'N/A'}</span>
                    {selectedContract.end_date && (
                      <span className="mt-1 text-xs text-muted-foreground">Ends: {selectedContract.end_date}</span>
                    )}
                    {(selectedContract.elevation_min != null || selectedContract.elevation_max != null) && (
                      <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Mountain className="h-3 w-3" />
                        {selectedContract.elevation_min != null && selectedContract.elevation_max != null
                          ? `${selectedContract.elevation_min.toLocaleString()} – ${selectedContract.elevation_max.toLocaleString()} ft`
                          : `${(selectedContract.elevation_max || selectedContract.elevation_min)?.toLocaleString()} ft`
                        }
                      </span>
                    )}
                    <span className={`mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeColor(selectedContract.status)}`}>{statusLabel(selectedContract.status)}</span>
                  </div>
                </div>

                {/* Production Progress */}
                {contractUnits.length > 0 && (
                  <div className="rounded-lg border border-border bg-elevated/50 p-4">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Production Progress</div>
                    <ProductionProgressBar progress={computeProductionProgress(contractUnits, productionLogs)} />
                  </div>
                )}

                {/* Hours Worked — aggregated from approved timesheets */}
                {contractHours && contractHours.approvedTimesheetCount > 0 && (
                  <div className="rounded-lg border border-border bg-elevated/50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hours Worked</span>
                      <span className="ml-auto rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-mono font-medium text-primary">
                        {contractHours.approvedTimesheetCount} approved timesheet{contractHours.approvedTimesheetCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-md border border-border bg-card/50 p-3 text-center">
                        <div className="font-mono text-lg font-bold text-foreground">{contractHours.totalCrewHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                        <div className="text-[10px] text-muted-foreground">Crew Labor</div>
                      </div>
                      {contractHours.totalDriveHours > 0 && (
                        <div className="rounded-md border border-border bg-card/50 p-3 text-center">
                          <div className="font-mono text-lg font-bold text-foreground">{contractHours.totalDriveHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                          <div className="text-[10px] text-muted-foreground">Drive Time</div>
                        </div>
                      )}
                      <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-center">
                        <div className="font-mono text-lg font-bold text-primary">{(contractHours.totalCrewHours + contractHours.totalDriveHours).toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                        <div className="text-[10px] text-muted-foreground">Total{contractHours.totalDriveHours > 0 ? ' (crew + drive)' : ''}</div>
                      </div>
                    </div>
                    {/* Per-unit hours breakdown */}
                    {contractHours.unitHoursMap.size > 0 && (
                      <div className="mt-3 border-t border-border pt-3">
                        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hours by Unit</div>
                        <div className="flex flex-col gap-1">
                          {contractUnits
                            .filter(u => (contractHours.unitHoursMap.get(u.id) || 0) > 0 || (u.total_hours_logged || 0) > 0)
                            .map(u => {
                              const unitHrs = contractHours.unitHoursMap.get(u.id) || u.total_hours_logged || 0
                              return (
                                <div key={u.id} className="flex items-center gap-2 text-[11px]">
                                  <span className="w-28 truncate text-muted-foreground">{u.name}</span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1e2d42]">
                                    <div
                                      className="h-full rounded-full bg-primary/70"
                                      style={{ width: `${contractHours.totalCrewHours > 0 ? Math.min(100, (unitHrs / contractHours.totalCrewHours) * 100) : 0}%` }}
                                    />
                                  </div>
                                  <span className="w-14 text-right font-mono text-foreground">{unitHrs.toLocaleString(undefined, { maximumFractionDigits: 1 })}h</span>
                                </div>
                              )
                            })
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Wage card — hidden for office/foreman */}
                {!hideFinancials && (
                  <div className="rounded-lg border border-border bg-elevated/50 px-4 py-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Fringe:</span> {selectedContract.has_fringe ? `$${selectedContract.fringe_rate || '0.00'}/hr` : 'None'} &middot;{' '}
                    <span className="font-medium text-foreground">Prevailing Wage:</span> {selectedContract.has_prevailing_wage ? 'Yes' : 'No'}
                    {selectedContract.prevailing_wage_rate && <> &middot; <span className="font-medium text-foreground">PW Rate:</span> ${selectedContract.prevailing_wage_rate}/hr</>}
                    {' '}&middot;{' '}
                    <span className="font-medium text-foreground">Bond:</span> {selectedContract.bond_paid ? 'Paid' : 'Unpaid'}
                    {selectedContract.payment_terms && <> &middot; <span className="font-medium text-foreground">Terms:</span> {selectedContract.payment_terms}</>}
                  </div>
                )}

                {/* Actions — Coming Soon (not Phase 1) */}
                <div className="flex items-center gap-3">
                  <button className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground opacity-50 cursor-not-allowed pointer-events-none">
                    <Mail className="mr-1.5 inline h-3 w-3" /> Email Insurance Agent <span className="ml-1 text-[9px]">(Coming Soon)</span>
                  </button>
                  <button className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground opacity-50 cursor-not-allowed pointer-events-none">
                    <ClipboardList className="mr-1.5 inline h-3 w-3" /> Onboarding Checklist <span className="ml-1 text-[9px]">(Coming Soon)</span>
                  </button>
                  <button className="rounded-md bg-primary/50 px-3 py-2 text-xs font-medium text-primary-foreground opacity-50 cursor-not-allowed pointer-events-none">
                    <Send className="mr-1.5 inline h-3 w-3" /> Send Update to Foreman <span className="ml-1 text-[9px]">(Coming Soon)</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'Units' && (() => {
              const filteredUnits = unitStatusFilter === 'all' ? contractUnits : contractUnits.filter(u => u.status === unitStatusFilter)
              const notStarted = contractUnits.filter(u => u.status === 'not_started').length
              const inProg = contractUnits.filter(u => u.status === 'in_progress').length
              const done = contractUnits.filter(u => u.status === 'completed').length
              return (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <UnitSummaryStats units={contractUnits} />
                  <button
                    onClick={() => { setEditingUnit(null); setShowUnitForm(true) }}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[0_0_12px_rgba(34,197,94,0.3)] hover:bg-primary/90"
                  >
                    <TreePine className="h-3.5 w-3.5" /> Add Unit
                  </button>
                </div>
                {/* Filter tabs */}
                <div className="flex items-center gap-1.5">
                  {[
                    { key: 'all', label: 'All', count: contractUnits.length, color: 'text-foreground' },
                    { key: 'not_started', label: 'Not Started', count: notStarted, color: 'text-muted-foreground' },
                    { key: 'in_progress', label: 'In Progress', count: inProg, color: 'text-info' },
                    { key: 'completed', label: 'Completed', count: done, color: 'text-primary' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setUnitStatusFilter(f.key)}
                      className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                        unitStatusFilter === f.key
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {f.label} <span className="font-mono text-[10px] ml-0.5">{f.count}</span>
                    </button>
                  ))}
                </div>
                {filteredUnits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
                    <div className="text-sm text-muted-foreground">
                      {contractUnits.length === 0 ? 'No units added yet.' : `No ${unitStatusFilter.replace('_', ' ')} units.`}
                    </div>
                    {contractUnits.length === 0 && (
                      <button
                        onClick={() => { setEditingUnit(null); setShowUnitForm(true) }}
                        className="mt-2 rounded-md border border-dashed border-primary/30 px-4 py-2 text-xs text-primary hover:bg-primary/5"
                      >
                        + Add first unit
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="max-h-[600px] overflow-y-auto rounded-lg">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {filteredUnits.map(u => (
                        <UnitDetailCard
                          key={u.id}
                          unit={u}
                          role={role}
                          onEdit={(unit) => { setEditingUnit(unit); setShowUnitForm(true) }}
                          onStatusChange={refetchUnits}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )
            })()}

            {activeTab === 'Contacts' && selectedContract && (
              <ContractContactsTab
                contractId={selectedContract.id}
                initialContact={{
                  name: selectedContract.contact_name,
                  email: selectedContract.contact_email,
                  phone: selectedContract.contact_phone,
                }}
              />
            )}

            {activeTab === 'Calendar' && selectedContract && (
              <ContractCalendarTab contract={selectedContract} units={contractUnits} />
            )}

            {activeTab === 'Notes' && selectedContract && (
              <ContractNotesTab
                contractId={selectedContract.id}
                initialNotes={selectedContract.notes}
                initialAdminNotes={selectedContract.admin_notes}
                role={role}
                onSaved={refetchContracts}
              />
            )}

            {activeTab === 'Onboarding' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Onboarding checklist — coming soon
                </div>
              </div>
            )}

            {activeTab === 'Files' && selectedContract && (
              <ContractFilesTab contract={selectedContract} role={role} />
            )}

            {activeTab === 'Expenses' && selectedContract && role !== 'foreman' && (
              <ContractExpensesTab contractId={selectedContract.id} role={role} />
            )}

            {activeTab === 'Payroll' && selectedContract && role !== 'foreman' && (
              <ContractPayrollTab contractId={selectedContract.id} role={role} />
            )}

            {/* Placeholder for other tabs */}
            {!['Overview', 'Units', 'Contacts', 'Calendar', 'Notes', 'Onboarding', 'Files', 'Expenses', 'Payroll'].includes(activeTab) && (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                {activeTab} content — coming soon
              </div>
            )}
          </div>
        </div>
      )}

      <CreateContractSheet
        open={showCreateSheet}
        onOpenChange={setShowCreateSheet}
        onCreated={(id) => {
          setSelectedContractId(id)
          setActiveTab('Overview')
        }}
      />
      <EditContractSheet
        contract={selectedContract}
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        onUpdated={refetchContracts}
      />
      {selectedContract && (
        <UnitFormSheet
          key={editingUnit?.id ?? 'new'}
          contractId={selectedContract.id}
          unit={editingUnit}
          open={showUnitForm}
          onOpenChange={setShowUnitForm}
        />
      )}
    </div>
  )
}

/** Payroll tab within contract detail — aggregates timesheet entries on this
 * contract into a Gross top-line + 3 placeholder calc cards + per-employee
 * breakdown. Office sees totals; admin sees full breakdown. Foreman never
 * sees this view (gated upstream).
 */
function ContractPayrollTab({ contractId, role }: { contractId: string; role: string }) {
  const isAdmin = role === 'admin'
  // Office sees hours-only view (no gross / OT pay / fringe / placeholder calc cards).
  // Per Bees + Jaime call 2026-04-28: office gets line items, never totals.
  const isOffice = role === 'office'
  const hideFinancials = isOffice
  const { data: payroll, isLoading } = useClientQuery('contractPayroll', contractId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading payroll…
      </div>
    )
  }

  if (!payroll || payroll.totals.entryCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <CircleDollarSign className="h-8 w-8 text-muted-foreground/40" />
        <div className="text-sm font-medium text-foreground">No payroll data yet</div>
        <div className="text-xs text-muted-foreground max-w-sm">
          Payroll figures roll up here automatically once timesheet entries are
          submitted and approved on this project.
        </div>
      </div>
    )
  }

  const fmt$ = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const fmtH = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <div className="flex flex-col gap-4">
      {/* Header — title flips to "Project Hours" for Office */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {hideFinancials ? <Clock className="h-4 w-4 text-primary" /> : <CircleDollarSign className="h-4 w-4 text-primary" />}
            {hideFinancials ? 'Project Hours' : 'Project Payroll'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {payroll.totals.entryCount} timesheet entr
            {payroll.totals.entryCount !== 1 ? 'ies' : 'y'} ·{' '}
            {payroll.byEmployee.length} employee
            {payroll.byEmployee.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* 4-card top row (Gross + 3 placeholders) — hidden for Office.
          Per Bees + Jaime call 2026-04-28: office gets line items + hours,
          never totals or financial figures. */}
      {!hideFinancials && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-border bg-card px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Gross
            </div>
            <div className="font-mono text-base font-bold text-foreground">
              {fmt$(payroll.totals.gross)}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {fmtH(payroll.totals.regHours + payroll.totals.otHours + payroll.totals.driveHours)} hrs total
            </div>
          </div>

          <div className="rounded-md border border-border/50 border-dashed bg-muted/30 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Calculation 1
            </div>
            <div className="font-mono text-base font-bold text-muted-foreground/60">
              —
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground/70">
              Pending Jaime input
            </div>
          </div>

          <div className="rounded-md border border-border/50 border-dashed bg-muted/30 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Calculation 2
            </div>
            <div className="font-mono text-base font-bold text-muted-foreground/60">
              —
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground/70">
              Pending Jaime input
            </div>
          </div>

          <div className="rounded-md border border-border/50 border-dashed bg-muted/30 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Calculation 3
            </div>
            <div className="font-mono text-base font-bold text-muted-foreground/60">
              —
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground/70">
              Pending Jaime input
            </div>
          </div>
        </div>
      )}

      {/* Hours breakdown — admin only (foreman+office shouldn't see fringe etc) */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-border bg-elevated px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Reg hours
            </div>
            <div className="font-mono text-sm font-semibold text-foreground">
              {fmtH(payroll.totals.regHours)}
            </div>
          </div>
          <div className="rounded-md border border-border bg-elevated px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              OT hours
            </div>
            <div className="font-mono text-sm font-semibold text-foreground">
              {fmtH(payroll.totals.otHours)}
            </div>
          </div>
          <div className="rounded-md border border-border bg-elevated px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Drive hours
            </div>
            <div className="font-mono text-sm font-semibold text-foreground">
              {fmtH(payroll.totals.driveHours)}
            </div>
          </div>
          <div className="rounded-md border border-border bg-elevated px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Fringe
            </div>
            <div className="font-mono text-sm font-semibold text-foreground">
              {fmt$(payroll.totals.fringe)}
            </div>
          </div>
        </div>
      )}

      {/* Per-employee breakdown — Gross + Fringe columns hidden from Office */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-3 py-2">
          <h4 className="text-xs font-semibold text-foreground">By employee</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/20">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground">Employee</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Reg hrs</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">OT hrs</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Drive hrs</th>
                {isAdmin && (
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Fringe</th>
                )}
                {!hideFinancials && (
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Gross</th>
                )}
              </tr>
            </thead>
            <tbody>
              {payroll.byEmployee.map((row) => (
                <tr key={row.employeeId} className="border-t border-border hover:bg-muted/10">
                  <td className="px-3 py-2 text-foreground">{row.name}</td>
                  <td className="px-3 py-2 font-mono text-right text-foreground">
                    {fmtH(row.regHours)}
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-foreground">
                    {row.otHours > 0 ? fmtH(row.otHours) : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-foreground">
                    {row.driveHours > 0 ? fmtH(row.driveHours) : '—'}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 font-mono text-right text-foreground">
                      {row.fringe > 0 ? fmt$(row.fringe) : '—'}
                    </td>
                  )}
                  {!hideFinancials && (
                    <td className="px-3 py-2 font-mono text-right font-semibold text-foreground">
                      {fmt$(row.gross)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td className="px-3 py-2 text-foreground">Total</td>
                <td className="px-3 py-2 font-mono text-right text-foreground">
                  {fmtH(payroll.totals.regHours)}
                </td>
                <td className="px-3 py-2 font-mono text-right text-foreground">
                  {fmtH(payroll.totals.otHours)}
                </td>
                <td className="px-3 py-2 font-mono text-right text-foreground">
                  {fmtH(payroll.totals.driveHours)}
                </td>
                {isAdmin && (
                  <td className="px-3 py-2 font-mono text-right text-foreground">
                    {fmt$(payroll.totals.fringe)}
                  </td>
                )}
                {!hideFinancials && (
                  <td className="px-3 py-2 font-mono text-right text-foreground">
                    {fmt$(payroll.totals.gross)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Calendar tab within contract detail — shows contract date range + unit timeline + month grid */
function ContractCalendarTab({ contract, units }: { contract: Contract; units: Unit[] }) {
  const todayStr = new Date().toISOString().split('T')[0]
  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calYear, setCalYear] = useState(now.getFullYear())

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  // Contract date range
  const startDate = contract.start_date ? new Date(contract.start_date + 'T00:00:00') : null
  const endDate = contract.end_date ? new Date(contract.end_date + 'T00:00:00') : null
  const totalDays = startDate && endDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const elapsed = startDate
    ? Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const remaining = totalDays && elapsed ? Math.max(0, totalDays - elapsed) : null
  const progressPct = totalDays && elapsed ? Math.min(100, Math.round((elapsed / totalDays) * 100)) : null

  // Month calendar grid
  const firstDay = new Date(calYear, calMonth, 1)
  const lastDay = new Date(calYear, calMonth + 1, 0)
  const startDayOfWeek = firstDay.getDay() // 0=Sun
  const daysInMonth = lastDay.getDate()

  // Build weeks array
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(startDayOfWeek).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  // Contract date markers for the current month
  const contractStartDay = startDate && startDate.getMonth() === calMonth && startDate.getFullYear() === calYear
    ? startDate.getDate() : null
  const contractEndDay = endDate && endDate.getMonth() === calMonth && endDate.getFullYear() === calYear
    ? endDate.getDate() : null

  // Is a day within the contract range?
  const isInContract = (day: number) => {
    if (!startDate || !endDate) return false
    const d = new Date(calYear, calMonth, day)
    return d >= startDate && d <= endDate
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Contract Duration */}
      <div className="rounded-lg border border-border bg-elevated/30 p-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">Project Duration</div>
        {startDate && endDate ? (
          <>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-foreground font-medium">
                {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-muted-foreground text-xs">{totalDays} days total</span>
              <span className="text-foreground font-medium">
                {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-elevated overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  progressPct !== null && progressPct >= 90 ? 'bg-warning' : 'bg-primary'
                }`}
                style={{ width: `${progressPct || 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{elapsed} days elapsed</span>
              {todayStr > (contract.end_date || '') ? (
                <span className="text-destructive font-medium">Project ended</span>
              ) : (
                <span>{remaining} days remaining</span>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground italic">No dates set for this project</div>
        )}
      </div>

      {/* Key Dates */}
      <div className="rounded-lg border border-border bg-elevated/30 p-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">Key Dates</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3">
            <div className="text-[10px] text-muted-foreground">Project Start</div>
            <div className="text-sm font-medium text-foreground mt-0.5">
              {contract.start_date
                ? new Date(contract.start_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : '—'}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-[10px] text-muted-foreground">Project End</div>
            <div className="text-sm font-medium text-foreground mt-0.5">
              {contract.end_date
                ? new Date(contract.end_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : '—'}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-[10px] text-muted-foreground">Units</div>
            <div className="text-sm font-medium text-foreground mt-0.5">
              {units.filter(u => u.status === 'completed').length} / {units.length} completed
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-[10px] text-muted-foreground">Status</div>
            <div className={`text-sm font-medium mt-0.5 capitalize ${
              contract.status === 'active' ? 'text-primary' : 'text-muted-foreground'
            }`}>
              {contract.status}
            </div>
          </div>
        </div>
      </div>

      {/* Month Calendar Grid */}
      <div className="rounded-lg border border-border bg-elevated/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="text-xs font-semibold text-foreground min-w-[120px] text-center">
              {new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button
              onClick={nextMonth}
              className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-3 text-[9px]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Today</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-primary/15" /> Project period</span>
            {contractStartDay && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-info" /> Start</span>}
            {contractEndDay && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> End</span>}
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <th key={d} className="py-1.5 text-center text-[10px] font-medium text-muted-foreground">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, wi) => (
              <tr key={wi}>
                {w.map((day, di) => {
                  if (day === null) return <td key={di} className="p-1" />
                  const isToday = day === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear()
                  const inRange = isInContract(day)
                  const isStart = day === contractStartDay
                  const isEnd = day === contractEndDay
                  return (
                    <td key={di} className="p-0.5">
                      <div className={`flex h-8 items-center justify-center rounded text-xs transition-colors ${
                        isToday ? 'bg-primary text-primary-foreground font-bold'
                        : isStart ? 'bg-info/20 text-info font-semibold ring-1 ring-info/40'
                        : isEnd ? 'bg-warning/20 text-warning font-semibold ring-1 ring-warning/40'
                        : inRange ? 'bg-primary/8 text-foreground'
                        : 'text-muted-foreground'
                      }`}>
                        {day}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unit Status List — below calendar */}
      {units.length > 0 && (
        <div className="rounded-lg border border-border bg-elevated/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit Status</div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-primary font-medium">{units.filter(u => u.status === 'completed').length} Done</span>
              <span className="text-info font-medium">{units.filter(u => u.status === 'in_progress').length} Active</span>
              <span className="text-muted-foreground">{units.filter(u => u.status !== 'completed' && u.status !== 'in_progress').length} Pending</span>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto flex flex-col gap-1.5">
            {units.map(u => {
              const uStatus = u.status || 'not_started'
              return (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-[140px] shrink-0 text-xs text-foreground truncate font-medium">
                    {u.name}
                  </div>
                  <div className="flex-1 h-3 rounded-full bg-elevated overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        uStatus === 'completed' ? 'bg-primary'
                        : uStatus === 'in_progress' ? 'bg-info'
                        : 'bg-muted-foreground/20'
                      }`}
                      style={{ width: `${u.completion_pct || 0}%` }}
                    />
                  </div>
                  <div className="w-[40px] text-right text-[10px] font-mono text-muted-foreground">
                    {u.completion_pct || 0}%
                  </div>
                  <span className={`w-[55px] text-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                    uStatus === 'completed' ? 'bg-primary/20 text-primary'
                    : uStatus === 'in_progress' ? 'bg-info/20 text-info'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {uStatus === 'completed' ? 'Done' : uStatus === 'in_progress' ? 'Active' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
