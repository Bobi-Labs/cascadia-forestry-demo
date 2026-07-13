"use client"

import { useState, useMemo, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Download, CheckCircle2, XCircle, Eye, ChevronDown, Loader2, Trash2, Camera, ExternalLink } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { useTimesheetsWithDetails, useTimesheetEntries, useEmployees } from '@/hooks/use-supabase'
import { supabase } from '@/lib/supabase'
import { CASCADIA_ID, RAMOS_ID } from '@/lib/database.types'
import { IS_DEMO_MODE, nowForDemo } from '@/lib/demo-mode'
import { toast } from '@/hooks/use-toast'
import type { TimesheetWithDetails } from '@/hooks/use-supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

type StatusFilter = 'all' | 'submitted' | 'approved' | 'rejected' | 'draft'

function getWeekRange(offset: number): { start: string; end: string; label: string } {
  const now = nowForDemo()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const label = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return { start: fmt(monday), end: fmt(sunday), label }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function foremanName(ts: TimesheetWithDetails): string {
  if (!ts.foreman) return 'Unknown'
  return `${ts.foreman.first_name} ${ts.foreman.last_name}`
}

function contractName(ts: TimesheetWithDetails): string {
  return ts.contract?.name || 'Unknown'
}

// ─── Expanded Row Detail ────────────────────────────────

function TimesheetDetail({ timesheetId }: { timesheetId: string }) {
  const { data: entries, loading } = useTimesheetEntries(timesheetId)
  const { data: employees } = useEmployees()

  const empMap = useMemo(() => {
    const m = new Map<string, { name: string; role: string; is_driver: boolean }>()
    for (const e of employees || []) {
      m.set(e.id, {
        name: `${e.first_name} ${e.last_name}`,
        role: e.is_foreman ? 'Foreman' : e.is_driver ? 'Driver' : 'Crew',
        is_driver: e.is_driver,
      })
    }
    return m
  }, [employees])

  const presentEntries = (entries || []).filter(e => e.is_present)

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading entries...
      </div>
    )
  }

  if (presentEntries.length === 0) {
    return <div className="py-4 text-xs text-muted-foreground">No entries for this timesheet</div>
  }

  const totalGross = presentEntries.reduce((sum, e) => sum + (e.gross_pay || 0), 0)

  return (
    <div className="text-xs text-muted-foreground">
      <div className="mb-2 font-medium text-foreground">Per-Employee Breakdown</div>
      <table className="w-full">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="pb-1 text-left">Employee</th>
            <th className="pb-1 text-left">Role</th>
            <th className="pb-1 text-left">Work Type</th>
            <th className="pb-1 text-right">Hours</th>
            <th className="pb-1 text-right">Bags</th>
            <th className="pb-1 text-right">Drive Hrs</th>
            <th className="pb-1 text-right">OT</th>
            <th className="pb-1 text-right">Rate</th>
            <th className="pb-1 text-right">Gross</th>
          </tr>
        </thead>
        <tbody>
          {presentEntries.map((entry) => {
            const emp = empMap.get(entry.employee_id)
            return (
              <tr key={entry.id} className="border-t border-border/30">
                <td className="py-1 text-foreground">{emp?.name || 'Unknown'}</td>
                <td className="py-1">{emp?.role || '—'}</td>
                <td className="py-1">{entry.work_type || '—'}</td>
                <td className="py-1 text-right font-mono">{entry.hours_worked?.toFixed(1) || '—'}</td>
                <td className="py-1 text-right font-mono">{entry.bags_count || 0}</td>
                <td className="py-1 text-right font-mono">{entry.drive_hours ? entry.drive_hours.toFixed(1) : '—'}</td>
                <td className="py-1 text-right font-mono">{entry.ot_hours ? `${entry.ot_hours.toFixed(1)}` : '0'}</td>
                <td className="py-1 text-right font-mono">{entry.rate_applied ? `$${entry.rate_applied.toFixed(2)}/hr` : '—'}</td>
                <td className="py-1 text-right font-mono">{entry.gross_pay ? `$${entry.gross_pay.toFixed(2)}` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
        {totalGross > 0 && (
          <tfoot>
            <tr className="border-t border-border font-medium text-foreground">
              <td colSpan={8} className="py-1.5 text-right text-[10px] uppercase">Total Gross</td>
              <td className="py-1.5 text-right font-mono">${totalGross.toFixed(2)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────

export function TimeSheetsPage() {
  const { t, company, pageHint, setPageHint } = useApp()
  const { data: timesheets, loading, error, refetch } = useTimesheetsWithDetails()
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TimesheetWithDetails | null>(null)
  const [deleteMessage, setDeleteMessage] = useState('')
  // Demo-mode optimistic status changes (approve/reject have no backend to
  // persist to, so we overlay the new status on the static fixtures).
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({})

  // Photo submissions from Telegram
  type PhotoSubmission = { id: string; telegram_username: string; photo_url: string; caption: string | null; status: string; created_at: string }
  const [photoSubmissions, setPhotoSubmissions] = useState<PhotoSubmission[]>([])
  // Inline confirm state for the per-photo delete button. Holds the id of
  // the photo currently in "are you sure?" mode; null otherwise.
  const [photoConfirmDeleteId, setPhotoConfirmDeleteId] = useState<string | null>(null)
  useEffect(() => {
    supabase
      .from('timesheet_photos' as never)
      .select('id, telegram_username, photo_url, caption, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }: { data: unknown }) => {
        if (data) setPhotoSubmissions(data as PhotoSubmission[])
      })
  }, [])

  const deletePhotoSubmission = useCallback(async (id: string) => {
    const { error } = await supabase.from('timesheet_photos' as never).delete().eq('id', id)
    if (error) {
      console.error('Failed to delete timesheet photo:', error)
      window.alert(`Delete failed: ${error.message}`)
      return
    }
    setPhotoSubmissions(prev => prev.filter(p => p.id !== id))
    setPhotoConfirmDeleteId(null)
  }, [])

  // Apply filter hint from navigation (e.g., overview KPI "Review Now" click)
  useEffect(() => {
    if (pageHint === 'filter:submitted' && timesheets) {
      setStatusFilter('submitted')
      // Navigate to the week containing the oldest pending sheet
      const pending = timesheets.filter(ts => ts.status === 'submitted')
      if (pending.length > 0) {
        const oldest = pending.reduce((a, b) => (a.date < b.date ? a : b))
        const sheetDate = new Date(oldest.date + 'T00:00:00')
        const now = nowForDemo()
        const dayOfWeek = now.getDay()
        const currentMonday = new Date(now)
        currentMonday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        currentMonday.setHours(0, 0, 0, 0)
        const diffDays = Math.floor((sheetDate.getTime() - currentMonday.getTime()) / (1000 * 60 * 60 * 24))
        const targetOffset = Math.floor(diffDays / 7)
        setWeekOffset(targetOffset)
      }
      setPageHint(null)
    }
  }, [pageHint, setPageHint, timesheets])

  const handleApprove = useCallback(async (timesheetId: string) => {
    // Demo mode: no backend. Optimistically flip the row to approved and
    // confirm with a toast so the action is visible on screen.
    if (IS_DEMO_MODE) {
      setStatusOverrides(prev => ({ ...prev, [timesheetId]: 'approved' }))
      toast({ title: 'Timesheet approved' })
      return
    }
    setActionLoading(timesheetId)
    try {
      // 1. Update timesheet status to approved
      const { error: err } = await supabase
        .from('timesheets')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', timesheetId)

      if (err) throw err

      // 2. Aggregate unit hours: fetch timesheet_unit_hours + crew count for this timesheet
      const { data: unitHours, error: uhErr } = await supabase
        .from('timesheet_unit_hours')
        .select('unit_id, hours_on_unit, status_at_submit')
        .eq('timesheet_id', timesheetId)

      // Get crew size (present employees) for labor-hour calculation
      const { data: entries, error: entErr } = await supabase
        .from('timesheet_entries')
        .select('is_present')
        .eq('timesheet_id', timesheetId)

      const crewSize = entries?.filter(e => e.is_present).length || 1

      if (uhErr) {
        console.error('Failed to fetch unit hours for aggregation:', uhErr)
      } else if (unitHours && unitHours.length > 0) {
        // For each unit, increment total_hours_logged with labor hours (crew-time × crew size)
        for (const uh of unitHours) {
          // Fetch current unit hours
          const { data: unitRow, error: unitFetchErr } = await supabase
            .from('units')
            .select('total_hours_logged, status')
            .eq('id', uh.unit_id)
            .single()

          if (unitFetchErr) {
            console.error(`Failed to fetch unit ${uh.unit_id}:`, unitFetchErr)
            continue
          }

          const currentHours = unitRow?.total_hours_logged || 0
          // Labor hours = hours on unit × crew size
          // e.g. 5 hours on unit × 12 crew members = 60 labor hours
          const laborHours = (uh.hours_on_unit || 0) * crewSize
          const newHours = currentHours + laborHours

          // Build update payload: always increment hours
          const updatePayload: { total_hours_logged: number; status?: string } = {
            total_hours_logged: newHours,
          }

          // If foreman marked unit completed and it's not already completed, update status
          if (uh.status_at_submit === 'completed' && unitRow?.status !== 'completed') {
            updatePayload.status = 'completed'
          }

          const { error: unitUpdateErr } = await supabase
            .from('units')
            .update(updatePayload)
            .eq('id', uh.unit_id)

          if (unitUpdateErr) {
            console.error(`Failed to update unit ${uh.unit_id} hours:`, unitUpdateErr)
          }
        }
      }

      refetch()
    } catch (err: any) {
      console.error('Approve error:', err)
      alert(`Failed to approve: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }, [refetch])

  const handleReject = useCallback(async (timesheetId: string) => {
    const reason = window.prompt('Rejection reason (optional):')
    if (reason === null) return // user cancelled

    if (IS_DEMO_MODE) {
      setStatusOverrides(prev => ({ ...prev, [timesheetId]: 'rejected' }))
      toast({ title: 'Timesheet rejected' })
      return
    }

    setActionLoading(timesheetId)
    try {
      const { error: err } = await supabase
        .from('timesheets')
        .update({
          status: 'rejected',
          notes: reason || null,
        })
        .eq('id', timesheetId)

      if (err) throw err
      refetch()
    } catch (err: any) {
      console.error('Reject error:', err)
      alert(`Failed to reject: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }, [refetch])

  const confirmDelete = useCallback(async (notify: boolean) => {
    if (!deleteTarget) return
    const ts = deleteTarget

    setActionLoading(ts.id)
    setDeleteTarget(null)

    try {
      // Optionally notify foreman
      if (notify && deleteMessage.trim()) {
        const contractLabel = ts.contract?.name || 'Unknown'
        const dateLabel = formatDate(ts.date)

        await supabase.from('notifications').insert({
          user_id: null, // will link to foreman's user when auth exists
          title: `Timesheet Returned — ${contractLabel} ${dateLabel}`,
          body: deleteMessage.trim(),
          type: 'action',
          link: '/foreman/submit-timesheet',
        })
      }

      const { error: err } = await supabase
        .from('timesheets')
        .delete()
        .eq('id', ts.id)

      if (err) throw err
      refetch()
    } catch (err: any) {
      console.error('Delete error:', err)
      alert(`Failed to delete: ${err.message}`)
    } finally {
      setActionLoading(null)
      setDeleteMessage('')
    }
  }, [deleteTarget, deleteMessage, refetch])

  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset])

  // Apply demo-mode optimistic status overrides before any filtering so the
  // row, the status filter, and the pending/approved counts all agree.
  const effectiveTimesheets = useMemo(() => {
    if (!timesheets || Object.keys(statusOverrides).length === 0) return timesheets
    return timesheets.map(ts =>
      statusOverrides[ts.id] ? { ...ts, status: statusOverrides[ts.id] } : ts
    )
  }, [timesheets, statusOverrides])

  // Filter by company
  const companyFiltered = useMemo(() => {
    if (!effectiveTimesheets) return []
    if (company === 'cascadia') return effectiveTimesheets.filter(ts => ts.contract?.company_id === CASCADIA_ID)
    if (company === 'ramos') return effectiveTimesheets.filter(ts => ts.contract?.company_id === RAMOS_ID)
    return effectiveTimesheets
  }, [effectiveTimesheets, company])

  // Filter by week
  const weekFiltered = useMemo(() => {
    return companyFiltered.filter(ts => ts.date >= week.start && ts.date <= week.end)
  }, [companyFiltered, week])

  const handleBulkApprove = useCallback(() => {
    const pendingIds = weekFiltered.filter(ts => ts.status === 'submitted').map(ts => ts.id)
    if (pendingIds.length === 0) return
    if (IS_DEMO_MODE) {
      setStatusOverrides(prev => {
        const next = { ...prev }
        pendingIds.forEach(id => { next[id] = 'approved' })
        return next
      })
      toast({ title: `${pendingIds.length} timesheets approved` })
      return
    }
    pendingIds.forEach(id => handleApprove(id))
  }, [weekFiltered, handleApprove])

  // Filter by status
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return weekFiltered
    return weekFiltered.filter(ts => ts.status === statusFilter)
  }, [weekFiltered, statusFilter])

  // Stats
  const pendingCount = weekFiltered.filter(ts => ts.status === 'submitted').length
  const approvedCount = weekFiltered.filter(ts => ts.status === 'approved').length
  const totalCrewCount = weekFiltered.reduce((sum, ts) => sum + (ts.crew_count || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading timesheets...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load timesheets: {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter Bar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground hover:bg-elevated hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-elevated"
          >
            {week.label}
          </button>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground hover:bg-elevated hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div data-tour="timesheet-filters" className="flex items-center gap-2">
          {(['all', 'submitted', 'approved', 'rejected', 'draft'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s === 'submitted' && pendingCount > 0 && (
                <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning/20 text-[9px] text-warning">{pendingCount}</span>
              )}
            </button>
          ))}
          <div className="ml-2 h-5 w-px bg-border" />
          {/* Export writes a file, which the demo can't do, so hide it there */}
          {!IS_DEMO_MODE && (
            <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[0_0_12px_rgba(34,197,94,0.3)] hover:bg-primary/90">
              <Download className="mr-1.5 inline h-3 w-3" /> Export
            </button>
          )}
          {pendingCount > 0 && (
            <button
              onClick={handleBulkApprove}
              className="rounded-md border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
            >
              Bulk Approve ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Stats Strip */}
      <div className="flex items-center gap-6 rounded-lg border border-border bg-card px-4 py-2.5 text-xs">
        <div><span className="text-muted-foreground">Sheets This Week:</span> <span className="font-mono font-medium text-foreground">{weekFiltered.length}</span></div>
        <div className="h-3 w-px bg-border" />
        <div><span className="text-muted-foreground">Total Crew Entries:</span> <span className="font-mono font-medium text-foreground">{totalCrewCount}</span></div>
        <div className="h-3 w-px bg-border" />
        <div><span className="text-muted-foreground">Pending:</span> <span className="font-mono font-medium text-warning">{pendingCount}</span></div>
        <div className="h-3 w-px bg-border" />
        <div><span className="text-muted-foreground">Approved:</span> <span className="font-mono font-medium text-primary">{approvedCount}</span></div>
      </div>

      {/* Photo Submissions from Telegram */}
      {photoSubmissions.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-foreground">Timesheet Photos</span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">{photoSubmissions.filter(p => p.status === 'pending').length} pending</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Submitted via Telegram by foremen</span>
          </div>
          <div className="flex flex-col gap-2">
            {photoSubmissions.map(photo => (
              <div key={photo.id} className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2.5">
                <Camera className="h-4 w-4 flex-shrink-0 text-amber-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{photo.telegram_username}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(photo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                      {new Date(photo.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  {photo.caption && <p className="text-xs text-muted-foreground truncate mt-0.5">{photo.caption}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  photo.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                  photo.status === 'entered' ? 'bg-primary/20 text-primary' :
                  'bg-muted text-muted-foreground'
                }`}>{photo.status}</span>
                {photo.photo_url && (
                  <a href={photo.photo_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors whitespace-nowrap">
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {photo.status === 'pending' && (
                  <button
                    onClick={async () => {
                      await supabase.from('timesheet_photos' as never).update({ status: 'entered' } as never).eq('id', photo.id)
                      setPhotoSubmissions(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'entered' } : p))
                    }}
                    className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
                  >
                    Mark Entered
                  </button>
                )}
                {/* Per-row delete with inline confirm. First click flips the
                    button to a Yes/Cancel pair so a stray tap can't wipe a
                    photo. The actual TG message stays — bot can't delete TG
                    messages it didn't send (and even its own deletes are
                    capped at 48h). This only clears the dashboard row. */}
                {photoConfirmDeleteId === photo.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deletePhotoSubmission(photo.id)}
                      className="rounded bg-destructive/20 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/30 transition-colors whitespace-nowrap"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setPhotoConfirmDeleteId(null)}
                      className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPhotoConfirmDeleteId(photo.id)}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap"
                    title="Remove from dashboard (does not affect Telegram)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div data-tour="timesheets-list" className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Date</th>
                <th className="px-4 py-2.5 text-left font-medium">Foreman</th>
                <th className="px-4 py-2.5 text-left font-medium">Contract</th>
                <th className="px-4 py-2.5 text-center font-medium">Crew</th>
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No timesheets for this week
                  </td>
                </tr>
              ) : (
                filtered.map((ts) => (
                  <>
                    <tr
                      key={ts.id}
                      className="cursor-pointer border-b border-border transition-colors duration-150 hover:bg-elevated"
                      onClick={() => setExpandedRow(expandedRow === ts.id ? null : ts.id)}
                    >
                      <td className="px-4 py-3 text-foreground">{formatDate(ts.date)}</td>
                      <td className="px-4 py-3 text-foreground">{foremanName(ts)}</td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{contractName(ts)}</div>
                        {ts.contract?.company_id && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                            {ts.contract.company_id === CASCADIA_ID ? 'Cascadia' : 'Ramos'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-foreground">{ts.crew_count || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          ts.status === 'approved' ? 'bg-primary/20 text-primary' :
                          ts.status === 'submitted' ? 'bg-warning/20 text-warning' :
                          ts.status === 'rejected' ? 'bg-destructive/20 text-destructive' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          <span className={`h-1 w-1 rounded-full ${
                            ts.status === 'approved' ? 'bg-primary' :
                            ts.status === 'submitted' ? 'bg-warning pulse-dot' :
                            ts.status === 'rejected' ? 'bg-destructive' :
                            'bg-muted-foreground'
                          }`} />
                          {ts.status.charAt(0).toUpperCase() + ts.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {ts.status === 'submitted' && (
                            <>
                              <button
                                className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-50"
                                title="Approve"
                                disabled={actionLoading === ts.id}
                                onClick={(e) => { e.stopPropagation(); handleApprove(ts.id) }}
                              >
                                {actionLoading === ts.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              </button>
                              <button
                                className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                title="Reject"
                                disabled={actionLoading === ts.id}
                                onClick={(e) => { e.stopPropagation(); handleReject(ts.id) }}
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                              title="Delete"
                              disabled={actionLoading === ts.id}
                              onClick={(e) => { e.stopPropagation(); setDeleteMessage(''); setDeleteTarget(ts) }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          <button className="rounded p-1 text-muted-foreground hover:bg-elevated hover:text-foreground" title="View">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === ts.id && (
                      <tr key={`${ts.id}-expanded`}>
                        <td colSpan={6} className="bg-elevated/50 px-8 py-4">
                          <TimesheetDetail timesheetId={ts.id} />
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete Timesheet</DialogTitle>
            <DialogDescription>
              {deleteTarget?.status === 'approved'
                ? 'This timesheet has been approved. Are you sure you want to delete it? This cannot be undone.'
                : 'Delete this timesheet? The foreman will need to resubmit.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete-msg" className="text-sm font-medium text-foreground">
              Message to foreman (optional)
            </label>
            <textarea
              id="delete-msg"
              className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g., Hours for Lopez looked wrong, please resubmit with corrections"
              value={deleteMessage}
              onChange={(e) => setDeleteMessage(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-elevated"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmDelete(false)}
              className="rounded-md border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              Delete Without Message
            </button>
            <button
              type="button"
              onClick={() => confirmDelete(true)}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              Delete & Notify Foreman
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
