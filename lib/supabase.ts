/**
 * Re-export the SSR-aware browser client as a singleton.
 *
 * IMPORTANT: This replaces the old raw `createClient` from @supabase/supabase-js.
 * The old client had NO session awareness — it always queried as `anon`,
 * so RLS policies blocked all data once dev_anon bypass policies were removed.
 *
 * The SSR-aware client from @supabase/ssr reads session cookies automatically,
 * so queries carry the authenticated user's JWT and RLS works correctly.
 */
import { createClient } from '@/lib/supabase/client'

export const supabase = createClient()
