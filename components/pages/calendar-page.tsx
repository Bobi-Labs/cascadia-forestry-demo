"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, ShieldCheck, CalendarDays } from "lucide-react"
import { useContracts, useComplianceItems } from "@/hooks/use-supabase"
import { useApp } from "@/lib/app-context"
import { CASCADIA_ID, RAMOS_ID } from "@/lib/database.types"
import type { Contract } from "@/lib/database.types"
import { nowForDemo } from "@/lib/demo-mode"

// Calendar event types
type CalendarEvent = {
  date: string // YYYY-MM-DD
  label: string
  type: "contract-start" | "contract-end" | "compliance" | "today"
  color: string
  detail?: string
  contractId?: string // for navigation on click
  page?: string // target page (e.g. "contracts", "safetyCerts")
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function companyTag(companyId: string | null): string {
  if (companyId === CASCADIA_ID) return "C"
  if (companyId === RAMOS_ID) return "R"
  return ""
}

/** Map event count → heat intensity (0.0–1.0) */
function heatLevel(eventCount: number, inRange: boolean): number {
  if (eventCount === 0 && !inRange) return 0
  if (eventCount === 0 && inRange) return 0.08
  if (eventCount === 1) return 0.18
  if (eventCount === 2) return 0.32
  if (eventCount === 3) return 0.48
  return 0.6 // 4+
}

/** Green heatmap color at given intensity */
function heatBg(intensity: number): string {
  if (intensity === 0) return "transparent"
  // Use our primary green (34, 197, 94) = #22c55e
  return `rgba(34, 197, 94, ${intensity})`
}

/** Tooltip component */
function EventTooltip({
  events,
  visible,
  position,
}: {
  events: CalendarEvent[]
  visible: boolean
  position: { x: number; y: number }
}) {
  if (!visible || events.length === 0) return null

  return (
    <div
      className="fixed z-50 rounded-lg border border-border bg-card shadow-xl px-3 py-2.5 min-w-[180px] max-w-[260px] pointer-events-none"
      style={{ left: position.x + 12, top: position.y - 8 }}
    >
      <div className="text-[10px] text-muted-foreground font-medium mb-1.5">
        {events.length} event{events.length !== 1 ? "s" : ""}
      </div>
      <div className="flex flex-col gap-1.5">
        {events.map((evt, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${evt.color}`} />
            <div>
              <div className="text-xs font-medium text-foreground leading-tight">{evt.label}</div>
              {evt.detail && evt.detail !== evt.label && (
                <div className="text-[10px] text-muted-foreground leading-tight">{evt.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CalendarPage() {
  const { company, setActivePage, setSelectedContractId } = useApp()
  const { data: contracts, loading: contractsLoading } = useContracts()
  const { data: complianceItems, loading: complianceLoading } = useComplianceItems()

  const today = nowForDemo()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    events: CalendarEvent[]
    visible: boolean
    position: { x: number; y: number }
  }>({ events: [], visible: false, position: { x: 0, y: 0 } })

  // Navigate months
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }

  // Filter contracts by company
  const filteredContracts = useMemo(() => {
    if (!contracts) return []
    // Private contracts with null company_id appear in both Cascadia and
    // Ramos views — per Jaime, either crew might work them in the same year.
    if (company === "cascadia") return contracts.filter(c => c.company_id === CASCADIA_ID || c.company_id === null)
    if (company === "ramos") return contracts.filter(c => c.company_id === RAMOS_ID || c.company_id === null)
    return contracts
  }, [contracts, company])

  // Build events from contracts + compliance
  const events = useMemo(() => {
    const evts: CalendarEvent[] = []

    for (const c of filteredContracts) {
      if (c.start_date) {
        evts.push({
          date: c.start_date,
          label: `▶ ${c.name}`,
          type: "contract-start",
          color: "bg-primary",
          detail: `Start: ${c.name} (${companyTag(c.company_id)})`,
          contractId: c.id,
          page: "contracts",
        })
      }
      if (c.end_date) {
        evts.push({
          date: c.end_date,
          label: `■ ${c.name}`,
          type: "contract-end",
          color: "bg-warning",
          detail: `End: ${c.name} (${companyTag(c.company_id)})`,
          contractId: c.id,
          page: "contracts",
        })
      }
    }

    for (const ci of complianceItems || []) {
      if (ci.due_date) {
        evts.push({
          date: ci.due_date,
          label: ci.title || "Compliance",
          type: "compliance",
          color: ci.status === "overdue" ? "bg-destructive" : "bg-info",
          detail: ci.description || ci.title,
          page: "safetyCerts",
        })
      }
    }

    return evts
  }, [filteredContracts, complianceItems])

  // Events for current month
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`
  const monthEvents = useMemo(() => {
    return events.filter(e => e.date.startsWith(monthPrefix))
  }, [events, monthPrefix])

  // Events grouped by day
  const eventsByDay = useMemo(() => {
    const m = new Map<number, CalendarEvent[]>()
    for (const e of monthEvents) {
      const day = parseInt(e.date.split("-")[2], 10)
      if (!m.has(day)) m.set(day, [])
      m.get(day)!.push(e)
    }
    return m
  }, [monthEvents])

  // Active contract ranges for the current month
  const activeRanges = useMemo(() => {
    const ranges: { contract: Contract; startDay: number; endDay: number }[] = []
    const dim = getDaysInMonth(viewYear, viewMonth)

    for (const c of filteredContracts) {
      if (!c.start_date || c.status !== "active") continue
      const cStart = new Date(c.start_date + "T00:00:00")
      const cEnd = c.end_date ? new Date(c.end_date + "T00:00:00") : new Date(2030, 0, 1)
      const monthStart = new Date(viewYear, viewMonth, 1)
      const monthEnd = new Date(viewYear, viewMonth, dim)

      if (cStart > monthEnd || cEnd < monthStart) continue

      const startDay = cStart < monthStart ? 1 : cStart.getDate()
      const endDay = cEnd > monthEnd ? dim : cEnd.getDate()

      ranges.push({ contract: c, startDay, endDay })
    }
    return ranges
  }, [filteredContracts, viewYear, viewMonth])

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)
  const todayDate = today.toISOString().split("T")[0]
  const loading = contractsLoading || complianceLoading

  // Build weeks for proper grid rendering
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  // Compute max events for relative scaling
  const maxEvents = useMemo(() => {
    let max = 0
    for (const [, evts] of eventsByDay) {
      if (evts.length > max) max = evts.length
    }
    return Math.max(max, 1)
  }, [eventsByDay])

  // Month stats for the summary strip
  const monthStats = useMemo(() => {
    let contractStarts = 0
    let contractEnds = 0
    let compliance = 0
    for (const evt of monthEvents) {
      if (evt.type === "contract-start") contractStarts++
      else if (evt.type === "contract-end") contractEnds++
      else if (evt.type === "compliance") compliance++
    }
    const activeDays = new Set<number>()
    for (const [day] of eventsByDay) activeDays.add(day)
    activeRanges.forEach(r => {
      for (let d = r.startDay; d <= r.endDay; d++) activeDays.add(d)
    })
    return { total: monthEvents.length, contractStarts, contractEnds, compliance, activeDays: activeDays.size }
  }, [monthEvents, eventsByDay, activeRanges])

  const handleCellHover = (e: React.MouseEvent, dayEvents: CalendarEvent[]) => {
    if (dayEvents.length > 0) {
      setTooltip({
        events: dayEvents,
        visible: true,
        position: { x: e.clientX, y: e.clientY },
      })
    }
  }

  const handleCellMove = (e: React.MouseEvent) => {
    if (tooltip.visible) {
      setTooltip(prev => ({ ...prev, position: { x: e.clientX, y: e.clientY } }))
    }
  }

  const handleCellLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }))
  }

  const handleEventClick = (evt: CalendarEvent) => {
    if (evt.contractId) setSelectedContractId(evt.contractId)
    if (evt.page) setActivePage(evt.page)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip + compliance alerts inline */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs font-semibold text-primary">{monthStats.total} Events</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{monthStats.contractStarts}</span> starts
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="text-[11px] text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{monthStats.contractEnds}</span> ends
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="text-[11px] text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{monthStats.compliance}</span> compliance
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{monthStats.activeDays}</span>/{daysInMonth} active days
          </span>
        </div>
        {/* Inline compliance alerts */}
        {(complianceItems || [])
          .filter(ci => ci.due_date && ci.due_date >= todayDate)
          .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
          .slice(0, 3)
          .map((ci, i) => {
            const daysUntil = ci.due_date
              ? Math.ceil((new Date(ci.due_date + "T00:00:00").getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              : 999
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium border ${
                  daysUntil <= 7
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : daysUntil <= 30
                      ? "border-warning/30 bg-warning/10 text-warning"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                <ShieldCheck className="h-3 w-3" />
                <span className="truncate max-w-[140px]">{ci.title}</span>
                <span className="font-mono">{daysUntil}d</span>
              </div>
            )
          })}
      </div>

      {/* Full-width Calendar Grid */}
      <div data-tour="calendar-heatmap" className="rounded-lg border border-border/50 bg-border/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-elevated/30 px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-foreground min-w-[180px] text-center">
              {formatMonthYear(viewYear, viewMonth)}
            </h3>
            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className="ml-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              Today
            </button>
          </div>
          {/* Heat scale legend + color legend combined */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Start
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-warning" /> End
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-info" /> Compliance
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Overdue
              </span>
            </div>
            <span className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-0.5">
                {[0.05, 0.12, 0.22, 0.35, 0.5, 0.65].map((intensity, idx) => (
                  <div
                    key={idx}
                    className="h-3 w-3 rounded-sm border border-white/5"
                    style={{ backgroundColor: heatBg(intensity) }}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-px bg-border/40">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="bg-elevated/30 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Week rows — heatmap grid, cells grow to fill available space */}
        <div className="grid grid-cols-7 gap-px bg-border/30" style={{ gridAutoRows: "1fr" }}>
          {weeks.flat().map((day, i) => {
            if (day === null) {
              return (
                <div
                  key={i}
                  className="min-h-[120px] bg-[hsl(222,30%,8%)]"
                />
              )
            }

            const ds = dateStr(viewYear, viewMonth, day)
            const isToday = ds === todayDate
            const dayEvents = eventsByDay.get(day) || []
            const inRange = activeRanges.some(r => day >= r.startDay && day <= r.endDay)
            const heat = heatLevel(dayEvents.length, inRange)
            const di = i % 7
            const isWeekend = di === 0 || di === 6

            // Base cell bg — dark surface, then heat overlay
            const baseBg = isWeekend && heat === 0 ? "hsl(222, 30%, 7%)" : "hsl(222, 25%, 10%)"

            return (
              <div
                key={i}
                className={`min-h-[120px] p-1.5 transition-all duration-200 cursor-default relative ${
                  isToday ? "ring-2 ring-inset ring-primary/60" : ""
                }`}
                style={{ backgroundColor: heat > 0 || isToday ? heatBg(isToday ? Math.max(heat, 0.12) : heat) : baseBg }}
                onMouseEnter={(e) => handleCellHover(e, dayEvents)}
                onMouseMove={handleCellMove}
                onMouseLeave={handleCellLeave}
              >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium ${
                        isToday
                          ? "bg-primary text-primary-foreground font-bold"
                          : dayEvents.length > 0
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground"
                      }`}
                    >
                      {day}
                    </span>
                    {/* Event count badge */}
                    {dayEvents.length > 0 && (
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/20 px-1 text-[9px] font-bold text-primary font-mono">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Event pills — clickable, navigate to source page */}
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 4).map((evt, ei) => (
                      <button
                        key={ei}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleEventClick(evt) }}
                        className={`flex items-center gap-1 rounded px-1 py-[2px] text-[9px] leading-tight font-medium text-left cursor-pointer hover:brightness-125 transition-all ${
                          evt.type === "contract-start"
                            ? "bg-primary/20 text-primary"
                            : evt.type === "contract-end"
                              ? "bg-warning/20 text-warning"
                              : evt.color.includes("destructive")
                                ? "bg-destructive/20 text-destructive"
                                : "bg-info/20 text-info"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${evt.color} shrink-0`} />
                        <span className="truncate">{evt.label}</span>
                      </button>
                    ))}
                    {dayEvents.length > 4 && (
                      <span className="text-[8px] text-muted-foreground font-medium pl-1">
                        +{dayEvents.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Contract Timeline — Full-width Gantt */}
      <div data-tour="calendar-gantt" className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Contract Timeline
          </h3>
        </div>
        <div className="p-4 overflow-x-auto">
          <ContractTimeline contracts={filteredContracts} onContractClick={(id) => { setSelectedContractId(id); setActivePage("contracts") }} />
        </div>
      </div>

      {/* Tooltip overlay */}
      <EventTooltip {...tooltip} />
    </div>
  )
}

/** Gantt-style timeline of contract durations */
function ContractTimeline({ contracts, onContractClick }: { contracts: Contract[]; onContractClick?: (id: string) => void }) {
  const withDates = contracts.filter(c => c.start_date && c.status !== "closed")

  if (withDates.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        No contracts with date ranges to display
      </div>
    )
  }

  // Center the timeline on today — show equal past and future
  const today = nowForDemo()
  const allDates = withDates.flatMap(c => [c.start_date!, c.end_date || c.start_date!])
  const minDate = new Date(Math.min(...allDates.map(d => new Date(d + "T00:00:00").getTime())))
  const maxDate = new Date(Math.max(...allDates.map(d => new Date(d + "T00:00:00").getTime())))

  // Use the larger of past/future span in both directions (minimum 6 months each way)
  const pastMs = today.getTime() - minDate.getTime()
  const futureMs = maxDate.getTime() - today.getTime()
  const minSpanMs = 180 * 24 * 60 * 60 * 1000 // 6 months
  const spanMs = Math.max(pastMs, futureMs, minSpanMs)

  const rangeStart = new Date(today.getTime() - spanMs)
  rangeStart.setDate(1) // snap to month start
  const rangeEnd = new Date(today.getTime() + spanMs)
  rangeEnd.setMonth(rangeEnd.getMonth() + 1, 0) // snap to month end

  const totalDays = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)))

  function dayOffset(dateStr: string): number {
    const d = new Date(dateStr + "T00:00:00")
    return Math.max(0, Math.ceil((d.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)))
  }

  const todayOffset = dayOffset(today.toISOString().split("T")[0])

  // Generate month labels
  const months: { label: string; offset: number }[] = []
  const cursor = new Date(rangeStart)
  cursor.setDate(1)
  while (cursor <= rangeEnd) {
    const offset = Math.max(0, Math.ceil((cursor.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)))
    months.push({
      label: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      offset,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const sorted = [...withDates].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1
    if (b.status === "active" && a.status !== "active") return 1
    return (a.start_date || "").localeCompare(b.start_date || "")
  })

  return (
    <div className="min-w-[600px]">
      {/* Month headers */}
      <div className="relative h-6 mb-2 border-b border-border/50">
        {months.map((m, i) => (
          <div
            key={i}
            className="absolute top-0 text-[10px] text-muted-foreground font-medium"
            style={{ left: `${(m.offset / totalDays) * 100}%` }}
          >
            {m.label}
          </div>
        ))}
        {/* Today marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-primary"
          style={{ left: `${(todayOffset / totalDays) * 100}%` }}
        >
          <span className="absolute -top-0.5 -translate-x-1/2 text-[8px] font-bold text-primary bg-card px-1 rounded">
            TODAY
          </span>
        </div>
      </div>

      {/* Contract bars */}
      <div className="flex flex-col gap-1.5">
        {sorted.map(c => {
          const start = dayOffset(c.start_date!)
          const end = c.end_date ? dayOffset(c.end_date) : todayOffset + 14
          const width = Math.max(1, end - start)
          const isCascadia = c.company_id === CASCADIA_ID
          const isActive = c.status === "active"

          return (
            <div key={c.id} className="flex items-center gap-2 h-7">
              <button
                type="button"
                onClick={() => onContractClick?.(c.id)}
                className="w-[140px] shrink-0 text-[11px] text-foreground truncate font-medium text-left hover:text-primary transition-colors cursor-pointer"
              >
                <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${isCascadia ? "bg-primary" : "bg-blue-400"}`} />
                {c.name}
              </button>
              <div className="relative flex-1 h-5">
                <div
                  onClick={() => onContractClick?.(c.id)}
                  className={`absolute top-0 h-full rounded-sm transition-all cursor-pointer hover:brightness-125 ${
                    isActive
                      ? isCascadia
                        ? "bg-primary/30 border border-primary/40"
                        : "bg-blue-400/30 border border-blue-400/40"
                      : "bg-muted/50 border border-border"
                  }`}
                  style={{
                    left: `${(start / totalDays) * 100}%`,
                    width: `${(width / totalDays) * 100}%`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center px-1.5 overflow-hidden">
                    <span className={`text-[9px] font-medium truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {c.work_types?.join(", ") || ""}
                    </span>
                  </div>
                </div>
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/20"
                  style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
