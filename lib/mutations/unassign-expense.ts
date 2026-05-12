import { createClient } from "@/lib/supabase/client";
import {
  unassignExpenseSchema,
  type UnassignExpenseInput,
} from "@/lib/schemas/assign-expense";

/**
 * Clear the contract assignment from an expense, sending it back to the
 * pending queue. Used when the office decides an expense was wrongly
 * assigned (manually or by auto-match) and wants to redo it.
 *
 * Clears:
 *   - contract_id
 *   - match_method
 *   - match_confidence
 *   - assigned_by, assigned_at
 *
 * Logs an 'unassigned' audit entry with the contract_id that was removed.
 */
export async function unassignExpense(input: UnassignExpenseInput) {
  const parsed = unassignExpenseSchema.parse(input);
  const supabase = createClient();

  // Read current state to capture the contract_id we're about to remove
  const { data: current, error: readErr } = await supabase
    .from("expenses")
    .select("id, contract_id")
    .eq("id", parsed.expenseId)
    .maybeSingle();

  if (readErr) {
    return { success: false as const, error: readErr.message };
  }
  if (!current) {
    return { success: false as const, error: "Expense not found" };
  }

  const oldContractId = (current as { contract_id: string | null }).contract_id;
  if (!oldContractId) {
    return { success: false as const, error: "Expense is already unassigned" };
  }

  const { error: updErr } = await supabase
    .from("expenses")
    .update({
      contract_id: null,
      match_method: null,
      match_confidence: null,
      assigned_by: null,
      assigned_at: null,
    } as never)
    .eq("id", parsed.expenseId);

  if (updErr) {
    return { success: false as const, error: updErr.message };
  }

  const { error: auditErr } = await supabase.from("expense_audit_log").insert({
    expense_id: parsed.expenseId,
    user_id: parsed.userId || null,
    action: "unassigned",
    field_changed: "contract_id",
    old_value: oldContractId,
    new_value: null,
  } as never);

  if (auditErr) {
    console.error("[unassignExpense] audit log failed:", auditErr.message);
  }

  return { success: true as const, expenseId: parsed.expenseId };
}
