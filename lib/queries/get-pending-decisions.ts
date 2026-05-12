import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/demo-mode";
import { demoFixtures } from "@/lib/demo-fixtures";

/**
 * Aggregated "pending decisions" for the overview dashboard. One query
 * surfaces every action item Jaime/admin should care about right now:
 *   - Timesheets awaiting approval (status='submitted')
 *   - Expenses awaiting assignment (no contract_id, not deleted)
 *   - Compliance deadlines coming up in next 14 days (or overdue)
 *   - Contracts ending in next 14 days (date pressure)
 *
 * Returns counts + first-N example items for each category.
 */
export async function getPendingDecisions(
  companyFilter: "cascadia" | "ramos" | null = null,
) {
  if (IS_DEMO_MODE) {
    return buildDemoPendingDecisions(companyFilter);
  }

  const supabase = createClient();

  const CASCADIA_ID = "00000000-0000-0000-0000-000000000001";
  const RAMOS_ID = "00000000-0000-0000-0000-000000000002";

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in14days = new Date(today);
  in14days.setDate(today.getDate() + 14);
  const in14daysStr = in14days.toISOString().slice(0, 10);

  // ── Pending timesheets ──
  const tsQuery = supabase
    .from("timesheets")
    .select("id, date, contract_id, foreman_id, contracts:contracts(name, company_id), employees:employees!foreman_id(first_name, last_name)")
    .eq("status", "submitted")
    .order("date", { ascending: false })
    .limit(50);
  const { data: pendingTs } = await tsQuery;
  const filteredPendingTs = (pendingTs || []).filter((t) => {
    if (!companyFilter) return true;
    const c = t.contracts as { company_id: string | null } | null;
    if (!c?.company_id) return true;
    return companyFilter === "cascadia" ? c.company_id === CASCADIA_ID : c.company_id === RAMOS_ID;
  });

  // ── Pending expenses (no contract_id) ──
  const expQuery = supabase
    .from("expenses")
    .select("id, date, amount, vendor, description, company_id")
    .is("contract_id", null)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(100);
  const { data: pendingExp } = await expQuery;
  const filteredPendingExp = (pendingExp || []).filter((e) => {
    if (!companyFilter) return true;
    if (!e.company_id) return true;
    return companyFilter === "cascadia" ? e.company_id === CASCADIA_ID : e.company_id === RAMOS_ID;
  });

  // ── Compliance items due soon or overdue ──
  const compQuery = supabase
    .from("compliance_items")
    .select("id, item, due_date, status, employee_id, contract_id")
    .lte("due_date", in14daysStr)
    .in("status", ["due_soon", "overdue", "upcoming"])
    .order("due_date", { ascending: true });
  const { data: compliance } = await compQuery;

  // ── Contracts ending in next 14 days ──
  const contractQuery = supabase
    .from("contracts")
    .select("id, name, end_date, status, company_id")
    .eq("status", "active")
    .gte("end_date", todayStr)
    .lte("end_date", in14daysStr)
    .order("end_date", { ascending: true });
  const { data: endingContracts } = await contractQuery;
  const filteredEnding = (endingContracts || []).filter((c) => {
    if (!companyFilter) return true;
    if (!c.company_id) return true;
    return companyFilter === "cascadia" ? c.company_id === CASCADIA_ID : c.company_id === RAMOS_ID;
  });

  return {
    pendingTimesheets: {
      count: filteredPendingTs.length,
      sample: filteredPendingTs.slice(0, 5),
    },
    pendingExpenses: {
      count: filteredPendingExp.length,
      sample: filteredPendingExp.slice(0, 5),
      totalAmount: filteredPendingExp.reduce((s, e) => s + Number(e.amount || 0), 0),
    },
    complianceDeadlines: {
      count: (compliance || []).length,
      sample: (compliance || []).slice(0, 5),
    },
    endingContracts: {
      count: filteredEnding.length,
      sample: filteredEnding.slice(0, 5),
    },
  };
}

export type PendingDecisions = Awaited<ReturnType<typeof getPendingDecisions>>;

function buildDemoPendingDecisions(
  _companyFilter: "cascadia" | "ramos" | null,
): PendingDecisions {
  const timesheets = (demoFixtures.timesheets ?? []) as Array<Record<string, unknown>>;
  const compliance = (demoFixtures.compliance_items ?? []) as Array<Record<string, unknown>>;
  const contracts = (demoFixtures.contracts ?? []) as Array<Record<string, unknown>>;
  const employees = (demoFixtures.employees ?? []) as Array<Record<string, unknown>>;
  const empById = new Map(employees.map((e) => [e.id as string, e]));
  const contractById = new Map(contracts.map((c) => [c.id as string, c]));

  const pendingTs = timesheets.filter((t) => t.status === "submitted").map((t) => {
    const emp = empById.get(t.foreman_id as string);
    const contract = contractById.get(t.contract_id as string);
    return {
      ...t,
      contracts: contract
        ? { name: contract.name as string, company_id: contract.company_id as string }
        : null,
      employees: emp
        ? { first_name: emp.first_name as string, last_name: emp.last_name as string }
        : null,
    };
  });

  const today = "2026-05-12";
  const endingSoon = contracts.filter((c) => {
    if (c.status !== "active") return false;
    const end = c.end_date as string | null;
    if (!end) return false;
    const days = (new Date(end).getTime() - new Date(today).getTime()) / 86400000;
    return days >= 0 && days <= 14;
  });

  return {
    pendingTimesheets: {
      count: pendingTs.length,
      sample: pendingTs.slice(0, 5),
    },
    pendingExpenses: {
      count: 0,
      sample: [],
      totalAmount: 0,
    },
    complianceDeadlines: {
      count: compliance.length,
      sample: compliance.slice(0, 5),
    },
    endingContracts: {
      count: endingSoon.length,
      sample: endingSoon.slice(0, 5),
    },
  } as unknown as PendingDecisions;
}
