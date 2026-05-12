/**
 * Mutation registry. Pairs each mutation function with its invalidation keys.
 *
 * useClientMutation enforces this pairing: you pick a name from this registry
 * and the hook calls the right fn + invalidates the right queries on success.
 * `invalidates` is a function so it can compute keys dynamically if needed.
 */
import { queryKeys } from "@/lib/query-keys";
import { createContract } from "./create-contract";
import { updateContract } from "./update-contract";
import { updateEmployee } from "./update-employee";
import { createCrewSet } from "./create-crew-set";
import { updateCrewSet } from "./update-crew-set";
import { deleteCrewSet } from "./delete-crew-set";
import { createUnit } from "./create-unit";
import { updateUnit } from "./update-unit";
import { deleteUnit } from "./delete-unit";
import { createEmployee } from "./create-employee";

export const mutations = {
  createContract: {
    fn: createContract,
    invalidates: () => [queryKeys.contracts()],
  },
  updateContract: {
    fn: updateContract,
    invalidates: () => [queryKeys.contracts()],
  },
  createUnit: {
    fn: createUnit,
    invalidates: () => [queryKeys.units()],
  },
  updateUnit: {
    fn: updateUnit,
    invalidates: () => [queryKeys.units()],
  },
  deleteUnit: {
    fn: deleteUnit,
    invalidates: () => [queryKeys.units()],
  },
  updateEmployee: {
    fn: updateEmployee,
    invalidates: () => [queryKeys.employees()],
  },
  createEmployee: {
    fn: createEmployee,
    invalidates: () => [queryKeys.employees()],
  },
  createCrewSet: {
    fn: createCrewSet,
    invalidates: () => [queryKeys.crewSets()],
  },
  updateCrewSet: {
    fn: updateCrewSet,
    invalidates: () => [queryKeys.crewSets()],
  },
  deleteCrewSet: {
    fn: deleteCrewSet,
    invalidates: () => [queryKeys.crewSets()],
  },
} as const;

export type MutationName = keyof typeof mutations;
