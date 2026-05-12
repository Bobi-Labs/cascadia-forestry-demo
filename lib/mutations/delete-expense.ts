import { createClient } from "@/lib/supabase/client";

/**
 * Soft-delete an expense — sets deleted_at so it disappears from all
 * views but remains in the DB for audit. Used when a row was imported
 * with bad data and Jaime fixed it in the sheet and re-imported.
 *
 * Writes an 'deleted' audit log entry so the action is traceable.
 */
export async function deleteExpense(input: {
  expenseId: string;
  userId?: string | null;
  reason?: string | null;
}) {
  const supabase = createClient();

  // Verify it exists and isn't already deleted
  const { data: current, error: readErr } = await supabase
    .from("expenses")
    .select("id, contract_id, vendor, amount")
    .eq("id", input.expenseId)
    .is("deleted_at", null)
    .maybeSingle();

  if (readErr) return { success: false as const, error: readErr.message };
  if (!current) return { success: false as const, error: "Expense not found or already deleted" };

  // Soft-delete
  const { error: updErr } = await supabase
    .from("expenses")
    .update({
      deleted_at: new Date().toISOString(),
      notes: input.reason
        ? `[Deleted: ${input.reason}]`
        : "[Deleted by admin]",
    } as never)
    .eq("id", input.expenseId);

  if (updErr) return { success: false as const, error: updErr.message };

  // Audit log
  const { error: auditErr } = await supabase.from("expense_audit_log").insert({
    expense_id: input.expenseId,
    user_id: input.userId || null,
    action: "deleted",
    field_changed: "deleted_at",
    old_value: null,
    new_value: new Date().toISOString(),
  } as never);

  if (auditErr) {
    console.error("[deleteExpense] audit log failed:", auditErr.message);
  }

  return { success: true as const, expenseId: input.expenseId };
}
