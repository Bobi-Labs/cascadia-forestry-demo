import { createClient } from "@/lib/supabase/client";

/**
 * Recent expense audit log entries with the related expense and contract
 * info pre-joined. Used by the admin dashboard's activity feed so admins
 * can see what's happening across the expense system in one place.
 *
 * Returns the most recent 50 actions across all expenses. Skips 'created'
 * actions since those are noisy (one per import row) — surfacing them in
 * the activity feed would drown out the meaningful events (assignments,
 * reassignments, deletions).
 */
export async function getExpenseActivity() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("expense_audit_log")
    .select(
      `
      id,
      expense_id,
      action,
      field_changed,
      old_value,
      new_value,
      user_id,
      created_at,
      expenses:expenses(
        id,
        vendor,
        amount,
        date,
        cardholder_name,
        contract_id,
        contracts:contracts(id, name)
      )
      `,
    )
    .neq("action", "created")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

export type ExpenseActivity = NonNullable<Awaited<ReturnType<typeof getExpenseActivity>>>[number];
