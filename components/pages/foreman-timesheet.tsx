"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Camera,
  X,
  Mic,
  FileText,
  Check,
  AlertTriangle,
  Wifi,
  WifiOff,
  TreePine,
  Users,
  Clock,
  Truck as TruckIcon,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Briefcase,
  Loader2,
  CloudUpload,
  RefreshCw,
} from "lucide-react"
import { useActiveContracts, useContractUnits, useCrewSets, useCrewSetMembers, useEmployees, useWorkTypes } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useOnlineStatus } from "@/lib/offline/use-online-status"
import { enqueueSubmission, hasDuplicateInQueue, getPendingCount } from "@/lib/offline/offline-queue"
import type { TimesheetPayload } from "@/lib/offline/db"
import { CASCADIA_ID, RAMOS_ID } from "@/lib/database.types"
import { IS_DEMO_MODE, nowForDemo } from "@/lib/demo-mode"
import type { Contract as DBContract, Unit as DBUnit, CrewSet as DBCrewSet, Employee as DBEmployee } from "@/lib/database.types"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, addDays, subDays, isToday, isBefore, startOfDay } from "date-fns"
import { useApp } from "@/lib/app-context"

// ─── Types ──────────────────────────────────────────────────

interface CrewMember {
  id: string
  name: string
  present: boolean
  hours: number
  workType: string
  weeklyHours: number
  bags: number
  isDriver: boolean
  driveHours: number
  note: string
  showNote: boolean
  }

interface UnitOption {
  id: string
  name: string
  county: string
  status: "active" | "upcoming" | "complete"
}

interface WizardContract {
  id: string
  name: string
  company: "cascadia" | "ramos"
  workType: string
  location: string
  unitCount: number
  status: "active" | "upcoming" | "seasonal"
}

interface CrewSet {
  id: string
  name: string
  memberCount: number
  preview: string
  lastUsed: string
}

interface UnitTracking {
  unitId: string
  hours: number
  status: "" | "did-not-work" | "in-progress" | "completed"
  completedAt: string
  note: string
  _showError?: boolean
  _showStatusError?: boolean
}

type WizardStep = 1 | 2 | 3 | 4 | 5

// ─── Wizard Mock Data ───────────────────────────────────────

export const WIZARD_CONTRACTS: WizardContract[] = [
  { id: "vanessa", name: "Vanessa", company: "cascadia", workType: "Planting", location: "Cowlitz CO, WA", unitCount: 18, status: "active" },
  { id: "kirk", name: "Kirk", company: "cascadia", workType: "Planting", location: "Columbia CO, OR", unitCount: 12, status: "active" },
  { id: "weyerhaeuser-nwor26", name: "Weyerhaeuser NWOR26", company: "cascadia", workType: "Interplant", location: "NW Oregon", unitCount: 15, status: "upcoming" },
  { id: "vaagen-krumm", name: "Vaagen Krumm DxP", company: "ramos", workType: "Slash/PCT/HP", location: "Colville, WA", unitCount: 8, status: "active" },
]

const WIZARD_UNITS: Record<string, UnitOption[]> = {
  vanessa: [
    { id: "u1", name: "Unit 1 - Ridge", county: "Cowlitz CO", status: "active" },
    { id: "u2", name: "Unit 2 - Valley", county: "Cowlitz CO", status: "active" },
    { id: "u3", name: "Unit 3 - North", county: "Cowlitz CO", status: "active" },
    { id: "u4", name: "Unit 4 - Creek", county: "Cowlitz CO", status: "upcoming" },
    { id: "u5", name: "Unit 5 - Summit", county: "Cowlitz CO", status: "upcoming" },
    { id: "u6", name: "Unit 6 - East Slope", county: "Cowlitz CO", status: "upcoming" },
  ],
  kirk: [
    { id: "ku1", name: "Unit 1 - Silver", county: "Columbia CO", status: "active" },
    { id: "ku2", name: "Unit 2 - Timber", county: "Columbia CO", status: "active" },
    { id: "ku3", name: "Unit 3 - Oak", county: "Columbia CO", status: "upcoming" },
  ],
  "weyerhaeuser-nwor26": [
    { id: "wu1", name: "Block A - North", county: "NW Oregon", status: "upcoming" },
    { id: "wu2", name: "Block B - South", county: "NW Oregon", status: "upcoming" },
  ],
  "vaagen-krumm": [
    { id: "vu1", name: "Unit 1 - Main", county: "Stevens CO", status: "active" },
    { id: "vu2", name: "Unit 2 - West", county: "Stevens CO", status: "active" },
  ],
}

const CREW_SETS: CrewSet[] = [
  { id: "marcos-crew", name: "Marco's Planting Crew", memberCount: 14, preview: "Alvarado, Anaya, Avalos, Daniel, Jacobo...", lastUsed: "Feb 21" },
  { id: "full-crew", name: "Full Crew", memberCount: 22, preview: "All assigned employees", lastUsed: "Feb 18" },
  { id: "split-crew", name: "Split Crew (with Agustin)", memberCount: 8, preview: "Alvarado, Anaya, Avalos, Daniel...", lastUsed: "Feb 14" },
]

// ─── Form Mock Data ─────────────────────────────────────────

  const INITIAL_CREW: CrewMember[] = [
  { id: "1", name: "Alvarado Valdovinos, Marco Antonio", present: true, hours: 6, workType: "Planting", weeklyHours: 42, bags: 5, isDriver: true, driveHours: 4, note: "", showNote: false },
  { id: "2", name: "Anaya Alvarez, Ricardo", present: true, hours: 6, workType: "Planting", weeklyHours: 36, bags: 5, isDriver: false, driveHours: 0, note: "", showNote: false },
  { id: "3", name: "Avalos Lopez, Ramiro", present: true, hours: 6, workType: "Planting", weeklyHours: 38, bags: 6, isDriver: false, driveHours: 0, note: "", showNote: false },
  { id: "4", name: "Daniel Salas, Alex Javier", present: false, hours: 0, workType: "Planting", weeklyHours: 32, bags: 0, isDriver: false, driveHours: 0, note: "Sick \u2014 called in", showNote: true },
  { id: "5", name: "Jacobo Pelagio, Alfredo", present: true, hours: 6, workType: "Foreman", weeklyHours: 44, bags: 0, isDriver: false, driveHours: 0, note: "", showNote: false },
  { id: "6", name: "Lopez Lopez, Pedro", present: true, hours: 6, workType: "Planting", weeklyHours: 37, bags: 4, isDriver: false, driveHours: 0, note: "", showNote: false },
  { id: "7", name: "Maya Tovar, Antonio", present: true, hours: 6, workType: "Planting", weeklyHours: 39, bags: 4, isDriver: true, driveHours: 4, note: "", showNote: false },
  { id: "8", name: "Montalva Medrano, Cesar", present: true, hours: 6, workType: "Planting", weeklyHours: 35, bags: 5, isDriver: false, driveHours: 0, note: "", showNote: false },
  { id: "9", name: "Munoz Rojo, Oscar", present: true, hours: 6, workType: "Planting", weeklyHours: 34, bags: 3, isDriver: false, driveHours: 0, note: "", showNote: false },
  { id: "10", name: "Ordonez Ordonez, Benigno", present: true, hours: 6, workType: "Foreman", weeklyHours: 36, bags: 6, isDriver: true, driveHours: 4, note: "", showNote: false },
  { id: "11", name: "Ortiz Acosta, Bryan Arturo", present: true, hours: 6, workType: "Planting", weeklyHours: 33, bags: 4, isDriver: false, driveHours: 0, note: "", showNote: false },
  { id: "12", name: "Pelayo Cibrian, Jose Angel", present: false, hours: 0, workType: "Packer", weeklyHours: 30, bags: 0, isDriver: false, driveHours: 0, note: "", showNote: false },
  { id: "13", name: "Perez Ugalde, Erik Benito", present: true, hours: 6, workType: "Planting", weeklyHours: 37, bags: 5, isDriver: false, driveHours: 0, note: "", showNote: false },
  { id: "14", name: "Trujillo Perez, Oscar", present: true, hours: 6, workType: "Packer", weeklyHours: 38, bags: 0, isDriver: false, driveHours: 0, note: "", showNote: false },
  ]

const WORK_TYPES = [
  "Planting",
  "Packer",
  "Foreman",
  "Thinning",
  "Hand Piling",
  "PCT",
  "Spray",
  "Pruning",
  "Burning",
  "Bucking",
  "Logging",
  "General",
]

// ─── Step Progress Bar ──────────────────────────────────────

const STEP_LABELS = [
  { num: 1, label: "Contract" },
  { num: 2, label: "Units" },
  { num: 3, label: "Crew" },
  { num: 4, label: "Timesheet" },
  { num: 5, label: "Unit Review" },
]

function StepProgressBar({
  currentStep,
  onStepClick,
  breadcrumb,
}: {
  currentStep: WizardStep
  onStepClick: (step: WizardStep) => void
  breadcrumb: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((s, i) => {
          const isComplete = s.num < currentStep
          const isCurrent = s.num === currentStep
          const isFuture = s.num > currentStep
          const canClick = isComplete

          return (
            <div key={s.num} className="flex flex-1 items-center">
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onStepClick(s.num as WizardStep)}
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                  isComplete
                    ? "cursor-pointer text-primary hover:bg-primary/10"
                    : isCurrent
                      ? "text-foreground"
                      : "cursor-default text-muted-foreground/50"
                }`}
                style={{ minHeight: "32px" }}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    isComplete
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-2 border-primary text-primary"
                        : "border border-border text-muted-foreground/50"
                  }`}
                >
                  {isComplete ? <Check className="h-3 w-3" /> : s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`mx-0.5 h-px flex-1 transition-colors ${
                    s.num < currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
      {breadcrumb && (
        <p className="text-xs text-muted-foreground">{breadcrumb}</p>
      )}
    </div>
  )
}

// ─── Step 1: Select Contract ────────────────────────────────

function StepSelectContract({
  selected,
  onSelect,
  onNext,
  contracts,
  loading,
}: {
  selected: string | null
  onSelect: (id: string) => void
  onNext: () => void
  contracts: DBContract[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading contracts...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Select Contract</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Which contract is your crew working today?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {contracts.map((c) => {
          const isSelected = selected === c.id
          const isCascadia = c.company_id === CASCADIA_ID

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={`group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-primary/60 bg-primary/5 shadow-[0_0_16px_rgba(34,197,94,0.15)]"
                  : "border-border bg-[#172030] hover:border-border hover:bg-[#1a2538]"
              }`}
              style={{ minHeight: "120px" }}
            >
              {isSelected && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              <div className="flex items-start gap-2">
                <TreePine className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <div className="text-base font-bold text-foreground">{c.name}</div>
                  <span
                    className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      isCascadia ? "bg-primary/20 text-primary" : "bg-info/20 text-info"
                    }`}
                  >
                    {isCascadia ? "Cascadia" : "Ramos"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Briefcase className="h-3 w-3" />
                  {c.work_types?.join(', ') || 'N/A'}
                </div>
                {c.location && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {c.location}
                  </div>
                )}
                {c.landowner && (
                  <div className="text-[10px] text-muted-foreground">{c.landowner}</div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground capitalize">
                  {c.status}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Active
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {contracts.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">No active contracts found</div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!selected}
          onClick={onNext}
          className={`flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all ${
            selected
              ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(34,197,94,0.3)] hover:bg-primary/90"
              : "cursor-not-allowed bg-border text-muted-foreground"
          }`}
        >
          {"Next: Select Units"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Select Unit(s) ─────────────────────────────────

function StepSelectUnits({
  contract,
  units,
  unitsLoading,
  selected,
  onToggle,
  onBack,
  onNext,
}: {
  contract: DBContract
  units: DBUnit[]
  unitsLoading: boolean
  selected: string[]
  onToggle: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const isCascadia = contract.company_id === CASCADIA_ID
  // Show units that aren't completed
  const availableUnits = units.filter(u => u.status !== 'completed')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Select Unit(s)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {contract.name} {" \u2022 "}{" "}
          {isCascadia ? "Cascadia" : "Ramos"} {" \u2022 "}{" "}
          {contract.work_types?.join(', ') || 'N/A'}
        </p>
      </div>

      {unitsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading units...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {availableUnits.map((unit) => {
            const isSelected = selected.includes(unit.id)
            const statusColor =
              unit.status === "in_progress"
                ? "bg-info"
                : unit.status === "not_started"
                  ? "bg-muted-foreground"
                  : "bg-primary"
            const statusLabel =
              unit.status === "in_progress"
                ? "In Progress"
                : unit.status === "not_started"
                  ? "Not Started"
                  : unit.status.replace('_', ' ')

            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => onToggle(unit.id)}
                className={`group relative flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                  isSelected
                    ? "border-primary/60 bg-primary/5 shadow-[0_0_12px_rgba(34,197,94,0.1)]"
                    : "border-border bg-[#172030] hover:border-border hover:bg-[#1a2538]"
                }`}
                style={{ minHeight: "64px" }}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-border bg-elevated"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>

                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`} />
                    <span className="text-sm font-medium text-foreground">{unit.name}</span>
                  </div>
                  {unit.amount != null && (
                    <span className="ml-4 text-[10px] text-muted-foreground">
                      {unit.amount.toLocaleString()} {unit.amount_type === 'acre' ? 'acres' : unit.amount_type === 'tree' ? 'trees' : unit.amount_type || ''}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0 max-w-[70px]">
                  {unit.county && (
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning truncate max-w-full">
                      {unit.county}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground capitalize whitespace-nowrap">
                    {statusLabel}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {!unitsLoading && units.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-warning/40 bg-warning/5 px-4 py-10 text-center">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div className="text-sm text-foreground">No units available for this contract yet.</div>
          <div className="text-xs text-muted-foreground">Contact your administrator to add units.</div>
        </div>
      )}

      {!unitsLoading && units.length > 0 && availableUnits.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          All units for this contract are completed
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Tap to select unit(s) your crew worked today {" \u2022 "}{" "}
        <span className="font-semibold text-foreground">
          {selected.length} unit(s) selected
        </span>
      </p>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex h-12 items-center gap-2 rounded-lg border border-border px-5 text-sm font-medium text-muted-foreground hover:bg-elevated transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={onNext}
          className={`flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all ${
            selected.length > 0
              ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(34,197,94,0.3)] hover:bg-primary/90"
              : "cursor-not-allowed bg-border text-muted-foreground"
          }`}
        >
          {"Next: Select Crew"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Select Crew Set ────────────────────────────────

function StepSelectCrew({
  selected,
  onSelect,
  onBack,
  onNext,
  crewSets,
  crewSetsLoading,
}: {
  selected: string | null
  onSelect: (id: string) => void
  onBack: () => void
  onNext: () => void
  crewSets: DBCrewSet[]
  crewSetsLoading: boolean
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Select Crew</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a pre-built crew set or start fresh
        </p>
      </div>

      {crewSetsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading crew sets...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {crewSets.map((cs) => {
            const isSelected = selected === cs.id
            return (
              <button
                key={cs.id}
                type="button"
                onClick={() => onSelect(cs.id)}
                className={`group relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-primary/60 bg-primary/5 shadow-[0_0_16px_rgba(34,197,94,0.15)]"
                    : "border-border bg-[#172030] hover:border-border hover:bg-[#1a2538]"
                }`}
                style={{ minHeight: "80px" }}
              >
                {isSelected && (
                  <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Users className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-bold text-foreground">
                    {cs.name}
                  </span>
                  {cs.is_default && (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">Default</span>
                  )}
                </div>

                {cs.last_used_at && (
                  <p className="text-[11px] text-muted-foreground/70">
                    Last used: {new Date(cs.last_used_at).toLocaleDateString()}
                  </p>
                )}
              </button>
            )
          })}

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => onSelect("all-available")}
            className={`flex items-center gap-3 rounded-xl border-2 border-dashed p-4 text-left transition-all ${
              selected === "all-available"
                ? "border-primary/60 bg-primary/5"
                : "border-border hover:border-primary/30 hover:bg-[#172030]"
            }`}
            style={{ minHeight: "64px" }}
          >
            <Users className={`h-5 w-5 ${selected === "all-available" ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <div className="text-sm font-medium text-foreground">
                Start with all available crew
              </div>
              <div className="text-xs text-muted-foreground">
                Load the full employee roster for this contract
              </div>
            </div>
            {selected === "all-available" && (
              <div className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
          </button>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex h-12 items-center gap-2 rounded-lg border border-border px-5 text-sm font-medium text-muted-foreground hover:bg-elevated transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={onNext}
          className={`flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all ${
            selected
              ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(34,197,94,0.3)] hover:bg-primary/90"
              : "cursor-not-allowed bg-border text-muted-foreground"
          }`}
        >
          {"Start Timesheet"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Form Sub-Components (unchanged) ────────────────────────

function OTStatusPanels({ crew }: { crew: CrewMember[] }) {
  const [alertOpen, setAlertOpen] = useState(false)
  const [watchOpen, setWatchOpen] = useState(false)

  const otAlert = crew.filter((c) => c.present && c.weeklyHours > 40)
  const otWatch = crew.filter(
    (c) => c.present && c.weeklyHours >= 35 && c.weeklyHours <= 40
  )

  if (otAlert.length === 0 && otWatch.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <Check className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">
          No OT concerns
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {otAlert.length > 0 && (
        <Collapsible open={alertOpen} onOpenChange={setAlertOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-destructive/15 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold text-destructive">
                OT ALERT
              </span>
              <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-bold text-destructive">
                {otAlert.length}
              </span>
            </div>
            {alertOpen ? (
              <ChevronUp className="h-4 w-4 text-destructive" />
            ) : (
              <ChevronDown className="h-4 w-4 text-destructive" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 rounded-b-lg border border-t-0 border-destructive/20 bg-destructive/5 px-4 py-2">
              {otAlert.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="text-foreground">{c.name}</span>
                  <span className="font-mono text-xs text-destructive">
                    {c.weeklyHours}h/wk
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {otWatch.length > 0 && (
        <Collapsible open={watchOpen} onOpenChange={setWatchOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-warning/15 px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold text-warning">
                OT WATCH
              </span>
              <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-bold text-warning">
                {otWatch.length}
              </span>
            </div>
            {watchOpen ? (
              <ChevronUp className="h-4 w-4 text-warning" />
            ) : (
              <ChevronDown className="h-4 w-4 text-warning" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 rounded-b-lg border border-t-0 border-warning/20 bg-warning/5 px-4 py-2">
              {otWatch.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="text-foreground">{c.name}</span>
                  <span className="font-mono text-xs text-warning">
                    {c.weeklyHours}h/wk
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function FormUnitSelector({
  units,
  selected,
  onToggle,
}: {
  units: UnitOption[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Units
      </label>
      <div className="flex flex-wrap gap-2">
        {units.map((unit) => {
          const isSelected = selected.includes(unit.id)
          return (
            <button
              key={unit.id}
              type="button"
              onClick={() => onToggle(unit.id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                isSelected
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-elevated text-muted-foreground hover:border-border hover:bg-card"
              }`}
              style={{ minHeight: "48px" }}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  unit.status === "active" ? "bg-primary" : "bg-info"
                }`}
              />
              <span className="font-medium">{unit.name}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {unit.county}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length} unit(s) selected {"\u00B7"} Tap to toggle {"\u00B7"}{" "}
        County auto-resolves min wage
      </p>
    </div>
  )
}

function CollapsibleUnitSelector({
  units,
  selected,
  onToggle,
}: {
  units: UnitOption[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            UNITS
          </span>
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
            {selected.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-b-lg border border-t-0 border-border bg-card/50 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {units.map((unit) => {
              const isSelected = selected.includes(unit.id)
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => onToggle(unit.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                    isSelected
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-elevated text-muted-foreground hover:border-border hover:bg-card"
                  }`}
                  style={{ minHeight: "48px" }}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      unit.status === "active" ? "bg-primary" : "bg-info"
                    }`}
                  />
                  <span className="font-medium">{unit.name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {unit.county}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {selected.length} unit(s) selected {"\u00B7"} Tap to toggle
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ShiftTimesSection({
  times,
  onTimeChange,
  calcHours,
  onApplyAll,
}: {
  times: { start: string; lunchOut: string; lunchIn: string; end: string }
  onTimeChange: (field: string, value: string) => void
  calcHours: number
  onApplyAll: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Shift Times
      </label>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Start", field: "start", value: times.start },
          { label: "Lunch Out", field: "lunchOut", value: times.lunchOut },
          { label: "Lunch In", field: "lunchIn", value: times.lunchIn },
          { label: "End", field: "end", value: times.end },
        ].map((t) => (
          <div key={t.field}>
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.label}
            </span>
            <input
              type="time"
              value={t.value}
              onChange={(e) => onTimeChange(t.field, e.target.value)}
              onClick={(e) => {
                e.currentTarget.focus()
              }}
              className="h-12 w-full cursor-pointer rounded-lg border border-border bg-elevated px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
              style={{ minHeight: "48px" }}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onApplyAll}
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary/15 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
      >
        <Clock className="h-4 w-4" />
        {"Calc: "}{calcHours}{"h \u2014 Apply to all"}
      </button>
    </div>
  )
}

function CrewMemberCard({
  member,
  showDriveHrs,
  workTypeOptions,
  onTogglePresent,
  onHoursChange,
  onWorkTypeChange,
  onBagsChange,
  onDriveHoursChange,
  onToggleNote,
  onNoteChange,
}: {
  member: CrewMember
  showDriveHrs?: boolean
  workTypeOptions: string[]
  onTogglePresent: () => void
  onHoursChange: (hours: number) => void
  onWorkTypeChange: (type: string) => void
  onBagsChange: (bags: number) => void
  onDriveHoursChange?: (hours: number) => void
  onToggleNote: () => void
  onNoteChange: (note: string) => void
}) {
  const weeklyColor =
    member.weeklyHours > 40
      ? "text-destructive"
      : member.weeklyHours >= 35
        ? "text-warning"
        : "text-primary"

  return (
    <div
      className={`rounded-lg border transition-all ${
        member.present
          ? "border-border bg-card"
          : "border-border/50 bg-card/40 opacity-60"
      }`}
    >
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ minHeight: "48px" }}
      >
        <Checkbox
          checked={member.present}
          onCheckedChange={onTogglePresent}
          className="h-5 w-5 shrink-0"
        />
        <span
          className={`flex-1 min-w-0 truncate text-sm font-medium ${
            member.present ? "text-foreground" : "text-muted-foreground line-through"
          }`}
        >
          {member.name}
        </span>
        {member.present && (
          <span className={`shrink-0 font-mono text-xs ${weeklyColor}`}>
            {member.weeklyHours}h wk
            {member.weeklyHours > 40 && (
              <span className="ml-1 rounded bg-destructive/20 px-1 py-0.5 text-[10px] font-bold text-destructive">
                OT
              </span>
            )}
          </span>
        )}
      </div>

      {member.present && (
        <div className="border-t border-border/50 px-4 py-3">
          <div className={`grid gap-2 ${showDriveHrs ? "grid-cols-2 sm:grid-cols-[1fr_1.5fr_1.2fr_1fr]" : "grid-cols-[1fr_1fr] sm:grid-cols-[1fr_1.8fr_1.2fr]"}`}>
            {/* Hours ~25% */}
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                Hours
              </label>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                step="0.5"
                min="0"
                max="24"
                value={member.hours || ""}
                onChange={(e) =>
                  onHoursChange(parseFloat(e.target.value) || 0)
                }
                className="h-12 w-full rounded-lg border border-border bg-elevated px-2 text-center font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                style={{ minHeight: "48px" }}
              />
            </div>
            {/* Work Type ~45% */}
            <div className={showDriveHrs ? "" : "col-span-2 sm:col-span-1"}>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                Work Type
              </label>
              <Select
                value={member.workType}
                onValueChange={onWorkTypeChange}
              >
                <SelectTrigger className="h-12 w-full rounded-lg border-border bg-elevated text-sm text-foreground [&>svg]:text-muted-foreground" style={{ minHeight: "48px" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workTypeOptions.map((wt) => (
                    <SelectItem key={wt} value={wt}>
                      {wt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Bags ~30% */}
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                Bags
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                value={member.bags ?? ""}
                onChange={(e) =>
                  onBagsChange(parseInt(e.target.value) || 0)
                }
                className="h-12 w-full rounded-lg border border-border bg-elevated px-2 text-center font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                style={{ minHeight: "48px" }}
                placeholder="0"
              />
            </div>
            {/* Drive Hrs - drivers only */}
            {showDriveHrs && (
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                  Drive Hrs
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  step="0.5"
                  min="0"
                  max="24"
                  value={member.driveHours || ""}
                  onChange={(e) =>
                    onDriveHoursChange?.(parseFloat(e.target.value) || 0)
                  }
                  className="h-12 w-full rounded-lg border border-border bg-elevated px-2 text-center font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                  style={{ minHeight: "48px" }}
                  placeholder="0"
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleNote}
            className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            style={{ minHeight: "36px" }}
          >
            <FileText className="h-3.5 w-3.5" />
            {member.showNote ? "Hide note" : "Add Note"}
          </button>
          {member.showNote && (
            <textarea
              value={member.note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Sick, injured, left early..."
              className="mt-2 w-full rounded-lg border border-border bg-elevated px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
              rows={2}
              style={{ minHeight: "48px" }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function DriveTimeCalculator({
  driveTimes,
  onDriveTimeChange,
  onApplyAll,
  calcDriveHours,
  driverCount,
}: {
  driveTimes: { morningStart: string; morningEnd: string; eveningStart: string; eveningEnd: string }
  onDriveTimeChange: (field: string, value: string) => void
  onApplyAll: () => void
  calcDriveHours: number
  driverCount: number
}) {
  if (driverCount === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {"Drive Time (applies to all drivers)"}
        </span>
      </div>
      <div className="border-t border-border/50 px-4 py-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Morning</span>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[10px] text-muted-foreground">Start</label>
                <input
                  type="time"
                  value={driveTimes.morningStart}
                  onChange={(e) => onDriveTimeChange("morningStart", e.target.value)}
                  onClick={(e) => {
                    // Let native picker open naturally — showPicker() breaks iOS Safari
                    e.currentTarget.focus()
                  }}
                  className="h-12 w-full cursor-pointer rounded-lg border border-border bg-elevated px-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                  style={{ minHeight: "48px" }}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[10px] text-muted-foreground">End</label>
                <input
                  type="time"
                  value={driveTimes.morningEnd}
                  onChange={(e) => onDriveTimeChange("morningEnd", e.target.value)}
                  onClick={(e) => {
                    // Let native picker open naturally — showPicker() breaks iOS Safari
                    e.currentTarget.focus()
                  }}
                  className="h-12 w-full cursor-pointer rounded-lg border border-border bg-elevated px-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                  style={{ minHeight: "48px" }}
                />
              </div>
            </div>
          </div>
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Evening</span>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[10px] text-muted-foreground">Start</label>
                <input
                  type="time"
                  value={driveTimes.eveningStart}
                  onChange={(e) => onDriveTimeChange("eveningStart", e.target.value)}
                  onClick={(e) => {
                    // Let native picker open naturally — showPicker() breaks iOS Safari
                    e.currentTarget.focus()
                  }}
                  className="h-12 w-full cursor-pointer rounded-lg border border-border bg-elevated px-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                  style={{ minHeight: "48px" }}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[10px] text-muted-foreground">End</label>
                <input
                  type="time"
                  value={driveTimes.eveningEnd}
                  onChange={(e) => onDriveTimeChange("eveningEnd", e.target.value)}
                  onClick={(e) => {
                    // Let native picker open naturally — showPicker() breaks iOS Safari
                    e.currentTarget.focus()
                  }}
                  className="h-12 w-full cursor-pointer rounded-lg border border-border bg-elevated px-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                  style={{ minHeight: "48px" }}
                />
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onApplyAll}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary/15 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
          style={{ minHeight: "48px" }}
        >
          <Clock className="h-4 w-4" />
          {"Calc: "}{calcDriveHours}{"h \u2014 Apply to all drivers"}
        </button>
      </div>
    </div>
  )
}

function ProductionSection({
  value,
  onChange,
  isEstimate,
  onToggleEstimate,
  totalBags,
  treesPerBag,
  isManualOverride,
  onToggleManual,
}: {
  value: number
  onChange: (val: number) => void
  isEstimate: boolean
  onToggleEstimate: () => void
  totalBags: number
  treesPerBag: number
  isManualOverride: boolean
  onToggleManual: () => void
}) {
  const calculatedTrees = totalBags * treesPerBag
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Production
      </label>
      <div className="rounded-lg border border-border bg-card p-4">
        {/* Show bags calculation */}
        {totalBags > 0 && !isManualOverride && (
          <p className="mb-2 text-center text-xs text-muted-foreground">
            {totalBags} bags &times; {treesPerBag} = <span className="font-mono font-semibold text-primary">{calculatedTrees.toLocaleString()}</span> trees
          </p>
        )}
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value || ""}
          onChange={(e) => {
            onChange(parseInt(e.target.value) || 0)
            if (!isManualOverride) onToggleManual()
          }}
          className="w-full border-0 bg-transparent text-center font-mono text-3xl font-bold text-primary outline-none placeholder:text-muted-foreground/30"
          placeholder="0"
          style={{ minHeight: "48px" }}
        />
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Trees planted today
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onToggleEstimate}
            className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-elevated transition-colors"
            style={{ minHeight: "36px" }}
          >
            {isEstimate ? (
              <ToggleRight className="h-4 w-4 text-warning" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            {isEstimate ? "Estimate" : "Actual count"}
          </button>
          {isManualOverride && totalBags > 0 && (
            <button
              type="button"
              onClick={onToggleManual}
              className="flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors"
              style={{ minHeight: "36px" }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Use bags calc
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PhotoSection({
  photos,
  onAdd,
  onRemove,
}: {
  photos: string[]
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Photos / Attachments
      </label>
      <button
        type="button"
        onClick={onAdd}
        className="flex h-20 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
      >
        <Camera className="h-5 w-5" />
        Tap to upload photos
      </button>
      <p className="text-xs text-muted-foreground">
        Site conditions, injuries, equipment issues
      </p>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div
              key={i}
              className="relative h-16 w-16 rounded-lg bg-elevated"
            >
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                IMG
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NotesSection({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Daily Notes (optional)
      </label>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Daily notes, conditions, issues..."
          className="w-full rounded-lg border border-border bg-elevated px-3 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
          rows={3}
          style={{ minHeight: "48px" }}
        />
        <button
          type="button"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          title="Voice-to-text"
        >
          <Mic className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Tap mic to speak in English or Spanish
      </p>
    </div>
  )
}

function SummaryBar({ crew, production }: { crew: CrewMember[]; production: number }) {
  const present = crew.filter((c) => c.present)
  const totalHours = present.reduce((s, c) => s + c.hours, 0)
  const totalDrive = present
    .filter((c) => c.isDriver)
    .reduce((s, c) => s + c.driveHours, 0)
  const totalBags = present.reduce((s, c) => s + (c.bags || 0), 0)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs">
      <div className="flex items-center gap-1">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono font-semibold text-foreground">
          {present.length}
        </span>
      </div>
      <div className="hidden sm:block h-3 w-px bg-border" />
      <div className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono font-semibold text-foreground">
          {totalHours}h
        </span>
      </div>
      <div className="hidden sm:block h-3 w-px bg-border" />
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Bags</span>
        <span className="font-mono font-semibold text-foreground">
          {totalBags}
        </span>
      </div>
      <div className="hidden sm:block h-3 w-px bg-border" />
      <div className="flex items-center gap-1">
        <TruckIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono font-semibold text-foreground">
          {totalDrive}h
        </span>
      </div>
      <div className="hidden sm:block h-3 w-px bg-border" />
      <div className="flex items-center gap-1">
        <TreePine className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono font-semibold text-primary">
          {production.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

// ─── Unit Review Screen (Part 2) ────────────────────────────

function UnitReviewScreen({
  units,
  notes,
  onNotesChange,
  photos,
  onAddPhoto,
  onRemovePhoto,
  unitReviewError,
  onUpdateUnit,
  onBack,
  onNext,
  breadcrumb,
}: {
  units: (UnitOption & { tracking: UnitTracking })[]
  notes: string
  onNotesChange: (val: string) => void
  photos: string[]
  onAddPhoto: () => void
  onRemovePhoto: (index: number) => void
  unitReviewError: string
  onUpdateUnit: (unitId: string, updates: Partial<UnitTracking>) => void
  onBack: () => void
  onNext: () => void
  breadcrumb: string
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">Unit Review & Notes</h2>
        <p className="mt-1 text-xs text-muted-foreground">{breadcrumb}</p>
      </div>

      {/* Section A: Unit Hours & Completion Status */}
      <div className="flex flex-col gap-3">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Unit Hours & Status
        </label>

        {units.map((unit) => {
          const ut = unit.tracking
          return (
            <div
              key={unit.id}
              className="rounded-xl border border-border bg-card"
            >
              {/* Unit header */}
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      unit.status === "active" ? "bg-primary" : "bg-info"
                    }`}
                  />
                  <span className="text-sm font-bold text-foreground">
                    {unit.name}
                  </span>
                </div>
                <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                  {unit.county}
                </span>
              </div>

              <div className="flex flex-col gap-4 px-4 py-4">
                {/* Status radio buttons */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {"What happened on this unit today?"}
                    {ut._showStatusError && (
                      <span className="text-[10px] font-medium text-destructive">— Required</span>
                    )}
                  </label>
                  <div className={`flex flex-wrap gap-2 ${ut._showStatusError ? 'rounded-lg ring-1 ring-destructive/50 p-1' : ''}`}>
                    {(
                      [
                        { value: "did-not-work" as const, label: "Not Worked" },
                        { value: "in-progress" as const, label: "In Progress" },
                        { value: "completed" as const, label: "Completed" },
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          onUpdateUnit(unit.id, {
                            status: opt.value,
                            _showStatusError: false,
                            ...(opt.value === "did-not-work" ? { hours: 0, completedAt: "" } : {}),
                            ...(opt.value === "in-progress" ? { completedAt: "" } : {}),
                          })
                        }
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                          ut.status === opt.value
                            ? opt.value === "completed"
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : opt.value === "in-progress"
                                ? "border-info/50 bg-info/10 text-info"
                                : "border-border bg-muted text-muted-foreground"
                            : "border-border bg-elevated text-muted-foreground hover:border-border hover:bg-card"
                        }`}
                        style={{ minHeight: "48px" }}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                            ut.status === opt.value
                              ? opt.value === "completed"
                                ? "border-primary bg-primary"
                                : opt.value === "in-progress"
                                  ? "border-info bg-info"
                                  : "border-muted-foreground bg-muted-foreground"
                              : "border-border"
                          }`}
                        >
                          {ut.status === opt.value && (
                            <span className="h-1.5 w-1.5 rounded-full bg-card" />
                          )}
                        </span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hours input */}
                <div>
                  <label className={`mb-1.5 block text-xs ${ut.status === "did-not-work" || ut.status === "" ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                    Hours Worked on This Unit
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    step="0.5"
                    min="0"
                    max="24"
                    disabled={ut.status === "did-not-work" || ut.status === ""}
                    value={ut.status === "did-not-work" || ut.status === "" ? 0 : (ut.hours || "")}
                    onChange={(e) =>
                      onUpdateUnit(unit.id, {
                        hours: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={`h-12 w-28 rounded-lg border px-3 text-center font-mono text-lg font-bold focus:outline-none ${
                      ut.status === "did-not-work" || ut.status === ""
                        ? "border-border/50 bg-muted text-muted-foreground/40 cursor-not-allowed"
                        : "border-border bg-elevated text-foreground focus:border-primary focus:ring-1 focus:ring-primary/50"
                    }`}
                    style={{ minHeight: "48px" }}
                    placeholder="0"
                  />
                  {ut.status !== "did-not-work" && ut.hours <= 0 && ut._showError && (
                    <p className="mt-1.5 text-xs font-medium text-destructive">
                      {"Enter hours worked on this unit"}
                    </p>
                  )}
                </div>

                {/* Completed at time picker - only when status is "completed" */}
                {ut.status === "completed" && (
                  <div>
                    <label className="mb-1.5 block text-xs text-muted-foreground">
                      Completed at
                    </label>
                    <input
                      type="time"
                      value={ut.completedAt}
                      onChange={(e) =>
                        onUpdateUnit(unit.id, { completedAt: e.target.value })
                      }
                      onClick={(e) => {
                        e.currentTarget.focus()
                      }}
                      className="h-12 w-full max-w-[10rem] cursor-pointer rounded-lg border border-border bg-elevated px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                      style={{ minHeight: "48px" }}
                    />
                  </div>
                )}

                {/* Per-unit note */}
                <div>
                  <label className="mb-1.5 block text-xs text-muted-foreground">
                    Unit Note (optional)
                  </label>
                  <textarea
                    value={ut.note}
                    onChange={(e) =>
                      onUpdateUnit(unit.id, { note: e.target.value })
                    }
                    placeholder="Snow stopped us, finished early, moved to next unit..."
                    className="w-full rounded-lg border border-border bg-elevated px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                    rows={2}
                    style={{ minHeight: "48px" }}
                  />
                </div>
              </div>
            </div>
          )
        })}

      </div>

      {/* Section B: General Notes */}
      <NotesSection value={notes} onChange={onNotesChange} />

      {/* Section C: Photos / Attachments */}
      <PhotoSection
        photos={photos}
        onAdd={onAddPhoto}
        onRemove={onRemovePhoto}
      />

      {/* Validation error */}
      {unitReviewError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {unitReviewError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-elevated transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {"Back to Timesheet"}
        </button>
        {(() => {
          const allValid = units.every(u => {
            const ut = u.tracking
            if (!ut.status) return false
            if (ut.status !== "did-not-work" && ut.hours <= 0) return false
            return true
          })
          return (
            <button
              type="button"
              onClick={onNext}
              disabled={!allValid}
              className={`flex h-12 flex-[2] items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${
                allValid
                  ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(34,197,94,0.3)] hover:bg-primary/90"
                  : "bg-border text-muted-foreground cursor-not-allowed"
              }`}
            >
              {"Review & Submit"}
              <ChevronRight className="h-4 w-4" />
            </button>
          )
        })()}
      </div>
    </div>
  )
}

// ─── Review Screen ───────────────────────────────────────────

function ReviewScreen({
  date,
  crew,
  production,
  notes,
  contractName,
  companyName,
  unitTracking,
  wizardUnits,
  photos,
  onBack,
  onSubmit,
  submitting,
  submitError,
  isOnline = true,
}: {
  date: Date
  crew: CrewMember[]
  production: number
  notes: string
  contractName: string
  companyName: string
  unitTracking: UnitTracking[]
  wizardUnits: UnitOption[]
  photos: string[]
  onBack: () => void
  onSubmit: () => void
  submitting?: boolean
  submitError?: string | null
  isOnline?: boolean
}) {
  const present = crew.filter((c) => c.present)
  const totalHours = present.reduce((s, c) => s + c.hours, 0)
  const totalDrive = present
    .filter((c) => c.isDriver)
    .reduce((s, c) => s + c.driveHours, 0)
  const totalBags = present.reduce((s, c) => s + (c.bags || 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Review & Submit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(date, "EEEE, MMM d, yyyy")} {"\u00B7"} {contractName} {"\u00B7"}{" "}
          {companyName}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Crew</div>
          <div className="mt-1 font-mono text-xl font-bold text-foreground">
            {present.length}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Hours</div>
          <div className="mt-1 font-mono text-xl font-bold text-foreground">
            {totalHours}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Drive</div>
          <div className="mt-1 font-mono text-xl font-bold text-foreground">
            {totalDrive}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Bags</div>
          <div className="mt-1 font-mono text-xl font-bold text-foreground">
            {totalBags}
          </div>
        </div>
        <div className="col-span-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="text-xs text-muted-foreground">Trees Planted</div>
          <div className="mt-1 font-mono text-xl font-bold text-primary">
            {production.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Unit Summary */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Units Worked
          </span>
        </div>
        <div className="divide-y divide-border/50">
          {unitTracking.map((ut) => {
            const unit = wizardUnits.find((u) => u.id === ut.unitId)
            if (!unit) return null
            const statusLabel =
              ut.status === "completed"
                ? "Completed"
                : ut.status === "in-progress"
                  ? "In Progress"
                  : "Not Worked"
            const statusIcon =
              ut.status === "completed"
                ? "\u2713"
                : ut.status === "in-progress"
                  ? "\u25CC"
                  : "\u2014"
            const completedAtFormatted =
              ut.status === "completed" && ut.completedAt
                ? (() => {
                    const [h, m] = ut.completedAt.split(":").map(Number)
                    const ampm = h >= 12 ? "PM" : "AM"
                    const h12 = h % 12 || 12
                    return `at ${h12}:${m.toString().padStart(2, "0")} ${ampm}`
                  })()
                : ""

            return (
              <div key={ut.unitId} className="flex flex-col gap-1 px-4 py-2.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-foreground truncate min-w-0">{unit.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-foreground">{ut.hours}h</span>
                    <span className={`text-[10px] whitespace-nowrap ${
                      ut.status === "completed" ? "text-primary" : ut.status === "in-progress" ? "text-info" : "text-muted-foreground"
                    }`}>
                      {statusIcon} {statusLabel}
                    </span>
                  </div>
                </div>
                {ut.note && (
                  <p className="text-xs text-muted-foreground">{ut.note}</p>
                )}
              </div>
            )
          })}
        </div>
        <div className="border-t border-border px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Total: {unitTracking.reduce((s, ut) => s + ut.hours, 0)}h across {unitTracking.length} unit{unitTracking.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Crew Summary
          </span>
        </div>
        <div className="divide-y divide-border/50">
          {present.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
  <span className="flex-1 min-w-0 truncate text-foreground">{c.name}</span>
  <div className="flex shrink-0 items-center gap-2">
  <span className="font-mono text-xs text-foreground">
  {c.hours}h
  </span>
  <span className="text-[10px] text-muted-foreground max-w-[50px] truncate">
  {c.workType}
  </span>
  {c.bags > 0 && (
  <span className="font-mono text-xs text-muted-foreground">
  {c.bags}b
  </span>
  )}
  {c.isDriver && c.driveHours > 0 && (
  <span className="font-mono text-xs text-info">
  {c.driveHours}d
  </span>
  )}
  {c.weeklyHours > 40 && (
  <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
  OT
  </span>
  )}
  {c.note && (
  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
  )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {notes && (
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Notes
          </div>
          <p className="text-sm text-foreground">{notes}</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Photos
          </div>
          <p className="text-sm text-muted-foreground">
            {photos.length} photo{photos.length !== 1 ? "s" : ""} attached
          </p>
        </div>
      )}

      {submitError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-elevated transition-colors disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[0_0_16px_rgba(34,197,94,0.3)] hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              {isOnline ? <Check className="h-4 w-4" /> : <CloudUpload className="h-4 w-4" />}
              {isOnline ? 'Confirm & Submit' : 'Save for Sync'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Success Screen ──────────────────────────────────────────

function SuccessScreen({ onDone, isQueued, pendingCount }: { onDone: () => void; isQueued?: boolean; pendingCount?: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isQueued ? 'bg-warning/20' : 'bg-primary/20'}`}>
        {isQueued ? (
          <CloudUpload className="h-8 w-8 text-warning" />
        ) : (
          <Check className="h-8 w-8 text-primary" />
        )}
      </div>
      <h2 className="text-xl font-bold text-foreground">
        {isQueued ? 'Saved for Sync' : 'Submitted'}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isQueued
          ? `Timesheet saved! It will sync automatically when you're back online.${pendingCount && pendingCount > 1 ? ` (${pendingCount} pending)` : ''}`
          : 'Timesheet has been submitted for review.'
        }
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-8 h-12 rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-[0_0_16px_rgba(34,197,94,0.3)] hover:bg-primary/90 transition-colors"
      >
        Back to My Projects
      </button>
    </div>
  )
}

// ─── Step 4: The Timesheet Form ─────────────────────────────

function TimesheetForm({
  wizardContract,
  wizardUnits,
  initialCrew,
  onStepClick,
  onNavigate,
}: {
  wizardContract: WizardContract
  wizardUnits: UnitOption[]
  initialCrew: CrewMember[]
  onStepClick: (step: WizardStep) => void
  onNavigate?: (page: string) => void
}) {
  const [screen, setScreen] = useState<"form" | "unitReview" | "review" | "success">("form")
  const [date, setDate] = useState<Date>(nowForDemo())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [selectedUnits, setSelectedUnits] = useState<string[]>(
    wizardUnits.map((u) => u.id)
  )
  const [shiftTimes, setShiftTimes] = useState({
    start: "07:30",
    lunchOut: "12:00",
    lunchIn: "12:30",
    end: "14:00",
  })
  const [crew, setCrew] = useState<CrewMember[]>(initialCrew)
  const [production, setProduction] = useState(0)
  const [isEstimate, setIsEstimate] = useState(false)
  const [productionManualOverride, setProductionManualOverride] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [unitTracking, setUnitTracking] = useState<UnitTracking[]>(() =>
    wizardUnits.map((u) => ({
      unitId: u.id,
      hours: 0,
      status: "" as const,
      completedAt: "",
      note: "",
    }))
  )
  const [unitReviewError, setUnitReviewError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [wasQueued, setWasQueued] = useState(false)
  const [queuedPendingCount, setQueuedPendingCount] = useState(0)
  const isOnline = useOnlineStatus()

  // Load work types from database
  const { data: dbWorkTypes } = useWorkTypes()
  const workTypeNames = useMemo(() =>
    dbWorkTypes.length > 0 ? dbWorkTypes.map(wt => wt.name) : WORK_TYPES,
    [dbWorkTypes]
  )

  // Auto-calculate production from bags (TREES_PER_BAG = 300)
  const TREES_PER_BAG = 300
  const totalBagsFromCrew = useMemo(() =>
    crew.filter(c => c.present).reduce((s, c) => s + (c.bags || 0), 0),
    [crew]
  )
  useEffect(() => {
    if (!productionManualOverride && totalBagsFromCrew > 0) {
      setProduction(totalBagsFromCrew * TREES_PER_BAG)
    }
  }, [totalBagsFromCrew, productionManualOverride])

  const contractName = wizardContract.name
  const companyName = wizardContract.company === "cascadia" ? "Cascadia" : "Ramos"

  // Use wizard units as the in-form unit list
  const allContractUnits = wizardUnits

  const calcHours = useMemo(() => {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number)
      return h * 60 + m
    }
    const morning = toMin(shiftTimes.lunchOut) - toMin(shiftTimes.start)
    const afternoon = toMin(shiftTimes.end) - toMin(shiftTimes.lunchIn)
    return Math.max(0, (morning + afternoon) / 60)
  }, [shiftTimes])

  const handleTimeChange = useCallback((field: string, value: string) => {
    setShiftTimes((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleApplyAll = useCallback(() => {
    setCrew((prev) =>
      prev.map((c) => (c.present ? { ...c, hours: calcHours } : c))
    )
  }, [calcHours])

  const toggleUnit = useCallback((id: string) => {
    setSelectedUnits((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    )
  }, [])

  const updateCrew = useCallback(
    (id: string, updates: Partial<CrewMember>) => {
      setCrew((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      )
    },
    []
  )

  const setAllPresent = useCallback(
    (present: boolean) => {
      setCrew((prev) =>
        prev.map((c) => ({
          ...c,
          present,
          hours: present ? calcHours : 0,
        }))
      )
    },
    [calcHours]
  )

  const updateUnitTracking = useCallback((unitId: string, updates: Partial<UnitTracking>) => {
    setUnitTracking((prev) =>
      prev.map((ut) => (ut.unitId === unitId ? { ...ut, ...updates, _showError: false } : ut))
    )
  }, [])

  const [driveTimes, setDriveTimes] = useState({
    morningStart: "05:30",
    morningEnd: "07:30",
    eveningStart: "14:00",
    eveningEnd: "16:00",
  })

  const calcDriveHours = useMemo(() => {
    const parseMin = (t: string) => {
      const [h, m] = t.split(":").map(Number)
      return (h || 0) * 60 + (m || 0)
    }
    const morning = Math.max(0, parseMin(driveTimes.morningEnd) - parseMin(driveTimes.morningStart))
    const evening = Math.max(0, parseMin(driveTimes.eveningEnd) - parseMin(driveTimes.eveningStart))
    return Math.round(((morning + evening) / 60) * 2) / 2 // round to nearest 0.5
  }, [driveTimes])

  const handleDriveTimeChange = useCallback((field: string, value: string) => {
    setDriveTimes((prev) => ({ ...prev, [field]: value }))
  }, [])

  const applyDriveToAll = useCallback(() => {
    setCrew((prev) =>
      prev.map((c) => (c.isDriver ? { ...c, driveHours: calcDriveHours } : c))
    )
  }, [calcDriveHours])

  // ─── Build submission payload ─────────────────────────────
  const buildPayload = useCallback((): { payload: TimesheetPayload; dedupKey: string } => {
    const dateStr = format(date, "yyyy-MM-dd")
    const presentCrew = crew.filter(c => c.present)
    const FOREMAN_ID = "10000000-0000-0000-0000-000000000001"

    const timesheet = {
      contract_id: wizardContract.id,
      foreman_id: FOREMAN_ID,
      date: dateStr,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      crew_count: presentCrew.length,
      shift_start: shiftTimes.start,
      shift_end: shiftTimes.end,
      lunch_out: shiftTimes.lunchOut,
      lunch_in: shiftTimes.lunchIn,
      drive_morning_start: driveTimes.morningStart,
      drive_morning_end: driveTimes.morningEnd,
      drive_evening_start: driveTimes.eveningStart,
      drive_evening_end: driveTimes.eveningEnd,
      notes: notes || null,
      photos: photos.length > 0 ? photos : null,
    }

    const entries = crew.map(c => ({
      employee_id: c.id,
      is_present: c.present,
      hours_worked: c.present ? c.hours : 0,
      work_type: c.workType || null,
      bags_count: c.bags || 0,
      drive_hours: c.isDriver ? c.driveHours : 0,
      ot_hours: c.present && c.weeklyHours > 40 ? Math.max(0, c.weeklyHours - 40) : 0,
      employee_note: c.note || null,
    }))

    const unitHours = unitTracking
      .filter(ut => ut.status !== "")
      .map(ut => {
        const dbStatus = ut.status.replace(/-/g, "_") as "did_not_work" | "in_progress" | "completed"
        return {
          unit_id: ut.unitId,
          hours_on_unit: ut.hours,
          status_at_submit: dbStatus,
          completed_at_time: ut.status === "completed" && ut.completedAt ? ut.completedAt : null,
          unit_note: ut.note || null,
        }
      })

    const productionLogs = selectedUnits.map(unitId => ({
      unit_id: unitId,
      quantity: Math.round(production / selectedUnits.length),
      quantity_type: "tree" as const,
      is_estimate: isEstimate,
      notes: null,
    }))

    return {
      payload: { timesheet, entries, unitHours, productionLogs },
      dedupKey: `${FOREMAN_ID}:${wizardContract.id}:${dateStr}`,
    }
  }, [date, crew, wizardContract.id, shiftTimes, driveTimes, notes, photos, unitTracking, selectedUnits, production, isEstimate])

  // ─── Queue submission for offline sync ─────────────────────
  const queueSubmission = useCallback(async () => {
    const { payload, dedupKey } = buildPayload()
    const dateStr = format(date, "yyyy-MM-dd")

    // Check for duplicate in queue
    const isDup = await hasDuplicateInQueue(dedupKey)
    if (isDup) {
      const ok = window.confirm("You already have a pending submission for this contract on this date. Submit anyway?")
      if (!ok) return false
    }

    await enqueueSubmission(payload, dedupKey, wizardContract.name, dateStr)
    const count = await getPendingCount()
    setQueuedPendingCount(count)
    setWasQueued(true)
    return true
  }, [buildPayload, date, wizardContract.name])

  // ─── Submit to Supabase (online) or queue (offline) ─────────
  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setSubmitError(null)
    setWasQueued(false)

    try {
      // Demo mode: no backend to write to. The insert path below would
      // hit the no-op Supabase stub and return {data:null}, so `ts.id`
      // throws. Simulate a quick submit and show the success screen.
      if (IS_DEMO_MODE) {
        await new Promise(r => setTimeout(r, 600))
        setScreen("success")
        return
      }

      // Offline: queue for later sync
      if (!navigator.onLine) {
        const queued = await queueSubmission()
        if (queued) setScreen("success")
        return
      }

      // Online: submit directly to Supabase
      const dateStr = format(date, "yyyy-MM-dd")
      const FOREMAN_ID = "10000000-0000-0000-0000-000000000001"

      // Delete any existing rejected timesheet
      await supabase
        .from("timesheets")
        .delete()
        .eq("foreman_id", FOREMAN_ID)
        .eq("contract_id", wizardContract.id)
        .eq("date", dateStr)
        .eq("status", "rejected")

      const { data: ts, error: tsErr } = await supabase
        .from("timesheets")
        .insert({
          contract_id: wizardContract.id,
          foreman_id: FOREMAN_ID,
          date: dateStr,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          crew_count: crew.filter(c => c.present).length,
          shift_start: shiftTimes.start,
          shift_end: shiftTimes.end,
          lunch_out: shiftTimes.lunchOut,
          lunch_in: shiftTimes.lunchIn,
          drive_morning_start: driveTimes.morningStart,
          drive_morning_end: driveTimes.morningEnd,
          drive_evening_start: driveTimes.eveningStart,
          drive_evening_end: driveTimes.eveningEnd,
          notes: notes || null,
          photos: photos.length > 0 ? photos : null,
        })
        .select("id")
        .single()

      if (tsErr) {
        if (tsErr.message?.includes("timesheets_foreman_id_contract_id_date_key")) {
          throw new Error("A timesheet for this contract on this date already exists. Change the date or edit the existing timesheet.")
        }
        throw new Error(`Timesheet insert failed: ${tsErr.message}`)
      }
      const timesheetId = ts.id

      const entries = crew.map(c => ({
        timesheet_id: timesheetId,
        employee_id: c.id,
        is_present: c.present,
        hours_worked: c.present ? c.hours : 0,
        work_type: c.workType || null,
        bags_count: c.bags || 0,
        drive_hours: c.isDriver ? c.driveHours : 0,
        ot_hours: c.present && c.weeklyHours > 40 ? Math.max(0, c.weeklyHours - 40) : 0,
        employee_note: c.note || null,
      }))

      if (entries.length > 0) {
        const { error: entErr } = await supabase
          .from("timesheet_entries")
          .insert(entries)
        if (entErr) throw new Error(`Timesheet entries insert failed: ${entErr.message}`)
      }

      const unitHoursRows = unitTracking
        .filter(ut => ut.status !== "")
        .map(ut => {
          const dbStatus = ut.status.replace(/-/g, "_") as "did_not_work" | "in_progress" | "completed"
          return {
            timesheet_id: timesheetId,
            unit_id: ut.unitId,
            hours_on_unit: ut.hours,
            status_at_submit: dbStatus,
            completed_at_time: ut.status === "completed" && ut.completedAt ? ut.completedAt : null,
            unit_note: ut.note || null,
          }
        })

      if (unitHoursRows.length > 0) {
        const { error: uhErr } = await supabase
          .from("timesheet_unit_hours")
          .insert(unitHoursRows)
        if (uhErr) throw new Error(`Unit hours insert failed: ${uhErr.message}`)
      }

      const prodRows = selectedUnits.map(unitId => ({
        timesheet_id: timesheetId,
        unit_id: unitId,
        quantity: Math.round(production / selectedUnits.length),
        quantity_type: "tree" as const,
        is_estimate: isEstimate,
        notes: null,
      }))

      if (prodRows.length > 0) {
        const { error: prodErr } = await supabase
          .from("production_logs")
          .insert(prodRows)
        if (prodErr) console.warn("Production logs insert warning:", prodErr.message)
      }

      console.log("Timesheet submitted successfully:", timesheetId)
      setScreen("success")
    } catch (err: any) {
      // If it's a network error, try to queue offline
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.log("Network error during submit, queuing offline...")
        try {
          const queued = await queueSubmission()
          if (queued) setScreen("success")
          return
        } catch (queueErr: any) {
          setSubmitError("Failed to save offline: " + (queueErr.message || "Unknown error"))
          return
        }
      }
      console.error("Submit error:", err)
      setSubmitError(err.message || "Failed to submit timesheet")
    } finally {
      setSubmitting(false)
    }
  }, [date, crew, wizardContract.id, wizardContract.name, shiftTimes, driveTimes, notes, photos, unitTracking, selectedUnits, production, isEstimate, queueSubmission, buildPayload])

  const presentCount = crew.filter((c) => c.present).length
  const drivers = crew.filter((c) => c.isDriver && c.present)
  const nonDrivers = crew.filter((c) => !c.isDriver)
  const todayDate = isToday(date)
  const pastDate = isBefore(startOfDay(date), startOfDay(nowForDemo()))

  if (screen === "success") {
    return <SuccessScreen onDone={() => onNavigate?.("myContracts")} isQueued={wasQueued} pendingCount={queuedPendingCount} />
  }

  if (screen === "unitReview") {
    const selectedUnitData = wizardUnits.map((u) => ({
      ...u,
      tracking: unitTracking.find((ut) => ut.unitId === u.id)!,
    }))

    return (
      <UnitReviewScreen
        units={selectedUnitData}
        notes={notes}
        onNotesChange={setNotes}
        photos={photos}
        onAddPhoto={() => setPhotos((p) => [...p, `photo-${p.length + 1}`])}
        onRemovePhoto={(i) => setPhotos((p) => p.filter((_, idx) => idx !== i))}
        unitReviewError={unitReviewError}
        onUpdateUnit={updateUnitTracking}
        onBack={() => { setUnitReviewError(""); setScreen("form") }}
        onNext={() => {
          // Check all units have a status selected
          const noStatus = unitTracking.filter((ut) => ut.status === "")
          if (noStatus.length > 0) {
            setUnitTracking((prev) =>
              prev.map((ut) =>
                ut.status === ""
                  ? { ...ut, _showStatusError: true }
                  : { ...ut, _showStatusError: false }
              )
            )
            setUnitReviewError("Select a status for every unit")
            return
          }
          // Check hours for non-did-not-work units
          const invalidHours = unitTracking.filter(
            (ut) => ut.status !== "did-not-work" && ut.status !== "" && ut.hours <= 0
          )
          if (invalidHours.length > 0) {
            setUnitTracking((prev) =>
              prev.map((ut) =>
                ut.status !== "did-not-work" && ut.status !== "" && ut.hours <= 0
                  ? { ...ut, _showError: true }
                  : { ...ut, _showError: false }
              )
            )
            setUnitReviewError("Every unit marked In Progress or Completed needs hours entered")
            return
          }
          setUnitTracking((prev) => prev.map((ut) => ({ ...ut, _showError: false, _showStatusError: false })))
          setUnitReviewError("")
          setScreen("review")
        }}
        breadcrumb={`${contractName} \u2022 ${wizardUnits.map(u => u.name).join(", ")} \u2022 Marco's Crew`}
      />
    )
  }

  if (screen === "review") {
    return (
      <ReviewScreen
        date={date}
        crew={crew}
        production={production}
        notes={notes}
        contractName={contractName}
        companyName={companyName}
        unitTracking={unitTracking}
        wizardUnits={wizardUnits}
        photos={photos}
        onBack={() => setScreen("unitReview")}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
        isOnline={isOnline}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 -mx-3 -mt-3 border-b border-border bg-background/95 px-3 pb-4 pt-3 backdrop-blur-sm md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TreePine className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">{contractName}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                wizardContract.company === "cascadia"
                  ? "bg-primary/20 text-primary"
                  : "bg-info/20 text-info"
              }`}
            >
              {companyName}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <>
                <span className="h-2 w-2 rounded-full bg-primary" />
                <Wifi className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-primary">Synced</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-warning" />
                <WifiOff className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs text-warning">Offline</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setDate((d) => subDays(d, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
            style={{ minHeight: "44px", minWidth: "44px" }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-foreground hover:bg-elevated transition-colors"
                style={{ minHeight: "44px" }}
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {format(date, "EEE, MMM d")}
                {todayDate && (
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    TODAY
                  </span>
                )}
                {pastDate && (
                  <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                    PAST
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) setDate(d)
                  setCalendarOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
            style={{ minHeight: "44px", minWidth: "44px" }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* OT Status */}
      <OTStatusPanels crew={crew} />

      {/* Unit Selection (collapsible, collapsed by default since already chosen in wizard) */}
      <CollapsibleUnitSelector
        units={allContractUnits}
        selected={selectedUnits}
        onToggle={toggleUnit}
      />

      {/* Shift Times */}
      <ShiftTimesSection
        times={shiftTimes}
        onTimeChange={handleTimeChange}
        calcHours={calcHours}
        onApplyAll={handleApplyAll}
      />

      {/* Crew Section */}
      <div className="flex flex-col gap-3">
        {/* All / None buttons */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setAllPresent(true)}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
            style={{ minHeight: "32px" }}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setAllPresent(false)}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
            style={{ minHeight: "32px" }}
          >
            None
          </button>
        </div>

        {/* ── DRIVERS section ── */}
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          <TruckIcon className="mr-1.5 inline h-3.5 w-3.5" />
          {"Drivers \u2014 "}{drivers.length}
        </label>

        {/* Shared drive time calculator */}
        <DriveTimeCalculator
          driveTimes={driveTimes}
          onDriveTimeChange={handleDriveTimeChange}
          onApplyAll={applyDriveToAll}
          calcDriveHours={calcDriveHours}
          driverCount={drivers.length}
        />

        {/* Driver cards */}
        {crew.filter((c) => c.isDriver).map((member) => (
          <CrewMemberCard
            key={member.id}
            member={member}
            showDriveHrs
            workTypeOptions={workTypeNames}
            onTogglePresent={() =>
              updateCrew(member.id, {
                present: !member.present,
                hours: !member.present ? calcHours : 0,
              })
            }
            onHoursChange={(hours) => updateCrew(member.id, { hours })}
            onWorkTypeChange={(workType) => updateCrew(member.id, { workType })}
            onBagsChange={(bags) => updateCrew(member.id, { bags })}
            onDriveHoursChange={(driveHours) => updateCrew(member.id, { driveHours })}
            onToggleNote={() => updateCrew(member.id, { showNote: !member.showNote })}
            onNoteChange={(note) => updateCrew(member.id, { note })}
          />
        ))}

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* ── CREW section ── */}
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {"Crew \u2014 "}{nonDrivers.filter(c => c.present).length}{" Present"}
        </label>

        {/* Non-driver cards */}
        {nonDrivers.map((member) => (
          <CrewMemberCard
            key={member.id}
            member={member}
            workTypeOptions={workTypeNames}
            onTogglePresent={() =>
              updateCrew(member.id, {
                present: !member.present,
                hours: !member.present ? calcHours : 0,
              })
            }
            onHoursChange={(hours) => updateCrew(member.id, { hours })}
            onWorkTypeChange={(workType) => updateCrew(member.id, { workType })}
            onBagsChange={(bags) => updateCrew(member.id, { bags })}
            onToggleNote={() => updateCrew(member.id, { showNote: !member.showNote })}
            onNoteChange={(note) => updateCrew(member.id, { note })}
          />
        ))}
      </div>

      {/* Production */}
      <ProductionSection
        value={production}
        onChange={setProduction}
        isEstimate={isEstimate}
        onToggleEstimate={() => setIsEstimate(!isEstimate)}
        totalBags={totalBagsFromCrew}
        treesPerBag={TREES_PER_BAG}
        isManualOverride={productionManualOverride}
        onToggleManual={() => setProductionManualOverride(!productionManualOverride)}
      />

      {/* Summary Bar */}
      <SummaryBar crew={crew} production={production} />

      {/* Action Buttons */}
      <div className="flex gap-3 pb-4">
        <button
          type="button"
          className="flex h-12 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-elevated transition-colors"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={() => setScreen("unitReview")}
          className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[0_0_16px_rgba(34,197,94,0.3)] hover:bg-primary/90 transition-colors"
        >
          <span className="hidden sm:inline">Next: Unit Review & Notes</span>
          <span className="sm:hidden">Next: Review</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Adapter: Map DB types → legacy wizard types ────────────

function dbContractToWizard(c: DBContract): WizardContract {
  return {
    id: c.id,
    name: c.name,
    company: c.company_id === CASCADIA_ID ? "cascadia" : "ramos",
    workType: c.work_types?.join(', ') || 'N/A',
    location: c.location || '',
    unitCount: 0, // computed separately
    status: (c.status === 'active' ? 'active' : c.status === 'upcoming' ? 'upcoming' : 'seasonal') as WizardContract['status'],
  }
}

function dbUnitToWizard(u: DBUnit): UnitOption {
  return {
    id: u.id,
    name: u.name,
    county: u.county || '',
    status: u.status === 'in_progress' ? 'active' : u.status === 'not_started' ? 'upcoming' : 'complete',
  }
}

// ─── Main Exported Component ────────────────────────────────

export function ForemanTimesheetPage({ onNavigate, initialContractId }: { onNavigate?: (page: string) => void; initialContractId?: string }) {
  // Live data hooks
  const { data: activeContracts, loading: contractsLoading } = useActiveContracts()
  const { data: crewSets, loading: crewSetsLoading } = useCrewSets()
  const { data: allEmployees } = useEmployees()

  const [wizardStep, setWizardStep] = useState<WizardStep>(initialContractId ? 2 : 1)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(initialContractId || null)
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [selectedCrewSet, setSelectedCrewSet] = useState<string | null>(null)

  // Fetch units for selected contract (re-fetches when contract changes)
  const { data: contractUnits, loading: unitsLoading } = useContractUnits(selectedContractId)

  // Fetch crew set members when a crew set is selected
  const crewSetIdForQuery = selectedCrewSet && selectedCrewSet !== "all-available" ? selectedCrewSet : null
  const { data: crewSetMembers, loading: crewMembersLoading } = useCrewSetMembers(crewSetIdForQuery)

  // Build CrewMember[] from real DB employees
  // Returns [] while data is loading — TimesheetForm won't render until ready
  const initialCrew = useMemo((): CrewMember[] => {
    if (!allEmployees || allEmployees.length === 0) return []

    let employeeIds: string[]
    if (selectedCrewSet === "all-available") {
      employeeIds = allEmployees.filter(e => e.status === "active").map(e => e.id)
    } else if (crewSetMembers && crewSetMembers.length > 0) {
      employeeIds = crewSetMembers.map(m => m.employee_id)
    } else {
      return []
    }

    const empMap = new Map(allEmployees.map(e => [e.id, e]))

    return employeeIds
      .map(id => empMap.get(id))
      .filter((e): e is DBEmployee => !!e)
      .map(e => ({
        id: e.id, // Real DB UUID
        name: `${e.last_name}, ${e.first_name}`,
        present: true,
        hours: 0,
        workType: "Planting",
        weeklyHours: 0,
        bags: 0,
        isDriver: e.is_driver,
        driveHours: 0,
        note: "",
        showNote: false,
      }))
  }, [allEmployees, selectedCrewSet, crewSetMembers])

  // Find the selected DB contract
  const dbContract = activeContracts.find((c) => c.id === selectedContractId)

  // Map DB units to wizard UnitOption for TimesheetForm compatibility
  const selectedUnitObjects = contractUnits
    .filter((u) => selectedUnits.includes(u.id))
    .map(dbUnitToWizard)

  // Build breadcrumb text
  const breadcrumb = useMemo(() => {
    const parts: string[] = []
    if (dbContract) {
      parts.push(dbContract.name)
      parts.push(dbContract.company_id === CASCADIA_ID ? "Cascadia" : "Ramos")
    }
    if (selectedUnitObjects.length > 0) {
      parts.push(selectedUnitObjects.map((u) => u.name).join(", "))
    }
    if (selectedCrewSet) {
      const cs = crewSets.find((c) => c.id === selectedCrewSet)
      if (cs) parts.push(cs.name)
      else if (selectedCrewSet === "all-available") parts.push("All Available Crew")
    }
    return parts.join(" \u2022 ")
  }, [dbContract, selectedUnitObjects, selectedCrewSet, crewSets])

  const handleStepClick = useCallback((step: WizardStep) => {
    setWizardStep(step)
  }, [])

  const handleSelectContract = useCallback((id: string) => {
    setSelectedContractId(id)
    setSelectedUnits([])
    setSelectedCrewSet(null)
    // Auto-advance to unit selection on contract tap
    setWizardStep(2)
  }, [])

  const handleToggleUnit = useCallback((id: string) => {
    setSelectedUnits((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    )
  }, [])

  // Create wizard-compatible contract for TimesheetForm
  const wizardContract = dbContract ? dbContractToWizard(dbContract) : null

  return (
    <div className="mx-auto w-full max-w-full overflow-x-hidden md:max-w-[560px]">
      <div className="mb-5">
        <StepProgressBar
          currentStep={wizardStep}
          onStepClick={handleStepClick}
          breadcrumb={breadcrumb}
        />
      </div>

      {wizardStep === 1 && (
        <StepSelectContract
          selected={selectedContractId}
          onSelect={handleSelectContract}
          onNext={() => setWizardStep(2)}
          contracts={activeContracts}
          loading={contractsLoading}
        />
      )}

      {wizardStep === 2 && selectedContractId && dbContract && (
        <StepSelectUnits
          contract={dbContract}
          units={contractUnits}
          unitsLoading={unitsLoading}
          selected={selectedUnits}
          onToggle={handleToggleUnit}
          onBack={() => setWizardStep(1)}
          onNext={() => setWizardStep(3)}
        />
      )}

      {wizardStep === 3 && (
        <StepSelectCrew
          selected={selectedCrewSet}
          onSelect={setSelectedCrewSet}
          onBack={() => setWizardStep(2)}
          onNext={() => setWizardStep(4)}
          crewSets={crewSets}
          crewSetsLoading={crewSetsLoading}
        />
      )}

      {wizardStep === 4 && wizardContract && initialCrew.length > 0 && (
        <TimesheetForm
          key={selectedCrewSet || "default"}
          wizardContract={wizardContract}
          wizardUnits={selectedUnitObjects}
          initialCrew={initialCrew}
          onStepClick={handleStepClick}
          onNavigate={onNavigate}
        />
      )}
      {wizardStep === 4 && wizardContract && initialCrew.length === 0 && (
        crewMembersLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading crew...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="text-sm font-medium text-foreground">No crew members in this crew set</div>
            <p className="text-xs text-muted-foreground max-w-sm">
              This crew set exists but has no members assigned. Go to Crew Sets to add members, or go back and pick a different crew.
            </p>
            <button
              onClick={() => setWizardStep(3)}
              className="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-elevated"
            >
              ← Back to Crew Selection
            </button>
          </div>
        )
      )}
    </div>
  )
}
