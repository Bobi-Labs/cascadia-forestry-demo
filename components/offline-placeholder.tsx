'use client'

import { WifiOff, FileText } from 'lucide-react'
import { useApp } from '@/lib/app-context'

/**
 * Placeholder shown for non-timesheet pages when offline.
 * Offers a quick link to the timesheet (the only fully offline-capable page).
 */
export function OfflinePlaceholder() {
  const { role, setActivePage } = useApp()
  const isForeman = role === 'foreman'

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted/30">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
      </div>

      <h2 className="mb-2 text-lg font-semibold text-foreground">
        {"You're offline"}
      </h2>

      <p className="mb-8 max-w-sm text-sm text-muted-foreground">
        This page needs an internet connection to load data. You can still submit timesheets while offline.
      </p>

      <button
        onClick={() => setActivePage(isForeman ? 'submitTimesheet' : 'officeTimesheet')}
        className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        style={{ minHeight: '48px' }}
      >
        <FileText className="h-4 w-4" />
        Go to Timesheet
      </button>
    </div>
  )
}
