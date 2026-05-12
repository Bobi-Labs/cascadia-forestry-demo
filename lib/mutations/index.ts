/**
 * Mutation registry — pairs each mutation function with its invalidation keys.
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
import { assignExpense } from "./assign-expense";
import { unassignExpense } from "./unassign-expense";
import { deleteExpense } from "./delete-expense";
import { createTrackerItem } from "./create-tracker-item";
import { updateTrackerItem } from "./update-tracker-item";
import { deleteTrackerItem } from "./delete-tracker-item";
import { createEmployee } from "./create-employee";
import { createTrackerNote } from "./create-tracker-note";
import { updateTrackerItemsBulk } from "./update-tracker-items-bulk";
import { updateTrackerItemOrder } from "./update-tracker-item-order";

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
  // Expenses
  assignExpense: {
    fn: assignExpense,
    invalidates: () => [
      queryKeys.pendingExpenses(),
      queryKeys.contractExpenses("*"),
      queryKeys.allExpenses(),
      queryKeys.expenseActivity(),
    ],
  },
  unassignExpense: {
    fn: unassignExpense,
    invalidates: () => [
      queryKeys.pendingExpenses(),
      queryKeys.contractExpenses("*"),
      queryKeys.allExpenses(),
      queryKeys.expenseActivity(),
    ],
  },
  deleteExpense: {
    fn: deleteExpense,
    invalidates: () => [
      queryKeys.pendingExpenses(),
      queryKeys.flaggedExpenses(),
      queryKeys.allExpenses(),
      queryKeys.expenseActivity(),
    ],
  },
  // Tracker
  createTrackerItem: {
    fn: createTrackerItem,
    invalidates: () => [queryKeys.trackerItems("*")],
  },
  updateTrackerItem: {
    fn: updateTrackerItem,
    invalidates: () => [queryKeys.trackerItems("*")],
  },
  deleteTrackerItem: {
    fn: deleteTrackerItem,
    invalidates: () => [queryKeys.trackerItems("*")],
  },
  createTrackerNote: {
    fn: createTrackerNote,
    invalidates: () => [queryKeys.trackerNotes("*")],
  },
  updateTrackerItemsBulk: {
    fn: updateTrackerItemsBulk,
    invalidates: () => [queryKeys.trackerItems("*")],
  },
  updateTrackerItemOrder: {
    fn: updateTrackerItemOrder,
    invalidates: () => [queryKeys.trackerItems("*")],
  },
} as const;

export type MutationName = keyof typeof mutations;
