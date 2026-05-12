import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];

/**
 * Compile-time drift check for Zod schemas against DB Insert types.
 *
 * Errors at build time if the Zod output type has a field whose type
 * doesn't match the corresponding column in the DB Insert type.
 * Run `./ops.sh gen-types` after schema changes to trigger the check.
 *
 * Usage (one line per schema):
 *   type _Check = AssertInsertMatch<CreateContractInput, "contracts">;
 */
export type AssertInsertMatch<
  TInput,
  TTable extends keyof Tables,
> = TInput extends Pick<Tables[TTable]["Insert"], keyof TInput & keyof Tables[TTable]["Insert"]>
  ? true
  : { error: "Zod schema does not match DB Insert type"; table: TTable; input: TInput };
