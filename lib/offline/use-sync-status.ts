'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { onSyncEvent, processQueue, type SyncEvent } from './sync-engine'
import { getAllSubmissions, getPendingCount } from './offline-queue'
import { SYNC_POLL_INTERVAL_MS } from './constants'
import type { PendingSubmission } from './db'
import { useOnlineStatus } from './use-online-status'

export interface SyncStatus {
  /** Number of submissions waiting to sync */
  pendingCount: number
  /** Currently syncing */
  isSyncing: boolean
  /** All submissions (for detail view) */
  submissions: PendingSubmission[]
  /** Last sync event message (for toasts) */
  lastEvent: SyncEvent | null
  /** Manually trigger sync */
  triggerSync: () => void
  /** Refresh the submissions list */
  refresh: () => void
}

export function useSyncStatus(): SyncStatus {
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([])
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  const refresh = useCallback(async () => {
    try {
      const count = await getPendingCount()
      setPendingCount(count)
      const all = await getAllSubmissions()
      setSubmissions(all)
    } catch {
      // IndexedDB might not be available (SSR, etc.)
    }
  }, [])

  // Listen to sync events
  useEffect(() => {
    const unsub = onSyncEvent((event) => {
      setLastEvent(event)

      if (event.type === 'sync-start') {
        setIsSyncing(true)
      }
      if (event.type === 'sync-complete') {
        setIsSyncing(false)
        refresh()
      }
      if (event.type === 'sync-progress' || event.type === 'sync-error') {
        refresh()
      }
    })

    return unsub
  }, [refresh])

  // Trigger sync on connectivity changes
  useEffect(() => {
    if (isOnline) {
      processQueue()
    }
  }, [isOnline])

  // Trigger sync on visibility change (app comes to foreground)
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        processQueue()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // Periodic poll when online
  useEffect(() => {
    if (isOnline) {
      pollRef.current = setInterval(() => {
        processQueue()
        refresh()
      }, SYNC_POLL_INTERVAL_MS)
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isOnline, refresh])

  // Initial load
  useEffect(() => {
    refresh()
  }, [refresh])

  const triggerSync = useCallback(() => {
    processQueue()
  }, [])

  return {
    pendingCount,
    isSyncing,
    submissions,
    lastEvent,
    triggerSync,
    refresh,
  }
}
