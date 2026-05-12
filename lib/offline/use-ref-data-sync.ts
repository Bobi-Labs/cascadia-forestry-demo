'use client'

import { useEffect, useRef } from 'react'
import { syncAllRefData } from './ref-data-sync'
import { REF_DATA_SYNC_INTERVAL_MS } from './constants'
import { useOnlineStatus } from './use-online-status'

/**
 * Hook that keeps reference data synced to IndexedDB in the background.
 * Syncs on mount (if online), every 15 minutes, and when coming back online.
 */
export function useRefDataSync() {
  const isOnline = useOnlineStatus()
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  // Sync on mount and when coming back online
  useEffect(() => {
    if (isOnline) {
      syncAllRefData().catch(() => {})
    }
  }, [isOnline])

  // Periodic sync
  useEffect(() => {
    if (isOnline) {
      intervalRef.current = setInterval(() => {
        syncAllRefData().catch(() => {})
      }, REF_DATA_SYNC_INTERVAL_MS)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isOnline])
}
