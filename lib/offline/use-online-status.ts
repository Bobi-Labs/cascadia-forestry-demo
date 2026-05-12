'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook that tracks online/offline connectivity state.
 * Uses navigator.onLine + event listeners for real-time updates.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  const goOnline = useCallback(() => setIsOnline(true), [])
  const goOffline = useCallback(() => setIsOnline(false), [])

  useEffect(() => {
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    // Sync with current state on mount
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [goOnline, goOffline])

  return isOnline
}
