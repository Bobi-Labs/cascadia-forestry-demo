/**
 * Query registry — pairs each key factory with its query function.
 *
 * useClientQuery enforces this pairing: you pick a name from this registry
 * and the hook calls the right key + fn together. Params must match between
 * the key factory and the query function.
 */
import { queryKeys } from "@/lib/query-keys";
import { getContracts } from "./get-contracts";
import { getPendingExpenses } from "./get-pending-expenses";
import { getFlaggedExpenses } from "./get-flagged-expenses";
import { getContractExpenses } from "./get-contract-expenses";
import { getContractPayroll } from "./get-contract-payroll";
import { getPayrollAnalytics } from "./get-payroll-analytics";
import { getOverviewMetrics } from "./get-overview-metrics";
import { getPendingDecisions } from "./get-pending-decisions";
import { getRecentActivity } from "./get-recent-activity";
import { getWeatherToday } from "./get-weather-today";
import { getAllExpenses } from "./get-all-expenses";
import { getExpenseImports } from "./get-expense-imports";
import { getExpenseActivity } from "./get-expense-activity";
import { getTrackerProjects } from "./get-tracker-projects";
import { getTrackerItems } from "./get-tracker-items";
import { getTrackerItem } from "./get-tracker-item";
import { getTrackerNotes } from "./get-tracker-notes";
import { getTrackerTelegramConfig } from "./get-tracker-telegram-config";

export const queries = {
  contracts: {
    key: queryKeys.contracts,
    fn: getContracts,
  },
  pendingExpenses: {
    key: queryKeys.pendingExpenses,
    fn: getPendingExpenses,
  },
  flaggedExpenses: {
    key: queryKeys.flaggedExpenses,
    fn: getFlaggedExpenses,
  },
  contractExpenses: {
    key: queryKeys.contractExpenses,
    fn: getContractExpenses,
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
  weatherToday: {
    key: queryKeys.weatherToday,
    fn: getWeatherToday,
  },
  allExpenses: {
    key: queryKeys.allExpenses,
    fn: getAllExpenses,
  },
  expenseImports: {
    key: queryKeys.expenseImports,
    fn: getExpenseImports,
  },
  expenseActivity: {
    key: queryKeys.expenseActivity,
    fn: getExpenseActivity,
  },
  trackerProjects: {
    key: queryKeys.trackerProjects,
    fn: getTrackerProjects,
  },
  trackerItems: {
    key: queryKeys.trackerItems,
    fn: getTrackerItems,
  },
  trackerItem: {
    key: queryKeys.trackerItem,
    fn: getTrackerItem,
  },
  trackerNotes: {
    key: queryKeys.trackerNotes,
    fn: getTrackerNotes,
  },
  trackerTelegramConfig: {
    key: queryKeys.trackerTelegramConfig,
    fn: getTrackerTelegramConfig,
  },
} as const;

export type QueryName = keyof typeof queries;
