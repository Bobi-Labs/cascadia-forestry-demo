'use client'

import { useState, useEffect, useRef } from 'react'
import { CloudUpload, AlertTriangle, Loader2, X, Trash2, CheckCircle2 } from 'lucide-react'
import { useSyncStatus } from '@/lib/offline/use-sync-status'
import { deleteSubmission } from '@/lib/offline/offline-queue'
import { useOnlineStatus } from '@/lib/offline/use-online-status'

/** How long the "all synced" confirmation stays visible (ms) */
const SYNCED_LINGER_MS = 5000

/**
 * Sync status badge for the topbar.
 * Shows pending count, syncing spinner, success confirmation, or nothing when clear.
 * Tappable to reveal a detail panel of queued submissions.
 */
export function SyncStatusBadge() {
  const isOnline = useOnlineStatus()
  const { pendingCount, isSyncing, submissions, lastEvent, triggerSync, refresh } = useSyncStatus()
  const [panelOpen, setPanelOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'warning' } | null>(null)
  const [recentlySynced, setRecentlySynced] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Show toast and linger state on sync events
  useEffect(() => {
    if (!lastEvent) return

    if (lastEvent.type === 'sync-complete' && lastEvent.synced > 0) {
      const msg = `${lastEvent.synced} timesheet${lastEvent.synced !== 1 ? 's' : ''} synced`
      setToast({ message: msg, variant: 'success' })
      setRecentlySynced(true)
      const toastTimer = setTimeout(() => setToast(null), SYNCED_LINGER_MS)
      const lingerTimer = setTimeout(() => setRecentlySynced(false), SYNCED_LINGER_MS)
      return () => { clearTimeout(toastTimer); clearTimeout(lingerTimer) }
    }

    if (lastEvent.type === 'auth-required') {
      setToast({ message: 'Please sign in to sync timesheets', variant: 'warning' })
      const timer = setTimeout(() => setToast(null), 6000)
      return () => clearTimeout(timer)
    }
  }, [lastEvent])

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    if (panelOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [panelOpen])

  // Nothing to show — but stay visible during the linger period after sync
  const activeSubmissions = submissions.filter(s => s.status !== 'synced')
  if (pendingCount === 0 && !isSyncing && activeSubmissions.length === 0 && !recentlySynced) return null

  async function handleDelete(id: string) {
    await deleteSubmission(id)
    refresh()
  }

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 animate-in slide-in-from-bottom-4">
          <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg ${
            toast.variant === 'success'
              ? 'bg-primary/10 border-primary/30'
              : 'bg-card border-border'
          }`}>
            {toast.variant === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-warning" />
            )}
            <span className="text-sm font-medium text-foreground">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Badge */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className={`relative flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-elevated hover:text-foreground ${
            recentlySynced && pendingCount === 0
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground'
          }`}
          title={
            recentlySynced && pendingCount === 0
              ? 'All timesheets synced'
              : `${pendingCount} pending timesheet${pendingCount !== 1 ? 's' : ''}`
          }
        >
          {isSyncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : recentlySynced && pendingCount === 0 ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          ) : (
            <CloudUpload className="h-3.5 w-3.5" />
          )}
          {pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[9px] font-bold text-warning-foreground">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>

        {/* Detail panel */}
        {panelOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Offline Submissions</span>
              {isOnline && pendingCount > 0 && (
                <button
                  onClick={triggerSync}
                  className="text-xs font-medium text-primary hover:text-primary/80"
                >
                  Sync Now
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto p-2">
              {activeSubmissions.length === 0 ? (
                <div className="py-6 text-center">
                  {recentlySynced ? (
                    <>
                      <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-primary" />
                      <p className="text-sm font-medium text-foreground">All synced</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Timesheets submitted successfully</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">All caught up</p>
                  )}
                </div>
              ) : (
                activeSubmissions.map(s => (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 rounded-md px-3 py-2.5"
                  >
                    <div className="mt-0.5">
                      {s.status === 'pending' && <CloudUpload className="h-4 w-4 text-warning" />}
                      {s.status === 'syncing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {s.status === 'failed' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {s.contractName}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.date}</div>
                      {s.status === 'failed' && s.lastError && (
                        <div className="mt-1 text-xs text-destructive">{s.lastError}</div>
                      )}
                    </div>
                    {s.status === 'failed' && (
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="mt-0.5 text-muted-foreground hover:text-destructive"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
