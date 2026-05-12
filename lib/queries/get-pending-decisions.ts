import { createClient } from "@/lib/supabase/client";

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
