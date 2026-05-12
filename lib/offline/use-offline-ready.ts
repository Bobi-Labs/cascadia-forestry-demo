'use client'

import { useState, useEffect } from 'react'
import { getCachedUserProfile } from './cached-auth'
import { getRefDataAge } from './ref-data-sync'
import { REF_DATA_STALE_WARNING_MS } from './constants'

export interface OfflineReadiness {
  /** Is all required data cached for offline timesheet? */
  isReady: boolean
  /** Is reference data stale (>24h old)? */
  isStale: boolean
  /** Age of oldest reference data in ms, or null if not cached */
  refDataAgeMs: number | null
  /** Is user identity cached? */
  hasAuth: boolean
}

/**
 * Hook to check if the app has enough cached data to function offline.
 */
export function useOfflineReady(): OfflineReadiness {
  const [state, setState] = useState<OfflineReadiness>({
    isReady: false,
    isStale: false,
    refDataAgeMs: null,
    hasAuth: false,
  })

  useEffect(() => {
    async function check() {
      try {
        const [auth, ageMs] = await Promise.all([
          getCachedUserProfile(),
          getRefDataAge(),
        ])

        const hasAuth = auth !== null
        const hasRefData = ageMs !== null
        const isStale = ageMs !== null && ageMs > REF_DATA_STALE_WARNING_MS

        setState({
          isReady: hasAuth && hasRefData,
          isStale,
          refDataAgeMs: ageMs,
          hasAuth,
        })
      } catch {
        // IndexedDB not available
      }
    }

    check()
    // Re-check periodically (every 30s)
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [])

  return state
}
