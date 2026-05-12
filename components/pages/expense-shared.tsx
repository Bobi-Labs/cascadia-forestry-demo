"use client"

/**
 * Shared expense pieces extracted out of ExpensesPage so the Imports
 * hub can render them. Each component is self-contained — it fetches
 * its own data and owns its own state, so it can be dropped into any
 * page without prop wiring.
 *
 *   - ImportFromSheetButton  →  triggers the sheet pull, shows status
 *   - RecentActivityCard     →  read-only feed of assignment changes
 *   - RecentImportsCard      →  expandable list of recent sheet pulls
 */

import { useState } from "react"
import { Loader2, Upload, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react"
import useClientQuery from "@/hooks/use-client-query"
import { useAuth } from "@/lib/auth-context"

const fmtCurrency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

// ─── Import from Sheet button ─────────────────────────────────────────────

export function ImportFromSheetButton() {
  const { profile } = useAuth()
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const handleImport = async () => {
    const sheetId = process.env.NEXT_PUBLIC_EXPENSE_SHEET_ID
    if (!sheetId) {
      setImportMsg("Missing NEXT_PUBLIC_EXPENSE_SHEET_ID — set it in Vercel/.env.local to enable imports.")
      return
    }
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await fetch("/api/expenses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleImport}
        disabled={importing}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Import from Sheet
      </button>
      {importMsg && (
        <span className="text-xs text-muted-foreground truncate max-w-[400px]">{importMsg}</span>
      )}
    </div>
  )
}

// ─── Recent Activity card ─────────────────────────────────────────────────

export function RecentActivityCard() {
  const { data: activity } = useClientQuery("expenseActivity")
  if (!activity || activity.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Activity
        </h3>
        <span className="text-[10px] text-muted-foreground">last {Math.min(activity.length, 10)}</span>
      </div>
      <ul className="divide-y divide-border/60 max-h-[360px] overflow-y-auto">
        {activity.slice(0, 10).map((a) => {
          const exp =
            (a.expenses as {
              vendor: string | null
              amount: number | null
              cardholder_name: string | null
              date: string | null
              contracts: { name: string | null } | null
            } | null) || null
          const contractName = exp?.contracts?.name || null
          const when = a.created_at
            ? new Date(a.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "—"
          let label = ""
          let icon = "·"
          let tone = "text-muted-foreground"
          switch (a.action) {
            case "auto_matched":
              label = `Auto-matched to ${contractName || "a project"}`
              icon = "↻"
              tone = "text-emerald-400"
              break
            case "assigned":
              label = `Assigned to ${contractName || "a project"}`
              icon = "→"
              tone = "text-primary"
              break
            case "reassigned":
              label = `Reassigned to ${contractName || "a project"}`
              icon = "⇄"
              tone = "text-amber-400"
              break
            case "unassigned":
              label = "Unassigned from project"
              icon = "←"
              tone = "text-muted-foreground"
              break
            case "updated":
              label = `Updated${a.field_changed ? " (" + a.field_changed + ")" : ""}`
              icon = "✎"
              break
            case "deleted":
              label = "Deleted"
              icon = "✕"
              tone = "text-destructive"
              break
            default:
              label = a.action
          }
          return (
            <li key={a.id} className="flex items-start gap-2 px-3 py-2 text-xs">
              <span className={`mt-0.5 font-mono ${tone}`}>{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-foreground truncate">{exp?.vendor || "Expense"}</span>
                  {exp?.amount !== undefined && exp.amount !== null && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {fmtCurrency(Number(exp.amount))}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {label}
                  {exp?.cardholder_name && ` · ${exp.cardholder_name}`}
                </div>
              </div>
              <span className="whitespace-nowrap text-[9px] text-muted-foreground">{when}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Recent Imports card ──────────────────────────────────────────────────

export function RecentImportsCard() {
  const { data: imports } = useClientQuery("expenseImports")
  const [expandedImport, setExpandedImport] = useState<string | null>(null)
  if (!imports || imports.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Imports
        </h3>
        <span className="text-[10px] text-muted-foreground">last {Math.min(imports.length, 8)}</span>
      </div>
      <div className="max-h-[500px] overflow-auto">
        <div className="flex items-center text-left text-[9px] uppercase tracking-wide text-muted-foreground border-b border-border/40 bg-card sticky top-0 z-10">
          <div className="flex-shrink-0 w-[110px] px-3 py-2">When</div>
          <div className="flex-1 min-w-0 px-2 py-2">Tabs</div>
          <div className="flex-shrink-0 w-[60px] px-2 py-2 text-right">Rows</div>
          <div className="flex-shrink-0 w-[40px] px-2 py-2 text-right">In</div>
          <div className="flex-shrink-0 w-[50px] px-2 py-2 text-right">Skip</div>
          <div className="flex-shrink-0 w-[70px] px-2 py-2 text-right">Err</div>
          <div className="flex-shrink-0 w-[70px] px-2 py-2">Status</div>
          <div className="flex-shrink-0 w-[20px]"></div>
        </div>
        {imports.slice(0, 8).map((b) => {
          let tabInfo: { processed?: string[]; skipped?: string[] } | null = null
          let errors: Array<{ rowIndex?: number; message: string }> = []
          let warnings: Array<{ rowIndex?: number; message: string }> = []
          try {
            const log = typeof b.error_log === "string" ? JSON.parse(b.error_log) : b.error_log
            if (log && typeof log === "object" && !Array.isArray(log)) {
              tabInfo = log.tabs || null
              errors = Array.isArray(log.errors) ? log.errors : []
              warnings = Array.isArray(log.warnings) ? log.warnings : []
            } else if (Array.isArray(log)) {
              errors = log
            }
          } catch {
            /* ignore */
          }
          const hasIssues = errors.length > 0 || warnings.length > 0
          const isExpanded = expandedImport === b.id

          return (
            <div key={b.id}>
              <button
                type="button"
                onClick={() => hasIssues && setExpandedImport(isExpanded ? null : b.id)}
                className={`flex w-full items-center text-left text-[10px] hover:bg-elevated/40 ${hasIssues ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex-shrink-0 w-[110px] px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {b.created_at
                    ? new Date(b.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                    : "—"}
                </div>
                <div className="flex-1 min-w-0 px-2 py-2">
                  {tabInfo ? (
                    <div className="text-[9px] leading-tight">
                      <span className="text-foreground/70">{tabInfo.processed?.join(", ") || "—"}</span>
                      {tabInfo.skipped && tabInfo.skipped.length > 0 && (
                        <span className="text-amber-500/60 ml-2">skipped: {tabInfo.skipped.join(", ")}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[9px] text-muted-foreground/40">—</span>
                  )}
                </div>
                <div className="flex-shrink-0 w-[60px] px-2 py-2 text-right font-mono">{b.row_count ?? "—"}</div>
                <div className="flex-shrink-0 w-[40px] px-2 py-2 text-right font-mono">{b.imported_count ?? "—"}</div>
                <div className="flex-shrink-0 w-[50px] px-2 py-2 text-right font-mono">{b.skipped_count ?? "—"}</div>
                <div className="flex-shrink-0 w-[70px] px-2 py-2 text-right font-mono">
                  {(b.error_count || 0) > 0 && <span className="text-destructive">{b.error_count} err</span>}
                  {warnings.length > 0 && <div className="text-[9px] text-amber-400">{warnings.length} warn</div>}
                  {!b.error_count && warnings.length === 0 && <span className="text-muted-foreground">0</span>}
                </div>
                <div className="flex-shrink-0 w-[70px] px-2 py-2">
                  {b.status === "completed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Done
                    </span>
                  ) : b.status === "failed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] text-destructive">
                      <AlertCircle className="h-2.5 w-2.5" /> Failed
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground">{b.status}</span>
                  )}
                </div>
                <div className="flex-shrink-0 w-[20px] px-1 py-2 text-muted-foreground">
                  {hasIssues && (
                    <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-border/40 bg-muted/10 px-4 py-3 text-[11px]">
                  {errors.length > 0 && (
                    <div className="mb-3">
                      <div className="mb-1 font-semibold text-destructive">
                        {errors.length} Error{errors.length !== 1 ? "s" : ""} — rows that could not be imported
                      </div>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {errors.slice(0, 10).map((e, i) => (
                          <li key={i} className="flex gap-2">
                            {e.rowIndex && <span className="text-destructive/60 font-mono">Row {e.rowIndex}</span>}
                            <span>{e.message}</span>
                          </li>
                        ))}
                        {errors.length > 10 && (
                          <li className="text-muted-foreground/50">+{errors.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {warnings.length > 0 &&
                    (() => {
                      const groups = new Map<string, number>()
                      for (const w of warnings) {
                        const match = w.message.match(/missing: (.+)$/)
                        const key = match?.[1] || w.message
                        groups.set(key, (groups.get(key) || 0) + 1)
                      }
                      return (
                        <div>
                          <div className="mb-1 font-semibold text-amber-400">
                            {warnings.length} Warning{warnings.length !== 1 ? "s" : ""} — imported but with missing data
                          </div>
                          <ul className="space-y-0.5 text-muted-foreground">
                            {[...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key, count]) => (
                              <li key={key} className="flex gap-2">
                                <span className="text-amber-400/60 font-mono">{count}x</span>
                                <span>{key}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })()}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
