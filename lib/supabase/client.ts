import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'
import { IS_DEMO_MODE } from '@/lib/demo-mode'

/**
 * Browser-side Supabase client factory.
 *
 * In demo mode (NEXT_PUBLIC_FORESTRY_DEMO_MODE=true), returns a stub
 * that never makes network calls. The query/mutation registries are
 * supposed to short-circuit BEFORE constructing a client in demo mode,
 * so this stub is a safety net: if any code path slips through, it
 * returns null data instead of crashing.
 *
 * Defense in depth: if demo mode is on AND Supabase env vars are also
 * set, the build refuses to proceed. The whole point of the demo is
 * that there is no DB; finding URL/ANON_KEY in the env at demo-build
 * time means someone misconfigured Vercel and we want a loud failure,
 * not a silent leak path.
 */
export function createClient() {
  if (IS_DEMO_MODE) {
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      throw new Error(
        'Demo mode is on but Supabase env vars are set. Refusing to construct a real client. Remove NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from this deployment.',
      )
    }
    return createDemoStubClient()
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/**
 * No-network stub used in demo mode. Supports the from(...).select(...)
 * chain plus the auth surface that auth-context touches. Every read
 * resolves to { data: null, error: null }; every auth method resolves
 * to a logged-out state.
 */
function createDemoStubClient() {
  const stubResult = { data: null, error: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryBuilder: any = new Proxy(() => queryBuilder, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: typeof stubResult) => unknown) =>
          resolve(stubResult)
      }
      return queryBuilder
    },
  })

  const stub = {
    from: () => queryBuilder,
    rpc: () => queryBuilder,
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onAuthStateChange: (_cb: (...args: unknown[]) => void) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    removeChannel: () => {},
  }

  return stub as unknown as ReturnType<typeof createBrowserClient<Database>>
}
