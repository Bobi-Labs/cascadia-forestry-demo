import { createClient } from "@/lib/supabase/client";
import { paginatedSelect } from "@/lib/supabase/paginate";

/**
 * All non-deleted expenses, used by the admin dashboard for aggregations
 * (KPIs, pie chart by category, monthly trend, per-cardholder rollup).
 *
 * Returns the minimum field set needed for charts. Aggregation happens in
 * the component since the dataset is small (low thousands). Paginated to
 * bypass the PostgREST 1000-row default cap — the expenses table grows
 * via weekly cron and was approaching the cap.
 */
export async function getAllExpenses(): Promise<ExpenseRow[]> {
  const supabase = createClient();

  return paginatedSelect<ExpenseRow>((from, to) =>
    supabase
      .from("expenses")
      .select(
        `
        id,
        date,
        amount,
        category,
        subcategory,
        cardholder_name,
        employee_id,
        company_id,
        contract_id,
        contract_number,
        match_method,
        match_confidence,
        vendor,
        employees:employees(id, first_name, last_name),
        contracts:contracts(id, name)
        `,
      )
      .is("deleted_at", null)
      .eq("transaction_type", "expense")
      .order("date", { ascending: false })
      .range(from, to),
  );
}

export interface ExpenseRow {
  id: string;
  date: string | null;
  amount: number | null;
  category: string | null;
  subcategory: string | null;
  cardholder_name: string | null;
  employee_id: string | null;
  company_id: string | null;
  contract_id: string | null;
  contract_number: string | null;
  match_method: string | null;
  match_confidence: number | null;
  vendor: string | null;
  employees: { id: string; first_name: string | null; last_name: string | null } | null;
  contracts: { id: string; name: string | null } | null;
}
