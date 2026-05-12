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
 * No-network stub used in demo mode. Supports the chainable surface
 * that supabase-js exposes (from, storage, auth, rpc, channel, etc.)
 * via a recursive Proxy. Every chained method returns the same proxy,
 * every await resolves to { data: null, error: null }, every iterable
 * returns empty.
 *
 * The auth surface is hand-rolled because callers destructure specific
 * shapes (session.user, subscription.unsubscribe) that need to be real
 * properties, not proxy traps.
 */
function createDemoStubClient() {
  const stubResult = { data: null, error: null }

  // Recursive chainable proxy. Any property access returns the same
  // proxy; calling it returns the same proxy; awaiting or .then-ing
  // it resolves to the stub result via a real native Promise (so
  // subsequent .catch/.finally chain correctly). Covers
  // .from(...).select(...).eq(...).order(...), .storage.from(...).list(...),
  // .rpc(...).select(...), and so on.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = new Proxy(() => chain, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: unknown, reject: unknown) =>
          Promise.resolve(stubResult).then(
            resolve as never,
            reject as never,
          )
      }
      if (prop === 'catch') {
        return (reject: unknown) =>
          Promise.resolve(stubResult).catch(reject as never)
      }
      if (prop === 'finally') {
        return (cb: unknown) =>
          Promise.resolve(stubResult).finally(cb as never)
      }
      if (prop === Symbol.iterator) {
        return function* () {}
      }
      return chain
    },
  })

  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    refreshSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onAuthStateChange: (_cb: (...args: unknown[]) => void) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  }

  // Outer proxy: chainable everything except `auth`, which needs real
  // object shapes for destructuring.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'auth') return auth
        if (prop === 'then') return undefined
        return chain
      },
    },
  )

  return stub as unknown as ReturnType<typeof createBrowserClient<Database>>
}
