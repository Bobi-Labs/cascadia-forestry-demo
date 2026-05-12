"use client";

/**
 * Unit Ingest Audit dashboard — admin view of what the ingest
 * pipeline has done. Two stacked cards:
 *
 *   1. Recent batches — every spec file the watcher has discovered.
 *      Shows status, contract, format, parse counts (created /
 *      flagged / skipped). Click one → expands to show its audit
 *      entries.
 *   2. Recent activity — flat audit log of created / updated /
 *      skipped / excluded actions across all batches. Filterable
 *      by action.
 *
 * Read-only. The watcher / orchestrator do the writing; this page
 * just surfaces what they did so admin can spot regressions.
 */

import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, ScrollText, ChevronRight, ChevronDown, FileText,
  CheckCircle2, X, RefreshCw, Ban, Plus, Play, ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import { useContracts, useUnits } from "@/hooks/use-supabase";
// .mjs import works in Next/webpack — type-only import would need a
// .d.ts. The function returns one of LANDOWNER_OPTIONS values or
// "unknown" so we cast at the call site.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module without typings, runtime shape is verified
import { detectLandownerFromFolderName } from "@/lib/ingest/landowner-detect.mjs";

interface BatchRow {
  id: string;
  contract_id: string | null;
  drive_file_id: string | null;
  drive_file_name: string | null;
  landowner: string | null;
  format_tag: string | null;
  status: string;
  rows_created: number | null;
  rows_skipped: number | null;
  rows_flagged: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  // error_log shape varies by failure path:
  //   no_parser  → { reason: "no_parser", format_tag: "..." }
  //   parse_fail → { reason: "parse_failed", message: "..." }
  //   download   → { reason: "download_failed", message: "..." }
  // null on success / partial / pending.
  error_log: { reason?: string; message?: string; format_tag?: string } | null;
  contracts?: { id: string; name: string } | null;
}

/**
 * Decode batch.status + error_log into a friendlier (label, tone, tooltip)
 * triple. The four status values map straight to a color:
 *   success → green   "All rows accepted"
 *   partial → amber   "Some rows queued for office review"
 *   pending → grey    "Waiting for the next ingest run"
 *   failed  → varies  see below
 *
 * Failed splits two ways. The format detector recognized the file but
 * we haven't shipped a parser for it yet ("no_parser") — that's a
 * planned-work flag, not a real error, and it gets a calmer tone. A
 * parser actually threw or download failed → destructive red, this is
 * something to fix.
 */
function statusDetail(b: BatchRow): {
  label: string;
  detail: string | null;
  tone: string;
  tooltip: string;
} {
  const reason = b.error_log?.reason ?? null;
  if (b.status === "failed" && reason === "no_parser") {
    return {
      label: "no parser yet",
      detail: b.error_log?.format_tag ?? null,
      tone: "bg-slate-500/15 text-slate-300",
      tooltip: "We recognized the file but a parser for this format hasn't shipped yet. Expected — not an error to fix.",
    };
  }
  if (b.status === "failed") {
    return {
      label: "failed",
      detail: b.error_log?.message ?? null,
      tone: STATUS_TONE.failed,
      tooltip: "The parser threw or the file couldn't be downloaded. Click to expand for the error message.",
    };
  }
  if (b.status === "partial") {
    return {
      label: "partial",
      detail: null,
      tone: STATUS_TONE.partial,
      tooltip: "Parsed cleanly but at least one row had warnings — check Pending Units.",
    };
  }
  if (b.status === "success") {
    return {
      label: "success",
      detail: null,
      tone: STATUS_TONE.success,
      tooltip: "Parsed cleanly. New rows landed in `units` (auto-insert) or `unit_pending_review` (review queue).",
    };
  }
  if (b.status === "pending") {
    return {
      label: "pending",
      detail: null,
      tone: STATUS_TONE.pending,
      tooltip: "Waiting for the next ingest run to process this file.",
    };
  }
  if (b.status === "processing") {
    return {
      label: "processing",
      detail: null,
      tone: STATUS_TONE.processing,
      tooltip: "Currently being parsed.",
    };
  }
  return {
    label: b.status,
    detail: null,
    tone: STATUS_TONE[b.status] ?? "bg-muted text-muted-foreground",
    tooltip: b.status,
  };
}

interface AuditRow {
  id: string;
  batch_id: string;
  unit_id: string | null;
  action: string;
  source_file: string | null;
  field_changes: unknown;
  created_at: string;
  // Joined context so the Recent Activity table can show landowner /
  // contract / unit-name without forcing the office to dig — Q from
  // the May 7 walkthrough.
  batches?: {
    landowner: string | null;
    drive_file_id: string | null;
    drive_file_name: string | null;
    contracts?: { id: string; name: string } | null;
  } | null;
  units?: { id: string; name: string | null } | null;
}

const STATUS_TONE: Record<string, string> = {
  pending:     "bg-muted text-muted-foreground",
  processing:  "bg-info/15 text-info",
  success:     "bg-primary/15 text-primary",
  partial:     "bg-amber-500/15 text-amber-300",
  failed:      "bg-destructive/15 text-destructive",
  rolled_back: "bg-rose-500/15 text-rose-300",
};

const ACTION_TONE: Record<string, string> = {
  created:  "bg-primary/15 text-primary",
  updated:  "bg-info/15 text-info",
  skipped:  "bg-muted text-muted-foreground",
  flagged:  "bg-amber-500/15 text-amber-300",
  excluded: "bg-rose-500/15 text-rose-300",
  reverted: "bg-purple-500/15 text-purple-300",
};

export function UnitIngestAuditPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const { role, t } = useApp();
  const isAdmin = role === "admin";
  const reviewerName = profile?.name || profile?.email?.split("@")[0] || "Admin";
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{
    ok: boolean;
    summary?: string;
    error?: string;
  } | null>(null);
  const [lastReset, setLastReset] = useState<{
    ok: boolean;
    summary?: string;
    error?: string;
  } | null>(null);

  async function handleResetIngest(mode: string, prefix?: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setResetting(mode);
    setLastReset(null);
    try {
      const res = await fetch("/api/ingest/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, prefix }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setLastReset({ ok: false, error: json.error || `HTTP ${res.status}` });
      } else {
        const parts: string[] = [];
        if (json.deleted) parts.push(`${json.deleted} row${json.deleted === 1 ? "" : "s"} deleted`);
        if (json.updated) parts.push(`${json.updated} batch${json.updated === 1 ? "" : "es"} reset to pending`);
        const summary = `${mode}: ${parts.join(" · ") || "no-op"}`;
        setLastReset({ ok: true, summary });
        refetchBatches();
        refetchAudit();
      }
    } catch (e) {
      setLastReset({ ok: false, error: e instanceof Error ? e.message : "reset failed" });
    } finally {
      setResetting(null);
    }
  }

  async function handleRunIngest(opts: { dryRun: boolean }) {
    setTriggering(true);
    setLastRun(null);
    try {
      const res = await fetch("/api/ingest/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: opts.dryRun }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setLastRun({ ok: false, error: json.error || `HTTP ${res.status}` });
      } else {
        const s = json.scan ?? {};
        const p = json.process ?? {};
        const summary =
          `${opts.dryRun ? "[dry-run] " : ""}` +
          `walked ${s.contractsWalked ?? 0} contracts · ` +
          `${s.filesFound ?? 0} files seen · ` +
          `${s.batchesCreated ?? 0} new batches · ` +
          `${p.rowsInserted ?? 0} units inserted · ` +
          `${p.rowsQueuedForReview ?? 0} queued for review · ` +
          `${json.elapsedMs}ms`;
        setLastRun({ ok: true, summary });
        // Refresh the cards so new batches/audit entries appear
        refetchBatches();
        refetchAudit();
      }
    } catch (e) {
      setLastRun({ ok: false, error: e instanceof Error ? e.message : "trigger failed" });
    } finally {
      setTriggering(false);
    }
  }

  const { data: batches, isLoading: batchLoading, refetch: refetchBatches } = useQuery({
    queryKey: ["ingestBatches"],
    queryFn: async (): Promise<BatchRow[]> => {
      const { data, error } = await supabase
        .from("unit_ingest_batches")
        .select(`
          id, contract_id, drive_file_id, drive_file_name, landowner, format_tag,
          status, rows_created, rows_skipped, rows_flagged, started_at,
          finished_at, created_at, error_log,
          contracts:contracts!contract_id (id, name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as BatchRow[];
    },
    staleTime: 60_000,
  });

  const { data: audit, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ["ingestAudit", actionFilter],
    queryFn: async (): Promise<AuditRow[]> => {
      // Pull joined context: batch.landowner + batch.contracts.name +
      // units.name. Lets the Recent Activity row show "Manulife · 2026
      // PCT WA Kyle Dodson · Torino LW PCT" instead of just a UUID
      // suffix.
      let q = supabase
        .from("unit_ingest_audit")
        .select(`
          id, batch_id, unit_id, action, source_file, field_changes, created_at,
          batches:unit_ingest_batches!batch_id (
            landowner,
            drive_file_id,
            drive_file_name,
            contracts:contracts!contract_id (id, name)
          ),
          units:units!unit_id (id, name)
        `)
        .order("created_at", { ascending: false })
        .limit(200);
      if (actionFilter) q = q.eq("action", actionFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    staleTime: 60_000,
  });

  const auditByBatch = useMemo(() => {
    const m = new Map<string, AuditRow[]>();
    for (const a of audit ?? []) {
      const arr = m.get(a.batch_id) ?? [];
      arr.push(a);
      m.set(a.batch_id, arr);
    }
    return m;
  }, [audit]);

  const actionCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of audit ?? []) m[a.action] = (m[a.action] ?? 0) + 1;
    return m;
  }, [audit]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ScrollText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t('uia_heading')}</h2>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => handleRunIngest({ dryRun: true })}
              disabled={triggering}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-elevated disabled:opacity-50"
              title={t("uia_dryRunTooltip")}
            >
              {triggering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Dry run
            </button>
            <button
              type="button"
              onClick={() => handleRunIngest({ dryRun: false })}
              disabled={triggering}
              className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              title={t("uia_runIngestTooltip")}
            >
              {triggering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run ingest now
            </button>
            {/* Reset cluster — destructive ops, all admin-only.
                "Retry failed" is non-destructive (just flips status);
                "Wipe queues" + "Purge TEST units" both confirm before
                running. Keeps the office out of a terminal for routine
                cleanup between test passes. */}
            <button
              type="button"
              onClick={() => handleResetIngest("retry-failed")}
              disabled={!!resetting || triggering}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-elevated disabled:opacity-50"
              title={t("uia_retryFailedTooltip")}
            >
              {resetting === "retry-failed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Retry failed
            </button>
            <button
              type="button"
              onClick={() => handleResetIngest(
                "full-reset",
                undefined,
                "Wipe ALL ingest queues?\n\n• unit_ingest_batches (Recent batches table)\n• unit_pending_review (Pending Units page)\n• unit_ingest_audit (Recent activity table)\n\nThis does NOT touch already-inserted units. Continue?",
              )}
              disabled={!!resetting || triggering}
              className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
              title={t("uia_wipeTooltip")}
            >
              {resetting === "full-reset" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Wipe queues
            </button>
            <button
              type="button"
              onClick={() => {
                const prefix = window.prompt(
                  "Delete `units` rows whose name starts with…",
                  "TEST",
                );
                if (!prefix || prefix.length < 2) return;
                handleResetIngest(
                  "purge-units-prefix",
                  prefix,
                  `Delete every unit whose name starts with "${prefix}"?\n\nThis is the only way to drop real units rows from the UI. Continue?`,
                );
              }}
              disabled={!!resetting || triggering}
              className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
              title={t("uia_purgeTooltip")}
            >
              {resetting === "purge-units-prefix" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              Purge units…
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => { refetchBatches(); refetchAudit(); }}
          className={`flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-elevated ${isAdmin ? "" : "ml-auto"}`}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {lastRun && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            lastRun.ok
              ? "border-primary/40 bg-primary/5 text-primary"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
        >
          {lastRun.ok ? lastRun.summary : `Run failed: ${lastRun.error}`}
        </div>
      )}

      {lastReset && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            lastReset.ok
              ? "border-info/40 bg-info/5 text-info"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
        >
          {lastReset.ok ? lastReset.summary : `Reset failed: ${lastReset.error}`}
        </div>
      )}

      {/* Recent batches */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{t('uia_recentBatches')}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {(batches ?? []).length}
          </span>
          {/* Status legend — one line, hover any pill on a row to see
              the full tooltip. Helps the office tell "this is fine" from
              "this needs me to do something." */}
          <span className="ml-auto hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${STATUS_TONE.success}`}>success</span>parsed cleanly</span>
            <span className="inline-flex items-center gap-1.5"><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${STATUS_TONE.partial}`}>partial</span>some rows flagged</span>
            <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-slate-500/15 text-slate-300 px-1.5 py-0.5 text-[9px] font-medium">no parser yet</span>planned format</span>
            <span className="inline-flex items-center gap-1.5"><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${STATUS_TONE.failed}`}>failed</span>parser threw — fix needed</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          {batchLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (batches ?? []).length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No batches yet. Run the watcher (manual: <code>node scripts/ingest/run-scan.mjs --commit</code>) or wait for the daily cron.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium w-6" />
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colWhen')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colFile')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colContract')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colFormat')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colStatus')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('uia_colCreated')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('uia_colSkipped')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('uia_colFlagged')}</th>
                </tr>
              </thead>
              <tbody>
                {(batches ?? []).map((b) => {
                  const isOpen = expanded === b.id;
                  const auditEntries = auditByBatch.get(b.id) ?? [];
                  return (
                    <Fragment key={b.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : b.id)}
                        className="border-b border-border last:border-b-0 cursor-pointer transition-colors hover:bg-elevated/30"
                      >
                        <td className="px-2 py-2">
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {fmtTimeShort(b.created_at)}
                        </td>
                        <td className="px-3 py-2 text-foreground truncate max-w-[260px]">
                          {b.drive_file_id && b.drive_file_name ? (
                            <a
                              href={`https://drive.google.com/file/d/${b.drive_file_id}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-foreground hover:text-primary hover:underline"
                              title="Open in Google Drive"
                            >
                              <span className="truncate">{b.drive_file_name}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">{b.drive_file_name ?? "—"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">
                          {b.contracts?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{b.format_tag ?? "—"}</td>
                        <td className="px-3 py-2">
                          {(() => {
                            const sd = statusDetail(b);
                            return (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${sd.tone}`}
                                title={sd.tooltip}
                              >
                                {sd.label}
                                {sd.detail && (
                                  <span className="font-mono text-[9px] opacity-70">
                                    · {sd.detail.length > 28 ? sd.detail.slice(0, 25) + "…" : sd.detail}
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-foreground">{b.rows_created ?? 0}</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{b.rows_skipped ?? 0}</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{b.rows_flagged ?? 0}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-elevated/20">
                          <td colSpan={9} className="px-4 py-3 space-y-3">
                            {/* Show the full error message for failed
                                batches — the badge column truncates. */}
                            {b.error_log && (
                              <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-[11px]">
                                <div className="text-[10px] uppercase tracking-wide text-destructive/80 mb-1">
                                  Error log
                                </div>
                                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-foreground/90">
                                  {JSON.stringify(b.error_log, null, 2)}
                                </pre>
                              </div>
                            )}
                            {auditEntries.length > 0 ? (
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                                  Audit entries ({auditEntries.length})
                                </div>
                                <ul className="space-y-1">
                                  {auditEntries.map((a) => (
                                    <li key={a.id} className="flex items-center gap-2 text-xs">
                                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTION_TONE[a.action] ?? "bg-muted text-muted-foreground"}`}>
                                        {a.action}
                                      </span>
                                      <span className="text-muted-foreground">{fmtTimeShort(a.created_at)}</span>
                                      {a.unit_id && (
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                          unit={a.unit_id.slice(0, 8)}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              !b.error_log && (
                                <div className="text-xs text-muted-foreground">
                                  No audit entries for this batch.
                                </div>
                              )
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 flex items-center gap-2 flex-wrap">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{t('uia_recentActivity')}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {(audit ?? []).length}
          </span>
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => setActionFilter(null)}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                !actionFilter ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-elevated"
              }`}
            >
              All
            </button>
            {Object.entries(actionCounts).map(([action, n]) => (
              <button
                key={action}
                type="button"
                onClick={() => setActionFilter(actionFilter === action ? null : action)}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  actionFilter === action ? ACTION_TONE[action] ?? "border-primary/40" : "border-border text-muted-foreground hover:bg-elevated"
                }`}
              >
                {action} · {n}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          {auditLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (audit ?? []).length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No audit entries match the filter.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colWhen')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colAction')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colLandowner')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colProject')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colUnit')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colSourceFile')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('uia_colChanges')}</th>
                </tr>
              </thead>
              <tbody>
                {(audit ?? []).map((a) => {
                  const fc = a.field_changes as Record<string, unknown> | null;
                  const fcKeys = fc ? Object.keys(fc) : [];
                  // Resolve joined context with friendly fallbacks.
                  // Run the landowner string through detectLandownerFromFolderName
                  // first so "Manulife" / "manulife" / "Hood River
                  // County" / "hood-river" all collapse to the same
                  // canonical key before label lookup. Otherwise the
                  // table shows two distinct rows for what's actually
                  // one landowner.
                  const rawLo = a.batches?.landowner ?? null;
                  const canonicalLo = rawLo ? detectLandownerFromFolderName(rawLo) : null;
                  const loLabel =
                    canonicalLo && canonicalLo !== "unknown"
                      ? LANDOWNER_OPTIONS.find((l) => l.value === canonicalLo)?.label ?? rawLo
                      : rawLo ?? "—";
                  const projectName = a.batches?.contracts?.name ?? "—";
                  const unitName = a.units?.name ?? (a.unit_id ? a.unit_id.slice(0, 8) : "—");
                  return (
                    <tr key={a.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtTimeShort(a.created_at)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTION_TONE[a.action] ?? "bg-muted text-muted-foreground"}`}>
                          {a.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-foreground capitalize">{loLabel}</td>
                      <td className="px-3 py-2 text-foreground truncate max-w-[200px]">{projectName}</td>
                      <td className="px-3 py-2 text-foreground truncate max-w-[200px]">{unitName}</td>
                      <td className="px-3 py-2 truncate max-w-[200px]">
                        {(() => {
                          const driveId = a.batches?.drive_file_id ?? null;
                          const fileName = a.source_file ?? a.batches?.drive_file_name ?? null;
                          if (driveId && fileName) {
                            return (
                              <a
                                href={`https://drive.google.com/file/d/${driveId}/view`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-foreground hover:text-primary hover:underline"
                                title="Open in Google Drive"
                              >
                                <span className="truncate">{fileName}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                              </a>
                            );
                          }
                          return <span className="text-muted-foreground">{fileName ?? "—"}</span>;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {fcKeys.length === 0
                          ? "—"
                          : fcKeys.length === 1 && fcKeys[0] === "_all"
                            ? "all fields (insert)"
                            : `${fcKeys.length} field${fcKeys.length !== 1 ? "s" : ""}: ${fcKeys.slice(0, 3).join(", ")}${fcKeys.length > 3 ? "…" : ""}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Exclusions */}
      <ExcludesSection reviewerName={reviewerName} />

      {/* Subtle note about audit retention / scope */}
      <p className="text-[10px] text-muted-foreground">
        Showing the most recent 100 batches and 200 audit entries. Older history is preserved in the database.
      </p>
    </div>
  );
}

// ─── Exclusions section ─────────────────────────────────────────────────

interface ExcludeRow {
  id: string;
  scope_type: string;
  scope_id: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

// LANDOWNER keys must mirror lib/ingest/landowner-detect.mjs's
// LANDOWNER_FOLDER_KEYWORDS keys. Hardcoded here so the picker doesn't
// need a Drive round-trip; if a key gets added there, add it here too.
const LANDOWNER_OPTIONS = [
  { value: "weyerhaeuser", label: "Weyerhaeuser" },
  { value: "manulife", label: "Manulife" },
  { value: "usace", label: "US Army Corps" },
  { value: "dnr", label: "DNR" },
  { value: "hood-river", label: "Hood River" },
  { value: "chelan-county", label: "Chelan County" },
  { value: "chilton", label: "Chilton" },
  { value: "vaagen-bros", label: "Vaagen Bros" },
  { value: "mcfeg", label: "Mid Columbia Fisheries (MCFEG)" },
  { value: "private", label: "Private" },
];

function ExcludesSection({ reviewerName }: { reviewerName: string }) {
  const { t } = useApp()
  const queryClient = useQueryClient();
  // Cascade: pick a Landowner first, then a Contract under it (or
  // "all"), then a Unit in that contract (or "all"). The scope sent to
  // the API is derived at submit time from the deepest non-"all" pick:
  //   landowner only      → scope_type=landowner, scope_id=landowner key
  //   landowner+contract  → scope_type=contract,  scope_id=contract.id
  //   l+c+unit            → scope_type=unit,      scope_id=unit.id
  // Empty string = nothing picked yet; "all" = explicit "no narrowing
  // at this level."
  const [landowner, setLandowner] = useState("");
  const [contractId, setContractId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [reason, setReason] = useState("");

  const { data: contractsList } = useContracts();
  const { data: unitsList } = useUnits();

  // Filter contracts by the selected landowner. `contracts.landowner`
  // is free-text — the live data has every variation: "Manulife"
  // (capital), "manulife" (lowercase test contracts), "US Army Corps
  // of Engineers" (full name, not the "usace" key), "Hood River
  // County" (long form, not "hood-river"). Direct equality misses
  // anything that doesn't exactly match the dropdown's lowercase key.
  // Run each contract's free-text value through the same detector
  // the ingest scan uses so all variations collapse to one canonical
  // key for comparison.
  const contractsForLandowner = (contractsList ?? []).filter(
    (c) =>
      !landowner ||
      detectLandownerFromFolderName(c.landowner ?? "") === landowner,
  );
  const unitsForContract = (unitsList ?? []).filter(
    (u) => contractId && contractId !== "all" && u.contract_id === contractId,
  );

  // Resolve scope at submit time
  function resolveScope(): { type: string; id: string } | null {
    if (!landowner) return null;
    if (unitId && unitId !== "all") return { type: "unit", id: unitId };
    if (contractId && contractId !== "all") return { type: "contract", id: contractId };
    return { type: "landowner", id: landowner };
  }

  const scopePreview = resolveScope();

  const { data: excludes, isLoading } = useQuery({
    queryKey: ["ingestExcludes"],
    queryFn: async (): Promise<ExcludeRow[]> => {
      const res = await fetch("/api/units/ingest-excludes");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.excludes ?? []) as ExcludeRow[];
    },
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const scope = resolveScope();
      if (!scope) throw new Error("Pick a landowner first");
      const res = await fetch("/api/units/ingest-excludes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope_type: scope.type,
          scope_id: scope.id,
          reason: reason.trim() || null,
          created_by: reviewerName,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Add failed: ${res.status}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestExcludes"] });
      setLandowner("");
      setContractId("");
      setUnitId("");
      setReason("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/units/ingest-excludes?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ingestExcludes"] }),
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3 flex items-center gap-2">
        <Ban className="h-4 w-4 text-rose-300" />
        <span className="text-sm font-semibold text-foreground">{t('uia_excludesHeading')}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {(excludes ?? []).length}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          The orchestrator skips matching landowners / contracts / units on every run.
        </span>
      </div>

      {/* Cascading add form. Pick a Landowner, then optionally narrow
          to a Contract under it, then optionally to a single Unit. The
          deepest non-"all" pick determines the scope of the saved
          exclusion. A live preview at the bottom of the row shows what
          will actually be excluded so the office can sanity-check
          before clicking Add. */}
      <div className="border-b border-border bg-elevated/20 px-4 py-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Landowner *
            </label>
            <select
              value={landowner}
              onChange={(e) => {
                setLandowner(e.target.value);
                setContractId("");
                setUnitId("");
              }}
              className="h-8 rounded-md border border-border bg-elevated px-2 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">— pick landowner —</option>
              {LANDOWNER_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[260px]">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Contract
            </label>
            <select
              value={contractId}
              onChange={(e) => {
                setContractId(e.target.value);
                setUnitId(""); // unit no longer valid in different contract
              }}
              disabled={!landowner}
              className="h-8 rounded-md border border-border bg-elevated px-2 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">— pick contract —</option>
              <option value="all">{t('uia_allContractsLandowner')}</option>
              {contractsForLandowner
                .slice()
                .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Unit
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={!contractId || contractId === "all"}
              className="h-8 rounded-md border border-border bg-elevated px-2 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">— pick unit —</option>
              <option value="all">{t('uia_allUnitsContract')}</option>
              {unitsForContract
                .slice()
                .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="why this is excluded"
              className="h-8 rounded-md border border-border bg-elevated px-2 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => addMutation.mutate()}
            disabled={!scopePreview || addMutation.isPending}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </button>
        </div>

        {/* Live scope preview — confirms what will get saved before
            click. Mirrors how the orchestrator reads the row. */}
        <div className="text-[10px] text-muted-foreground">
          {!scopePreview ? (
            <span>{t('uia_pickLandowner')}</span>
          ) : scopePreview.type === "landowner" ? (
            <span>
              Will exclude <strong className="text-foreground">all {LANDOWNER_OPTIONS.find((l) => l.value === scopePreview.id)?.label ?? scopePreview.id} contracts + units</strong> from every ingest run.
            </span>
          ) : scopePreview.type === "contract" ? (
            <span>
              Will exclude <strong className="text-foreground">all units inside {(contractsList ?? []).find((c) => c.id === scopePreview.id)?.name ?? scopePreview.id}</strong>.
            </span>
          ) : (
            <span>
              Will exclude just <strong className="text-foreground">{(unitsList ?? []).find((u) => u.id === scopePreview.id)?.name ?? scopePreview.id}</strong>.
            </span>
          )}
        </div>
      </div>
      {addMutation.isError && (
        <div className="border-b border-border bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {addMutation.error instanceof Error ? addMutation.error.message : "Add failed"}
        </div>
      )}

      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (excludes ?? []).length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            No exclusions. The ingest pipeline runs against everything.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">{t('uia_colScope')}</th>
                <th className="px-3 py-2 text-left font-medium">ID</th>
                <th className="px-3 py-2 text-left font-medium">{t('uia_colReason')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('uia_colAddedBy')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('uia_colAdded')}</th>
                <th className="px-3 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {(excludes ?? []).map((e) => {
                // Resolve scope_id → friendly label so the table doesn't
                // show a wall of UUIDs. Fall back to the raw value if
                // the matching record isn't loaded (e.g. archived
                // contract not in useContracts cache).
                let friendly = e.scope_id;
                if (e.scope_type === "landowner") {
                  // Older exclusions might've been added with the
                  // free-text scope_id (e.g. "Manulife" capital). Run
                  // through canonical detection before label lookup so
                  // both casings render the same way.
                  const canonical = detectLandownerFromFolderName(e.scope_id);
                  friendly =
                    LANDOWNER_OPTIONS.find((l) => l.value === canonical)?.label ?? e.scope_id;
                } else if (e.scope_type === "contract") {
                  friendly = (contractsList ?? []).find((c) => c.id === e.scope_id)?.name ?? e.scope_id;
                } else if (e.scope_type === "unit") {
                  friendly = (unitsList ?? []).find((u) => u.id === e.scope_id)?.name ?? e.scope_id;
                }
                return (
                <tr key={e.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-foreground font-medium capitalize">{e.scope_type}</td>
                  <td className="px-3 py-2 text-foreground">
                    <div>{friendly}</div>
                    {friendly !== e.scope_id && (
                      <div className="font-mono text-[10px] text-muted-foreground">{e.scope_id}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.reason ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.created_by ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtTimeShort(e.created_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(e.id)}
                      disabled={deleteMutation.isPending}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      title={t("uia_removeExclusion")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function fmtTimeShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
        " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
