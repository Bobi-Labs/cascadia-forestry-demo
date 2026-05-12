import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { mutations, type MutationName } from "@/lib/mutations";

type MutationFn<K extends MutationName> = (typeof mutations)[K]["fn"];
type MutationVars<K extends MutationName> = Parameters<MutationFn<K>>[0];
type MutationData<K extends MutationName> = Awaited<ReturnType<MutationFn<K>>>;

/**
 * Type-safe mutation hook. Pick a registered mutation name and the hook
 * calls the paired fn + invalidates the right queries on success.
 *
 * The explicit return type forces TypeScript to narrow the generic K all
 * the way through to mutate(), so callers get accurate input typing
 * instead of the union of all mutation input types.
 *
 * const mutation = useClientMutation("createContract", {
 *   onSuccess: (result) => { if (result.success) toast.success("Created!"); },
 * });
 * mutation.mutate(formData);
 */
export default function useClientMutation<K extends MutationName>(
  name: K,
  options?: {
    onSuccess?: (data: MutationData<K>) => void;
    onError?: (error: Error) => void;
  },
): UseMutationResult<MutationData<K>, Error, MutationVars<K>> {
  const queryClient = useQueryClient();
  const { fn, invalidates } = mutations[name];

  return useMutation<MutationData<K>, Error, MutationVars<K>>({
    mutationFn: fn as (vars: MutationVars<K>) => Promise<MutationData<K>>,
    onSuccess: (data) => {
      for (const key of invalidates()) {
        queryClient.invalidateQueries({ queryKey: [...key] });
      }
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}
