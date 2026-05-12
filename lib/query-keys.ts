/**
 * Centralized query key factories.
 *
 * Used by lib/queries (pairing) and lib/mutations (invalidation).
 * Keys are functions so they can accept params for cache granularity.
 *
 * Add new keys here — both hooks enforce these at the type level,
 * so typos and mismatches are caught at compile time.
 */
export const queryKeys = {
  contracts: () => ["contracts"] as const,
  contract: (id: string) => ["contract", id] as const,
  employees: () => ["employees"] as const,
  units: () => ["units"] as const,
  crewSets: () => ["crewSets"] as const,
  crewSetMembers: (id: string) => ["crewSetMembers", id] as const,
  unitDraws: (unitId: string) => ["unitDraws", unitId] as const,
  // Expenses
  pendingExpenses: () => ["pendingExpenses"] as const,
  flaggedExpenses: () => ["flaggedExpenses"] as const,
  contractExpenses: (contractId: string) => ["contractExpenses", contractId] as const,
  contractPayroll: (contractId: string) => ["contractPayroll", contractId] as const,
  payrollAnalytics: (companyFilter: "cascadia" | "ramos" | null) => ["payrollAnalytics", companyFilter] as const,
  overviewMetrics: (companyFilter: "cascadia" | "ramos" | null) => ["overviewMetrics", companyFilter] as const,
  pendingDecisions: (companyFilter: "cascadia" | "ramos" | null) => ["pendingDecisions", companyFilter] as const,
  recentActivity: (companyFilter: "cascadia" | "ramos" | null) => ["recentActivity", companyFilter] as const,
  weatherToday: () => ["weatherToday"] as const,
  allExpenses: () => ["allExpenses"] as const,
  expenseImports: () => ["expenseImports"] as const,
  expenseActivity: () => ["expenseActivity"] as const,
  // Tracker
  trackerProjects: () => ["trackerProjects"] as const,
  trackerProject: (id: string) => ["trackerProject", id] as const,
  trackerItems: (projectId: string) => ["trackerItems", projectId] as const,
  trackerItem: (id: string) => ["trackerItem", id] as const,
  trackerNotes: (itemId: string) => ["trackerNotes", itemId] as const,
  trackerTelegramConfig: (projectId: string) => ["trackerTelegramConfig", projectId] as const,
} as const;
