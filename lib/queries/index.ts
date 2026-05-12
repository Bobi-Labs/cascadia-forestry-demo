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
} as const;

export type QueryName = keyof typeof queries;
