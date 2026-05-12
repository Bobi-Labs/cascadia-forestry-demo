/**
 * Raw PostgREST fetcher — bypasses supabase-js entirely for SELECT
 * queries that have been observed to wedge in the supabase-js v2
 * client even when the equivalent curl request returns instantly.
 *
 * The pattern that triggered this was the deliverable_* table reads:
 * `tracker_items` queries (different table, same client) work fine,
 * but every `deliverable_*` query through `supabase.from(...)` hangs
 * indefinitely, even after we eliminated nested embeds and
 * foreign-table ordering as variables. Raw fetch sidesteps the
 * entire supabase-js fetch wrapper.
 *
 * This is a deliberate workaround. We keep `supabase.from(...)` for
 * reads on tables that don't exhibit the wedge, and for all writes
 * (which need the supabase-js mutation builders).
 *
 * Mirrored from C:/dev/bobi-worktracker/lib/supabase/raw-rest.ts —
 * see docs/MIRROR_TO_FORESTRY.md (in bobi-worktracker) for the full
 * diagnostic story.
 */

import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

interface RawSelectOptions {
  /** Hard timeout in ms; aborts the fetch and rejects. Default 5000. */
  timeout?: number;
  /** Diagnostic label for console logs. */
  label?: string;
}

/**
 * GET against PostgREST with the user's current JWT (or anon key if
 * the session can't be loaded fast). Path is everything after
 * `/rest/v1/` — table name + query string.
 *
 * Example:
 *   await rawSelect<DeliverableItem[]>(
 *     `deliverable_items?select=*&is_demo=eq.true&order=sort_order.asc`,
 *     { label: "deliverableItems" }
 *   );
 */
export async function rawSelect<T>(
  path: string,
  options: RawSelectOptions = {},
): Promise<T> {
  const { timeout = 5000, label = "rawSelect" } = options;

  // Try to load the current session for the auth header. If
  // getSession() itself hangs (a separate failure mode we've seen
  // adjacent to this bug), fall back to anon after 1s — anon RLS on
  // these tables already allows the reads we need on the demo deploy.
  const supabase = createClient();
  const sessionRace = await Promise.race([
    supabase.auth.getSession().then((r) => r.data.session),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
  ]);
  const token = sessionRace?.access_token ?? SUPABASE_ANON_KEY;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  const startedAt = performance.now();
  console.log(`[${label}] raw fetch start`);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      throw new Error(`${label} HTTP ${res.status}: ${text}`);
    }
    const data = (await res.json()) as T;
    const elapsed = Math.round(performance.now() - startedAt);
    const len = Array.isArray(data) ? data.length : 1;
    console.log(`[${label}] raw fetch ok: ${len} in ${elapsed}ms`);
    return data;
  } catch (e) {
    clearTimeout(timer);
    const elapsed = Math.round(performance.now() - startedAt);
    if (e instanceof Error && e.name === "AbortError") {
      console.error(`[${label}] raw fetch failed after ${timeout}ms (timeout)`);
      throw new Error(`${label} timed out after ${timeout}ms`);
    }
    console.error(`[${label}] raw fetch failed in ${elapsed}ms:`, e);
    throw e;
  }
}
