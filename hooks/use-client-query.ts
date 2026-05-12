import { useQuery } from "@tanstack/react-query";
import { queries, type QueryName } from "@/lib/queries";

type QueryFn<K extends QueryName> = (typeof queries)[K]["fn"];
type QueryResult<K extends QueryName> = Awaited<ReturnType<QueryFn<K>>>;

/**
 * Type-safe query hook. Pick a registered query name and the hook
 * calls the paired key factory + query function automatically.
 * Return type is inferred from the query function's return type.
 *
 * useClientQuery("contracts")       // data is typed from DB schema
 * useClientQuery("timesheets", id)  // params are type-checked
 */
export default function useClientQuery<K extends QueryName>(
  name: K,
  ...args: Parameters<(typeof queries)[K]["key"]>
) {
  const { key, fn } = queries[name];

  return useQuery<QueryResult<K>>({
    queryKey: [...(key as (...a: any[]) => readonly unknown[])(...args)],
    queryFn: () => (fn as (...a: any[]) => Promise<QueryResult<K>>)(...args),
    staleTime: 2 * 60 * 1000, // 2 minutes — don't refetch on every navigation
    gcTime: 10 * 60 * 1000,   // 10 minutes — keep cache for a while
  });
}
