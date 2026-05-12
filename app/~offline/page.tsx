'use client'

import { WifiOff, TreePine } from 'lucide-react'

/**
 * Offline fallback page — shown when SW can't serve a cached page.
 * This is the last resort; in normal offline flow, the cached app shell loads instead.
 */
export default function OfflineFallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-warning/10">
        <WifiOff className="h-10 w-10 text-warning" />
      </div>

      <div className="mb-2 flex items-center gap-2">
        <TreePine className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Cascadia Ops</h1>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-foreground">
        {"You're offline"}
      </h2>

      <p className="mb-8 max-w-sm text-sm text-muted-foreground">
        {"The app couldn't load because you're not connected to the internet. Please check your connection and try again."}
      </p>

      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        style={{ minHeight: '48px' }}
      >
        Try Again
      </button>
    </div>
  )
}
