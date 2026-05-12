import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig, RuntimeCaching } from 'serwist'
import { Serwist, NetworkOnly } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis & { __SW_MANIFEST: (PrecacheEntry | string)[] | undefined }

// ────────────────────────────────────────────────────────────────────
// IMPORTANT: bypass the service worker entirely for Supabase API calls.
//
// @serwist/next's `defaultCache` has a `cross-origin` rule using
// NetworkFirst strategy that catches every non-same-origin request —
// including every call to our Supabase REST endpoint. Under any network
// hiccup (slow wifi, cold response, transient timeout) it falls back to
// serving stale cached data, which is why the /tracker Deliverables and
// Ongoing tabs were needing hard-refreshes to show fresh data.
//
// Supabase has its own cache semantics (via cache-control headers) and
// TanStack Query handles client-side caching above this layer. Stacking
// a third cache layer (the SW) on top causes the stale-data problem
// without adding value — auth-gated per-user data shouldn't be cached
// at the SW level anyway.
//
// This rule runs FIRST (matched by URL host), forcing NetworkOnly for
// Supabase and everything-else falls through to the defaultCache rules.
// ────────────────────────────────────────────────────────────────────
const SUPABASE_HOST_SUFFIX = '.supabase.co'

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ url }) => url.hostname.endsWith(SUPABASE_HOST_SUFFIX),
    handler: new NetworkOnly(),
  },
  ...defaultCache,
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        revision: crypto.randomUUID(),
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()
