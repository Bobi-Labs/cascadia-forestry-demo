/**
 * Pagination helper for Supabase SELECT queries that may exceed
 * the default 1000-row cap.
 *
 * PostgREST silently truncates SELECT results at 1000 rows by
 * default. Callers that don't paginate will work fine until a
 * table grows past that line, at which point data starts vanishing
 * with no error. We've been bitten by this on the timesheet
 * backfill (Apr 27) and the pattern is documented as known-issue
 * #8 in CLAUDE.md.
 *
 * Usage:
 *   const all = await paginatedSelect((from, to) =>
 *     supabase
 *       .from("expenses")
 *       .select("*, employees(*)")
 *       .order("expense_date", { ascending: false })
 *       .range(from, to),
 *   );
 *
 * The builder receives the page bounds and must return the
 * Supabase query result Promise (with `.range(from, to)` already
 * applied). The helper handles loop termination + error surfacing.
 *
 * Page size defaults to 1000 to match the PostgREST default. Hard
 * cap on total pages prevents runaway loops if a query is
 * misconfigured.
 */

// Loose result type — Supabase's PostgrestFilterBuilder satisfies it
// but its `then` signature is stricter than a plain PromiseLike. We
// erase the `data` row type to `unknown` so any builder shape compiles,
// and cast back to T[] inside the loop. The caller's <T> is
// load-bearing for the return type.
type LoosePageResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};
type LooseBuilder = PromiseLike<LoosePageResult> & {
  // Supabase builders are thenables — accepting any awaitable shape
  // here keeps the call sites clean without type assertions.
  [Symbol.toStringTag]?: string;
};

interface Options {
  /** Page size; default 1000 (matches PostgREST cap). */
  pageSize?: number;
  /** Hard cap on total pages; default 100 (= 100k rows max). */
  maxPages?: number;
}

export async function paginatedSelect<T>(
  buildPage: (from: number, to: number) => LooseBuilder,
  options: Options = {},
): Promise<T[]> {
  const { pageSize = 1000, maxPages = 100 } = options;
  const all: T[] = [];
  let pageStart = 0;
  let pageCount = 0;

  while (pageCount < maxPages) {
    const { data, error } = await buildPage(pageStart, pageStart + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    pageStart += pageSize;
    pageCount += 1;
  }

  if (pageCount >= maxPages) {
    console.warn(
      `paginatedSelect hit maxPages=${maxPages} (${all.length} rows) — query may be missing data. Increase maxPages or add a filter.`,
    );
  }

  return all;
}
