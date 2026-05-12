'use client'

import { WifiOff, CloudUpload } from 'lucide-react'
import { useOnlineStatus } from '@/lib/offline/use-online-status'
import { useSyncStatus } from '@/lib/offline/use-sync-status'

/**
 * Amber banner shown when the user is offline.
 * Fixed at the top of the viewport, above the topbar.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const { pendingCount } = useSyncStatus()

  if (isOnline) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning/90 px-4 py-2 text-warning-foreground backdrop-blur-sm">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="text-xs font-medium sm:text-sm">
        {"You're offline"}
        {pendingCount > 0 && (
          <>
            {' — '}
            <CloudUpload className="inline h-3.5 w-3.5" />
            {' '}
            {pendingCount} timesheet{pendingCount !== 1 ? 's' : ''} will sync when connected
          </>
        )}
      </span>
    </div>
  )
}
