"use client"

/**
 * Pending Expenses page — the office's queue for assigning imported expenses
 * to projects (contracts). Auto-matched expenses are already gone from this
 * list; what's left is everything the matcher couldn't figure out.
 *
 * Each row shows enough context (date, vendor, amount, cardholder, location)
 * for the office to pick the right project. They select a project from the
 * dropdown and click Assign. The row disappears, the audit log captures who
 * assigned it and when, and the expense flows through to the project's
 * Expenses tab and the admin dashboard.
 */

import { useMemo, useState } from "react"
import { Loader2, CheckCircle2, MapPin, CreditCard, Receipt, AlertCircle, AlertTriangle, Trash2 } from "lucide-react"
import useClientQuery from "@/hooks/use-client-query"
import useClientMutation from "@/hooks/use-client-mutation"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useContracts } from "@/hooks/use-supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

const CASCADIA_ID = "00000000-0000-0000-0000-000000000001"
const RAMOS_ID = "00000000-0000-0000-0000-000000000002"

function formatDate(d: string | null): string {
  if (!d) return ""
  const dt = new Date(d + "T00:00:00")
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatCurrency(n: number | null): string {
  if (n === null || n === undefined) return "—"
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

// 15-bucket schema (see lib/expenses/parser.ts + contracts.tsx duplicate).
// Keep in sync across admin-pages.tsx, contracts.tsx, and this file until
// we consolidate into a shared lib/expenses/labels.ts.
const CATEGORY_COLOR_MAP: Record<string, string> = {
  fuel: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  vehicle_maintenance: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  vehicle_rental: "bg-orange-600/20 text-orange-200 border-orange-600/40",
  lodging: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  airfare_transit: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  tolls_parking: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  meals: "bg-green-500/20 text-green-300 border-green-500/40",
  groceries: "bg-lime-500/20 text-lime-300 border-lime-500/40",
  equipment: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  chainsaw: "bg-red-500/20 text-red-300 border-red-500/40",
  safety_gear: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  office_admin: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  professional_services: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
  fees_insurance: "bg-pink-500/20 text-pink-300 border-pink-500/40",
  other: "bg-slate-500/20 text-slate-300 border-slate-500/40",
}

const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  fuel: "Fuel",
  vehicle_maintenance: "Vehicle Maintenance",
  vehicle_rental: "Vehicle Rental",
  lodging: "Lodging",
  airfare_transit: "Airfare & Transit",
  tolls_parking: "Tolls & Parking",
  meals: "Meals",
  groceries: "Groceries",
  equipment: "Equipment",
  chainsaw: "Chainsaw",
  safety_gear: "Safety Gear",
  office_admin: "Office & Admin",
  professional_services: "Professional Services",
  fees_insurance: "Fees & Insurance",
  other: "Other",
}

function categoryColor(category: string | null): string {
  if (!category) return CATEGORY_COLOR_MAP.other
  return CATEGORY_COLOR_MAP[category] || CATEGORY_COLOR_MAP.other
}

function categoryLabel(category: string | null): string {
  if (!category) return "—"
  return CATEGORY_DISPLAY_MAP[category] || category
}

const FLAG_LABELS: Record<string, string> = {
  missing_vendor: "No vendor",
  missing_cardholder: "No cardholder",
  unmapped_category: "Unmapped category",
  invalid_amount: "Bad amount",
  invalid_date: "Bad date",
}

export function PendingExpensesPage() {
  const { role, company } = useApp()
  const { profile } = useAuth()
  const { toast } = useToast()
  // Gate on BOTH profile.role (actual auth) and context role (VIEW AS switcher)
  // so Needs Attention + Delete buttons hide when viewing as office
  const isAdmin = profile?.role === "admin" && role === "admin"

  const { data: pending, isLoading, error, refetch } = useClientQuery("pendingExpenses")
  const { data: contracts } = useContracts()

  // Split pending into flagged (quality issues) and clean rows.
  // Uses the same query — no separate request needed.
  const flagged = useMemo(() => {
    if (!pending) return []
    return pending.filter((e) => {
      const flags = (e.quality_flags as string[] | null) || []
      return flags.length > 0
    })
  }, [pending])

  const [search, setSearch] = useState("")
  // Local map of expense_id → selected contract_id (before clicking Assign)
  const [selections, setSelections] = useState<Record<string, string>>({})
  // Track which row is currently being assigned or deleted
  const [assigning, setAssigning] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const deleteMutation = useClientMutation("deleteExpense", {
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: "Deleted", description: "Bad row removed from the queue." })
      } else {
        toast({ title: "Could not delete", description: result.error, variant: "destructive" })
      }
      setDeleting(null)
    },
    onError: (err) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" })
      setDeleting(null)
    },
  })

  const handleDelete = (expenseId: string) => {
    if (!confirm("Delete this expense? It will be hidden from all views but kept in the database for audit. Use this for bad/duplicate rows that need to be re-imported after fixing the source data.")) return
    setDeleting(expenseId)
    deleteMutation.mutate({ expenseId, userId: profile?.id || null })
  }

  const assignMutation = useClientMutation("assignExpense", {
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: result.action === "reassigned" ? "Reassigned" : "Assigned",
          description: "Expense moved off the queue.",
        })
        // Clear the selection for this row
        setSelections((prev) => {
          const next = { ...prev }
          delete next[result.expenseId]
          return next
        })
      } else {
        toast({
          title: "Could not assign",
          description: result.error,
          variant: "destructive",
        })
      }
      setAssigning(null)
    },
    onError: (err) => {
      toast({
        title: "Assignment failed",
        description: err.message,
        variant: "destructive",
      })
      setAssigning(null)
    },
  })

  // Filter by company toggle + search
  const filtered = useMemo(() => {
    const rows = pending || []
    return rows.filter((r) => {
      // Company filter — use the global toggle
      if (company === "cascadia" && r.company_id !== CASCADIA_ID) return false
      if (company === "ramos" && r.company_id !== RAMOS_ID) return false

      // Search across vendor, cardholder, description, location
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const haystack = [
          r.vendor,
          r.cardholder_name,
          r.description,
          r.location_city,
          r.location_state,
          r.payment_method,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [pending, company, search])

  // Active contracts + overhead categories. Overhead rows (Bids, Shop,
  // Sick Time, Hearing Work, etc. — anything with contract_type='overhead')
  // sort to the top of the picker as a separate group. They're treated
  // as expense-assignment targets just like real projects.
  const contractOptions = useMemo(() => {
    const filtered = (contracts || [])
      .filter((c) => {
        const isActive =
          c.status === "active" ||
          c.status === "open" ||
          c.status === "upcoming" ||
          c.status === "seasonal"
        const isOverhead = c.contract_type === "overhead"
        return isActive || isOverhead
      })
      .filter((c) => {
        if (company === "cascadia") return c.company_id === CASCADIA_ID
        if (company === "ramos") return c.company_id === RAMOS_ID
        return true
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    const overheads = filtered.filter((c) => c.contract_type === "overhead")
    const projects = filtered.filter((c) => c.contract_type !== "overhead")
    return { overheads, projects }
  }, [contracts, company])

  const handleAssign = (expenseId: string) => {
    const contractId = selections[expenseId]
    if (!contractId) return
    setAssigning(expenseId)
    assignMutation.mutate({
      expenseId,
      contractId,
      userId: profile?.id || null,
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading pending expenses…
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-center gap-2 py-6 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Failed to load pending expenses: {String(error)}
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="ml-auto">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expense Assignments</h2>
          <p className="text-sm text-muted-foreground">
            Imported expenses waiting to be assigned to a project. Auto-matched expenses are already routed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            <Receipt className="mr-1 h-3 w-3" />
            {filtered.length} pending
          </Badge>
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <Input
            placeholder="Search vendor, cardholder, description, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Needs Attention — admin only, shows rows with quality issues */}
      {isAdmin && flagged && flagged.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Needs Attention ({flagged.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              These rows imported but are missing data. Fix in the source sheet, re-import, then delete the bad row here.
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-1.5 text-left">ID</th>
                  <th className="px-3 py-1.5 text-left">Date</th>
                  <th className="px-3 py-1.5 text-left">Vendor</th>
                  <th className="px-3 py-1.5 text-right">Amount</th>
                  <th className="px-3 py-1.5 text-left">Cardholder</th>
                  <th className="px-3 py-1.5 text-left">Issue</th>
                  <th className="px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((exp) => {
                  const flags = (exp.quality_flags as string[]) || []
                  const isDeletingThis = deleting === exp.id
                  return (
                    <tr key={exp.id} className="border-b last:border-0 hover:bg-amber-500/5">
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-[10px] text-amber-400">
                        {exp.display_id || "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDate(exp.date)}
                      </td>
                      <td className="px-3 py-2">
                        {exp.vendor ? (
                          <span className="text-foreground">{exp.vendor}</span>
                        ) : (
                          <span className="text-amber-400 italic">missing</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-3 py-2">
                        {exp.cardholder_name || (
                          <span className="text-amber-400 italic">missing</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {flags.map((f) => (
                            <span
                              key={f}
                              className="inline-block rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300"
                            >
                              {FLAG_LABELS[f] || f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(exp.id)}
                          disabled={isDeletingThis}
                          title="Delete this bad row"
                        >
                          {isDeletingThis ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-base font-medium">All caught up</p>
            <p className="text-sm text-muted-foreground">
              {pending && pending.length > 0
                ? "No pending expenses match your filters."
                : "Every imported expense has been assigned to a project."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pending Queue</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Cardholder</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-left">Project</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((exp) => {
                    const isAssigningThis = assigning === exp.id
                    const selectedContract = selections[exp.id]
                    const cardholder = exp.cardholder_name || "—"
                    const employeeName = exp.employees
                      ? `${(exp.employees as { first_name: string; last_name: string }).first_name} ${(exp.employees as { first_name: string; last_name: string }).last_name}`
                      : null
                    const location = [exp.location_city, exp.location_state].filter(Boolean).join(", ")
                    return (
                      <tr key={exp.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                          {exp.display_id || '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(exp.date)}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{exp.vendor || "—"}</div>
                          {exp.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{exp.description}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(exp.amount)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 text-xs">
                            <CreditCard className="h-3 w-3 text-muted-foreground" />
                            {employeeName || cardholder}
                          </div>
                          {exp.payment_method && (
                            <div className="text-xs text-muted-foreground">{exp.payment_method}</div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {exp.category && (
                            <Badge variant="outline" className={categoryColor(exp.category)}>
                              {categoryLabel(exp.category)}
                            </Badge>
                          )}
                          {exp.subcategory && (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">{exp.subcategory}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {location ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {location}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <ProjectPicker
                            selectedId={selectedContract || ""}
                            onSelect={(v) =>
                              setSelections((prev) => ({ ...prev, [exp.id]: v }))
                            }
                            overheads={contractOptions.overheads}
                            projects={contractOptions.projects}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleAssign(exp.id)}
                              disabled={!selectedContract || isAssigningThis}
                            >
                              {isAssigningThis ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Assign"
                              )}
                            </Button>
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(exp.id)}
                                disabled={deleting === exp.id}
                                title="Delete bad/duplicate row"
                              >
                                {deleting === exp.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── ProjectPicker — searchable, overhead-grouped expense assignment picker ─
//
// Replaces the previous flat <Select>. Two visible groups:
//   • Overhead — Bids, Shop, Sick Time, Hearing Work (anything tagged
//     contract_type='overhead'). Always sorts to the top so the office
//     can find them fast for non-project spend.
//   • Projects — every active real project, alphabetized.
//
// Type-to-search filters both groups simultaneously (cmdk's built-in
// match logic). Empty match shows a short "no projects" message.

type PickerOption = { id: string; name: string | null }

function ProjectPicker({
  selectedId,
  onSelect,
  overheads,
  projects,
}: {
  selectedId: string
  onSelect: (id: string) => void
  overheads: PickerOption[]
  projects: PickerOption[]
}) {
  const [open, setOpen] = useState(false)
  const all = useMemo(() => [...overheads, ...projects], [overheads, projects])
  const selected = all.find((c) => c.id === selectedId)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-[220px] justify-between text-xs font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected?.name || "Pick a project…"}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects…" className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              No matches.
            </CommandEmpty>
            {overheads.length > 0 && (
              <CommandGroup heading="Overhead">
                {overheads.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name || ""}
                    onSelect={() => {
                      onSelect(c.id)
                      setOpen(false)
                    }}
                    className="text-xs"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        selectedId === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {projects.length > 0 && (
              <CommandGroup heading="Projects">
                {projects.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name || ""}
                    onSelect={() => {
                      onSelect(c.id)
                      setOpen(false)
                    }}
                    className="text-xs"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        selectedId === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
