"use client"

import { AppProvider } from '@/lib/app-context'
import { DashboardShell } from '@/components/dashboard-shell'
import { useAuth } from '@/lib/auth-context'
import { Loader2, TreePine } from 'lucide-react'

// Render on demand. The dashboard is interactive and depends on client-side
// auth context, so static prerender adds no value and hits issues when
// fixture data exercises code paths that expect window/navigator/etc.
export const dynamic = "force-dynamic"

function LoadingScreen() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-500/10">
          <TreePine className="h-8 w-8 text-green-500" />
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  )
}

export default function Home() {
  const { user, isLoading, profile, signOut } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  // User is authenticated but profile fetch failed (RLS issue, expired session, etc.)
  // Show recovery options instead of spinning forever
  if (user && !profile) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10">
            <TreePine className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Session Error</h2>
          <p className="text-sm text-muted-foreground">
            Could not load your profile. This usually fixes itself — try refreshing.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Refresh Page
            </button>
            <button
              onClick={() => signOut()}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-elevated"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Middleware handles redirect for unauthenticated users,
  // but guard against flash of content while redirecting
  if (!profile) {
    return <LoadingScreen />
  }

  return (
    <AppProvider>
      <DashboardShell />
    </AppProvider>
  )
}
