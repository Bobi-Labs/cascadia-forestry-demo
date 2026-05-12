import { createClient } from "@/lib/supabase/client";
import { paginatedSelect } from "@/lib/supabase/paginate";

/**
 * All expenses assigned to a specific contract. Used on the contract detail
 * page's Expenses tab. Includes match info so the UI can distinguish
 * auto-matched (low confidence) from manual assignments.
 *
 * Returns expenses ordered by date, newest first. Paginated to bypass the
 * PostgREST 1000-row default cap — long-running contracts can accumulate
 * past that line.
 */
export async function getContractExpenses(contractId: string): Promise<ContractExpense[]> {
  const supabase = createClient();

  return paginatedSelect<ContractExpense>((from, to) =>
    supabase
      .from("expenses")
      .select(
        `
        id,
        date,
        amount,
        vendor,
        description,
        category,
        subcategory,
        cardholder_name,
        payment_method,
        match_method,
        match_confidence,
        assigned_by,
        assigned_at,
        employees:employees(id, first_name, last_name)
        `,
      )
      .eq("contract_id", contractId)
      .is("deleted_at", null)
      .eq("transaction_type", "expense")
      .order("date", { ascending: false })
      .range(from, to),
  );
}

export interface ContractExpense {
  id: string;
  date: string | null;
  amount: number | null;
  vendor: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  cardholder_name: string | null;
  payment_method: string | null;
  match_method: string | null;
  match_confidence: number | null;
  assigned_by: string | null;
  assigned_at: string | null;
  employees: { id: string; first_name: string | null; last_name: string | null } | null;
}
