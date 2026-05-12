/**
 * Supabase client factories for the test suite.
 *
 * Both clients use the trimmed env-var loader — same defense-in-depth
 * against trailing-whitespace corruption.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { requireEnv, trimEnv } from "./_drive";

export function serviceRoleClient(): SupabaseClient {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient {
  const key = trimEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || trimEnv("SUPABASE_ANON_KEY");
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY");
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
