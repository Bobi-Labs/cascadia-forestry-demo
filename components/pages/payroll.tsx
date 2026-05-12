"use client"

import { useMemo } from "react"
import { DollarSign, Clock, AlertTriangle, Info, Users, TrendingUp } from "lucide-react"
import { useWeeklyOTData, useEmployees, useTimesheetsWithDetails } from "@/hooks/use-supabase"
import { useApp } from "@/lib/app-context"
import { CASCADIA_ID, RAMOS_ID } from "@/lib/database.types"

function getDisplayWeek(): { start: string; end: string; label: string } {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  if (day === 0) monday.setDate(now.getDate() - 6)
  else if (day === 6) monday.setDate(now.getDate() - 5)
  else monday.setDate(now.getDate() - (day - 1))
  monday.setHours(0, 0, 0, 0)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  const label = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${friday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
  return { start: fmt(monday), end: fmt(friday), label }
}

export function PayrollPage() {
  const { company } = useApp()
  const week = useMemo(() => getDisplayWeek(), [])
  const { data: otData, loading: otLoading } = useWeeklyOTData(week.start, week.end)
  const { data: employees, loading: empLoading } = useEmployees()
  const { data: timesheets } = useTimesheetsWithDetails()

  // Filter by company
  const filteredEmployees = useMemo(() => {
    if (!employees) return []
    if (company === "cascadia") return employees.filter(e => e.company_auth === "cascadia" || e.company_auth === "both")
    if (company === "ramos") return employees.filter(e => e.company_auth === "ramos" || e.company_auth === "both")
    return employees
  }, [employees, company])

  const activeCount = filteredEmployees.filter(e => e.status === "active").length

  // Compute payroll summary from OT data
  const summary = useMemo(() => {
    if (!otData || otData.length === 0) return null
    const totalRegHours = otData.reduce((s, e) => s + Math.min(e.total_hours, 40), 0)
    const totalOTHours = otData.reduce((s, e) => s + Math.max(0, e.total_hours - 40), 0)
    const totalDriveHours = otData.reduce((s, e) => s + e.total_drive_hours, 0)
    const otCount = otData.filter(e => e.total_hours > 40).length
    const avgRate = 22.50
    const driveRate = 17.13
    const estGross = Math.round(totalRegHours * avgRate + totalOTHours * avgRate * 1.5 + totalDriveHours * driveRate)
    return { totalRegHours, totalOTHours, totalDriveHours, otCount, estGross, workerCount: otData.length }
  }, [otData])

  // Pending timesheets this week
  const pendingThisWeek = timesheets?.filter(ts =>
    ts.date >= week.start && ts.date <= week.end && ts.status === "submitted"
  ).length || 0

  const loading = otLoading || empLoading

  return (
    <div className="flex flex-col gap-5">
      {/* Phase notice */}
      <div className="flex items-center gap-3 rounded-lg border border-info/30 bg-info/5 px-4 py-3">
        <Info className="h-4 w-4 text-info shrink-0" />
        <div className="text-xs text-foreground">
          <span className="font-medium">Payroll Summary View</span> — Full payroll calculation, export, and period management coming in Phase 2.
          Current view shows real-time estimates from submitted timesheet data.
        </div>
      </div>

      {/* Week label */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{week.label}</span>
          <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
            Current Week
          </span>
        </div>
        {pendingThisWeek > 0 && (
          <span className="rounded-full bg-warning/20 px-2.5 py-0.5 text-[10px] font-semibold text-warning">
            {pendingThisWeek} sheet{pendingThisWeek > 1 ? "s" : ""} pending approval
          </span>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Est. Gross</div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">
            {loading ? "..." : summary ? `$${summary.estGross.toLocaleString()}` : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Active Workers</div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">
            {loading ? "..." : summary?.workerCount || "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Reg Hours</div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">
            {loading ? "..." : summary ? `${summary.totalRegHours.toFixed(0)}h` : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            OT Hours
            {summary && summary.otCount > 0 && <AlertTriangle className="h-3 w-3 text-warning" />}
          </div>
          <div className={`mt-1 font-mono text-2xl font-bold ${summary && summary.totalOTHours > 0 ? "text-warning" : "text-foreground"}`}>
            {loading ? "..." : summary ? `${summary.totalOTHours.toFixed(1)}h` : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Drive Hours</div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">
            {loading ? "..." : summary ? `${summary.totalDriveHours.toFixed(1)}h` : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">OT Risk</div>
          <div className={`mt-1 font-mono text-2xl font-bold ${summary && summary.otCount > 0 ? "text-destructive" : "text-primary"}`}>
            {loading ? "..." : summary ? (summary.otCount > 0 ? `${summary.otCount} over` : "Clear") : "—"}
          </div>
        </div>
      </div>

      {/* Worker hours breakdown */}
      {summary && otData && otData.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Worker Hours This Week</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">{otData.length} workers</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Employee</th>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-right font-medium">Work Hrs</th>
                  <th className="px-4 py-2.5 text-right font-medium">Drive Hrs</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...otData]
                  .sort((a, b) => (b.total_hours + b.total_drive_hours) - (a.total_hours + a.total_drive_hours))
                  .map((e, i) => {
                    const total = e.total_hours + e.total_drive_hours
                    const isOT = e.total_hours > 40
                    const isNearOT = e.total_hours >= 38 && !isOT
                    return (
                      <tr key={i} className="border-b border-border transition-colors hover:bg-elevated">
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {e.first_name} {e.last_name.charAt(0)}.
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            e.is_driver
                              ? "bg-info/20 text-info"
                              : e.is_foreman
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                          }`}>
                            {e.is_foreman ? "Foreman" : e.is_driver ? "Driver" : "Crew"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">
                          {e.total_hours.toFixed(1)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">
                          {e.total_drive_hours > 0 ? e.total_drive_hours.toFixed(1) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground">
                          {total.toFixed(1)}h
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {isOT ? (
                            <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-semibold text-destructive">OT</span>
                          ) : isNearOT ? (
                            <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold text-warning">Watch</span>
                          ) : (
                            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">OK</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
            Estimates based on avg crew rate $22.50/hr, OT at 1.5x, drive rate $17.13/hr.
            Actual payroll calculations require approved timesheets and contract-specific rates.
          </div>
        </div>
      )}
    </div>
  )
}
