"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Clock, ChevronLeft, ChevronRight, Plus, Trash2, Save, Send,
  Loader2, Users, Check, X,
} from "lucide-react"
import { useApp } from "@/lib/app-context"
import {
  useActiveContracts,
  useEmployees,
  useWorkTypes,
  useCrewSets,
  useCrewSetMembers,
} from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { CASCADIA_ID, RAMOS_ID } from "@/lib/database.types"
import { nowForDemo } from "@/lib/demo-mode"
import { toast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

type EntryRow = {
  employee_id: string
  is_present: boolean
  hours_worked: string
  work_type: string
  bags_count: string
  drive_hours: string
  employee_note: string
}

function todayStr() {
  return nowForDemo().toISOString().split("T")[0]
}

export function OfficeTimesheetEntry() {
  const { company } = useApp()
  const { data: contracts, loading: contractsLoading } = useActiveContracts()
  const { data: employees, loading: employeesLoading } = useEmployees()
  const { data: workTypes } = useWorkTypes()
  const { data: crewSets } = useCrewSets()

  // Form state
  const [date, setDate] = useState(todayStr())
  const [contractId, setContractId] = useState<string | null>(null)
  const [foremanId, setForemanId] = useState<string | null>(null)
  const [crewSetId, setCrewSetId] = useState<string | null>(null)
  const [shiftStart, setShiftStart] = useState("06:00")
  const [shiftEnd, setShiftEnd] = useState("15:00")
  const [lunchOut, setLunchOut] = useState("12:00")
  const [lunchIn, setLunchIn] = useState("12:30")
  const [notes, setNotes] = useState("")
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [saving, setSaving] = useState(false)

  // Load crew set members
  const { data: crewMembers } = useCrewSetMembers(crewSetId)

  // Filter contracts by company. Private contracts without a company
  // show in both views since either crew might work them.
  const filteredContracts = useMemo(() => {
    if (!contracts) return []
    if (company === "cascadia") return contracts.filter(c => c.company_id === CASCADIA_ID || c.company_id === null)
    if (company === "ramos") return contracts.filter(c => c.company_id === RAMOS_ID || c.company_id === null)
    return contracts
  }, [contracts, company])

  // Active foremen
  const foremen = useMemo(() => {
    if (!employees) return []
    return employees.filter(e => e.is_foreman && e.status === "active")
  }, [employees])

  // Active employees (non-foreman)
  const activeEmployees = useMemo(() => {
    if (!employees) return []
    return employees.filter(e => e.status === "active")
  }, [employees])

  // Employee map for lookup
  const empMap = useMemo(() => {
    const m = new Map<string, { name: string; is_driver: boolean; is_foreman: boolean }>()
    for (const e of employees || []) {
      m.set(e.id, {
        name: `${e.first_name} ${e.last_name}`,
        is_driver: e.is_driver,
        is_foreman: e.is_foreman,
      })
    }
    return m
  }, [employees])

  // Default work type
  const defaultWorkType = useMemo(() => {
    const planting = workTypes?.find(wt => wt.name.toLowerCase() === "planting")
    return planting?.name || workTypes?.[0]?.name || "Planting"
  }, [workTypes])

  // Load crew set → populate entries
  const loadCrewSet = useCallback((setId: string) => {
    setCrewSetId(setId)
  }, [])

  // When crew members load, populate entries
  const populateFromCrewSet = useCallback(() => {
    if (!crewMembers || crewMembers.length === 0) return
    const newEntries: EntryRow[] = crewMembers.map(m => ({
      employee_id: m.employee_id,
      is_present: true,
      hours_worked: "8",
      work_type: defaultWorkType,
      bags_count: "0",
      drive_hours: "",
      employee_note: "",
    }))
    setEntries(newEntries)
  }, [crewMembers, defaultWorkType])

  // Add all active employees
  const addAllEmployees = useCallback(() => {
    const existing = new Set(entries.map(e => e.employee_id))
    const newEntries: EntryRow[] = activeEmployees
      .filter(e => !existing.has(e.id))
      .map(e => ({
        employee_id: e.id,
        is_present: true,
        hours_worked: "8",
        work_type: empMap.get(e.id)?.is_foreman ? "Foreman" : defaultWorkType,
        bags_count: "0",
        drive_hours: empMap.get(e.id)?.is_driver ? "2" : "",
        employee_note: "",
      }))
    setEntries(prev => [...prev, ...newEntries])
  }, [activeEmployees, entries, empMap, defaultWorkType])

  // Add single employee
  const addEmployee = useCallback((empId: string) => {
    if (entries.some(e => e.employee_id === empId)) return
    const emp = empMap.get(empId)
    setEntries(prev => [
      ...prev,
      {
        employee_id: empId,
        is_present: true,
        hours_worked: "8",
        work_type: emp?.is_foreman ? "Foreman" : defaultWorkType,
        bags_count: "0",
        drive_hours: emp?.is_driver ? "2" : "",
        employee_note: "",
      },
    ])
  }, [entries, empMap, defaultWorkType])

  // Remove employee
  const removeEntry = useCallback((idx: number) => {
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // Update entry field
  const updateEntry = useCallback((idx: number, field: keyof EntryRow, value: string | boolean) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }, [])

  // Toggle all present
  const toggleAllPresent = useCallback((present: boolean) => {
    setEntries(prev => prev.map(e => ({ ...e, is_present: present })))
  }, [])

  // Apply hours to all
  const applyHoursToAll = useCallback((hours: string) => {
    setEntries(prev => prev.map(e => e.is_present ? { ...e, hours_worked: hours } : e))
  }, [])

  // Summary stats
  const stats = useMemo(() => {
    const present = entries.filter(e => e.is_present)
    const totalHours = present.reduce((sum, e) => sum + (parseFloat(e.hours_worked) || 0), 0)
    const totalBags = present.reduce((sum, e) => sum + (parseInt(e.bags_count) || 0), 0)
    const totalDrive = present.reduce((sum, e) => sum + (parseFloat(e.drive_hours) || 0), 0)
    return { crewCount: present.length, totalHours, totalBags, totalDrive }
  }, [entries])

  // Save timesheet
  const handleSave = useCallback(async (status: "draft" | "submitted") => {
    if (!contractId) {
      toast({ title: "Error", description: "Select a project", variant: "destructive" })
      return
    }
    if (!foremanId) {
      toast({ title: "Error", description: "Select a foreman", variant: "destructive" })
      return
    }
    if (entries.length === 0) {
      toast({ title: "Error", description: "Add at least one employee", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      // Create timesheet
      const { data: ts, error: tsErr } = await supabase
        .from("timesheets")
        .insert({
          date,
          contract_id: contractId,
          foreman_id: foremanId,
          crew_set_id: crewSetId,
          status,
          shift_start: shiftStart || null,
          shift_end: shiftEnd || null,
          lunch_out: lunchOut || null,
          lunch_in: lunchIn || null,
          crew_count: stats.crewCount,
          notes: notes || null,
          submitted_at: status === "submitted" ? new Date().toISOString() : null,
        })
        .select("id")
        .single()

      if (tsErr) throw tsErr

      // Create entries
      const entryRows = entries.map(e => ({
        timesheet_id: ts.id,
        employee_id: e.employee_id,
        is_present: e.is_present,
        hours_worked: e.is_present ? parseFloat(e.hours_worked) || 0 : 0,
        work_type: e.is_present ? e.work_type : null,
        bags_count: e.is_present ? parseInt(e.bags_count) || 0 : 0,
        drive_hours: e.is_present && e.drive_hours ? parseFloat(e.drive_hours) : null,
        employee_note: e.employee_note || null,
      }))

      const { error: entErr } = await supabase
        .from("timesheet_entries")
        .insert(entryRows)

      if (entErr) throw entErr

      toast({
        title: status === "submitted" ? "Timesheet Submitted" : "Draft Saved",
        description: `${stats.crewCount} employees, ${stats.totalHours.toFixed(1)} total hours`,
      })

      // Reset form
      setEntries([])
      setContractId(null)
      setNotes("")
    } catch (err: any) {
      console.error("Save error:", err)
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [contractId, foremanId, crewSetId, date, shiftStart, shiftEnd, lunchOut, lunchIn, entries, notes, stats])

  if (contractsLoading || employeesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Office Timesheet Entry
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create timesheets on behalf of field crews
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => handleSave("draft")}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save Draft
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={saving}
            onClick={() => handleSave("submitted")}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Submit
          </Button>
        </div>
      </div>

      {/* Setup Row */}
      <div data-tour="office-ts-setup" className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Date */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="h-10 bg-background"
            />
          </div>

          {/* Contract */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Project</Label>
            <Select value={contractId ?? "__none__"} onValueChange={v => setContractId(v === "__none__" ? null : v)}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select —</SelectItem>
                {filteredContracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.company_id === CASCADIA_ID ? "(C)" : "(R)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Foreman */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Foreman</Label>
            <Select value={foremanId ?? "__none__"} onValueChange={v => setForemanId(v === "__none__" ? null : v)}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Select foreman" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select —</SelectItem>
                {foremen.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.first_name} {f.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Crew Set Quick-Load */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Load Crew Set</Label>
            <Select
              value={crewSetId ?? "__none__"}
              onValueChange={v => {
                if (v === "__none__") {
                  setCrewSetId(null)
                } else {
                  loadCrewSet(v)
                }
              }}
            >
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Quick-load crew" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Manual —</SelectItem>
                {crewSets?.map(cs => (
                  <SelectItem key={cs.id} value={cs.id}>
                    {cs.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Shift Times */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Shift Start</Label>
            <Input
              type="time"
              value={shiftStart}
              onChange={e => setShiftStart(e.target.value)}
              className="h-10 bg-background font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Lunch Out</Label>
            <Input
              type="time"
              value={lunchOut}
              onChange={e => setLunchOut(e.target.value)}
              className="h-10 bg-background font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Lunch In</Label>
            <Input
              type="time"
              value={lunchIn}
              onChange={e => setLunchIn(e.target.value)}
              className="h-10 bg-background font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Shift End</Label>
            <Input
              type="time"
              value={shiftEnd}
              onChange={e => setShiftEnd(e.target.value)}
              className="h-10 bg-background font-mono"
            />
          </div>
        </div>
      </div>

      {/* Crew Actions Bar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            <Users className="mr-1 inline h-3.5 w-3.5" />
            {entries.length} employees
          </span>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={addAllEmployees}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            + Add All Active
          </button>
          {crewSetId && crewMembers && crewMembers.length > 0 && (
            <button
              onClick={populateFromCrewSet}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
            >
              Load Crew Set ({crewMembers.length})
            </button>
          )}
          <button
            onClick={() => setEntries([])}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            Clear All
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleAllPresent(true)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-elevated"
            title="Mark all present"
          >
            <Check className="mr-1 inline h-3 w-3" /> All Present
          </button>
          <button
            onClick={() => {
              const hrs = window.prompt("Apply hours to all present employees:", "8")
              if (hrs !== null) applyHoursToAll(hrs)
            }}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-elevated"
          >
            Apply Hours to All
          </button>
        </div>
      </div>

      {/* Employee Table */}
      <div data-tour="office-ts-employees" className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="w-8 px-2 py-2.5 text-center font-medium">✓</th>
                <th className="px-3 py-2.5 text-left font-medium">Employee</th>
                <th className="w-20 px-2 py-2.5 text-center font-medium">Hours</th>
                <th className="w-36 px-2 py-2.5 text-left font-medium">Work Type</th>
                <th className="w-20 px-2 py-2.5 text-center font-medium">Bags</th>
                <th className="w-20 px-2 py-2.5 text-center font-medium">Drive Hrs</th>
                <th className="w-8 px-2 py-2.5 text-center font-medium" />
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No employees added. Use &quot;Add All Active&quot; or load a crew set above.
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => {
                  const emp = empMap.get(entry.employee_id)
                  return (
                    <tr
                      key={entry.employee_id}
                      className={`border-b border-border/50 transition-colors ${
                        !entry.is_present ? "opacity-40" : "hover:bg-elevated/50"
                      }`}
                    >
                      {/* Present toggle */}
                      <td className="px-2 py-2 text-center">
                        <Switch
                          checked={entry.is_present}
                          onCheckedChange={v => updateEntry(idx, "is_present", v)}
                          className="scale-75"
                        />
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium text-sm">
                            {emp?.name || "Unknown"}
                          </span>
                          {emp?.is_foreman && (
                            <span className="rounded bg-primary/20 px-1 py-0.5 text-[9px] text-primary font-medium">F</span>
                          )}
                          {emp?.is_driver && (
                            <span className="rounded bg-blue-500/20 px-1 py-0.5 text-[9px] text-blue-400 font-medium">D</span>
                          )}
                        </div>
                      </td>

                      {/* Hours */}
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={entry.hours_worked}
                          onChange={e => updateEntry(idx, "hours_worked", e.target.value)}
                          disabled={!entry.is_present}
                          className="h-9 bg-background font-mono text-center text-sm"
                        />
                      </td>

                      {/* Work Type */}
                      <td className="px-2 py-2">
                        <Select
                          value={entry.work_type}
                          onValueChange={v => updateEntry(idx, "work_type", v)}
                          disabled={!entry.is_present}
                        >
                          <SelectTrigger className="h-9 bg-background text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {workTypes?.map(wt => (
                              <SelectItem key={wt.id} value={wt.name}>
                                {wt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Bags */}
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min="0"
                          value={entry.bags_count}
                          onChange={e => updateEntry(idx, "bags_count", e.target.value)}
                          disabled={!entry.is_present}
                          className="h-9 bg-background font-mono text-center text-sm"
                        />
                      </td>

                      {/* Drive Hours */}
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={entry.drive_hours}
                          onChange={e => updateEntry(idx, "drive_hours", e.target.value)}
                          disabled={!entry.is_present || !emp?.is_driver}
                          className="h-9 bg-background font-mono text-center text-sm"
                          placeholder={emp?.is_driver ? "0" : "—"}
                        />
                      </td>

                      {/* Remove */}
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => removeEntry(idx)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Add Individual Employee */}
        {entries.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <Select onValueChange={v => addEmployee(v)}>
              <SelectTrigger className="h-9 w-64 bg-background text-xs">
                <SelectValue placeholder="+ Add individual employee..." />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees
                  .filter(e => !entries.some(en => en.employee_id === e.id))
                  .map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name}
                      {e.is_foreman ? " (F)" : e.is_driver ? " (D)" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-border bg-card p-4">
        <Label className="text-xs text-muted-foreground mb-1.5 block">Daily Notes</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional notes about this timesheet..."
          className="min-h-[60px] bg-background"
        />
      </div>

      {/* Summary Strip */}
      <div className="flex items-center gap-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs">
        <div>
          <span className="text-muted-foreground">Crew Present:</span>{" "}
          <span className="font-mono font-semibold text-foreground">{stats.crewCount}</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div>
          <span className="text-muted-foreground">Total Hours:</span>{" "}
          <span className="font-mono font-semibold text-foreground">{stats.totalHours.toFixed(1)}</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div>
          <span className="text-muted-foreground">Total Bags:</span>{" "}
          <span className="font-mono font-semibold text-foreground">{stats.totalBags.toLocaleString()}</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div>
          <span className="text-muted-foreground">Drive Hours:</span>{" "}
          <span className="font-mono font-semibold text-foreground">{stats.totalDrive.toFixed(1)}</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div>
          <span className="text-muted-foreground">Trees (est):</span>{" "}
          <span className="font-mono font-semibold text-primary">{(stats.totalBags * 300).toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
