/**
 * Query registry. Pairs each key factory with its query function.
 *
 * useClientQuery enforces this pairing: you pick a name from this registry
 * and the hook calls the right key + fn together. Params must match between
 * the key factory and the query function.
 */
import { queryKeys } from "@/lib/query-keys";
import { getContracts } from "./get-contracts";
import { getContractPayroll } from "./get-contract-payroll";
import { getPayrollAnalytics } from "./get-payroll-analytics";
import { getOverviewMetrics } from "./get-overview-metrics";
import { getPendingDecisions } from "./get-pending-decisions";
import { getRecentActivity } from "./get-recent-activity";

// Demo-mode stubs for queries whose backing data is out of scope for
// the public demo (expenses, weather). Each returns an empty / null
// payload so the calling component renders its empty state without
// crashing. In the source repo these point at real query fns.
async function stubEmptyArray() {
  return [] as const;
}
async function stubEmptyWeather() {
  return [] as Array<{
    county: string;
    state: string | null;
    unitCount: number;
    contractCount: number;
    contractNames: string[];
    emoji: string;
    condition: string;
    high: number | null;
    low: number | null;
    rainChance: number | null;
  }>;
}

export const queries = {
  contracts: {
    key: queryKeys.contracts,
    fn: getContracts,
  },
  contractPayroll: {
    key: queryKeys.contractPayroll,
    fn: getContractPayroll,
  },
  payrollAnalytics: {
    key: queryKeys.payrollAnalytics,
    fn: getPayrollAnalytics,
  },
  overviewMetrics: {
    key: queryKeys.overviewMetrics,
    fn: getOverviewMetrics,
  },
  pendingDecisions: {
    key: queryKeys.pendingDecisions,
    fn: getPendingDecisions,
  },
  recentActivity: {
    key: queryKeys.recentActivity,
    fn: getRecentActivity,
  },
  // Stubs for surfaces outside the 9-surface demo scope.
  weatherToday: {
    key: queryKeys.weatherToday,
    fn: stubEmptyWeather,
  },
  pendingExpenses: {
    key: queryKeys.pendingExpenses,
    fn: stubEmptyArray,
  },
  flaggedExpenses: {
    key: queryKeys.flaggedExpenses,
    fn: stubEmptyArray,
  },
  contractExpenses: {
    key: queryKeys.contractExpenses,
    fn: stubEmptyArray,
  },
  allExpenses: {
    key: queryKeys.allExpenses,
    fn: stubEmptyArray,
  },
  expenseImports: {
    key: queryKeys.expenseImports,
    fn: stubEmptyArray,
  },
  expenseActivity: {
    key: queryKeys.expenseActivity,
    fn: stubEmptyArray,
  },
} as const;

export type QueryName = keyof typeof queries;
