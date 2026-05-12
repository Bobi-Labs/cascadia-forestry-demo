import { createClient } from "@/lib/supabase/client";
import { paginatedSelect } from "@/lib/supabase/paginate";

/**
 * Pending expenses = imported expenses that haven't been assigned to a contract yet.
 *
 * Used by the office "Expense Assignments" queue. Office staff scan this list,
 * pick a contract for each one, and click Assign. Auto-matched expenses are
 * already gone from this list (they have contract_id set).
 *
 * Joins to employees so the UI can show "Cardholder: Jose Lopez" instead of
 * just a UUID. Also joins to import batch + companies for context.
 *
 * Paginated to bypass the PostgREST 1000-row default cap — large weekly
 * import batches can push the queue past that line, at which point the
 * older entries silently disappear from the UI without an error.
 */
export async function getPendingExpenses(): Promise<PendingExpense[]> {
  const supabase = createClient();

  return paginatedSelect<PendingExpense>((from, to) =>
    supabase
      .from("expenses")
      .select(
        `
        id,
        display_id,
        quality_flags,
        date,
        amount,
        vendor,
        description,
        category,
        subcategory,
        cardholder_name,
        payment_method,
        card_company,
        card_last4,
        contract_number,
        employee_id,
        company_id,
        import_batch_id,
        location_city,
        location_state,
        created_at,
        employees:employees(id, first_name, last_name),
        companies:companies(id, name)
        `,
      )
      .is("contract_id", null)
      .is("deleted_at", null)
      .eq("source", "credit_card_import")
      .eq("transaction_type", "expense")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to),
  );
}

export interface PendingExpense {
  id: string;
  display_id: string | null;
  quality_flags: string[] | null;
  date: string | null;
  amount: number | null;
  vendor: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  cardholder_name: string | null;
  payment_method: string | null;
  card_company: string | null;
  card_last4: string | null;
  contract_number: string | null;
  employee_id: string | null;
  company_id: string | null;
  import_batch_id: string | null;
  location_city: string | null;
  location_state: string | null;
  created_at: string | null;
  employees: { id: string; first_name: string | null; last_name: string | null } | null;
  companies: { id: string; name: string | null } | null;
}
