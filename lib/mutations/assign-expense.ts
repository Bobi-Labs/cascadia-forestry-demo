import { createClient } from "@/lib/supabase/client";
import {
  assignExpenseSchema,
  type AssignExpenseInput,
} from "@/lib/schemas/assign-expense";

/**
 * Assign or re-assign an expense to a contract. Auto-detects whether this
 * is a fresh assignment or a change of an existing one and writes the
 * appropriate audit log entry.
 *
 * Sets:
 *   - contract_id
 *   - match_method = 'manual'
 *   - match_confidence = 1.0 (a human chose it)
 *   - assigned_by, assigned_at
 *
 * Audit log action:
 *   - 'assigned' if the expense was previously unassigned
 *   - 'reassigned' if it had a different contract before
 */
export async function assignExpense(input: AssignExpenseInput) {
  const parsed = assignExpenseSchema.parse(input);
  const supabase = createClient();

  // Read current state to decide between assigned/reassigned
  const { data: current, error: readErr } = await supabase
    .from("expenses")
    .select("id, contract_id, match_method")
    .eq("id", parsed.expenseId)
    .maybeSingle();

  if (readErr) {
    return { success: false as const, error: readErr.message };
  }
  if (!current) {
    return { success: false as const, error: "Expense not found" };
  }

  const currentContractId = (current as { contract_id: string | null }).contract_id;
  const action = currentContractId ? "reassigned" : "assigned";
  const now = new Date().toISOString();

  // Update the expense row
  const { error: updErr } = await supabase
    .from("expenses")
    .update({
      contract_id: parsed.contractId,
      match_method: "manual",
      match_confidence: 1.0,
      assigned_by: parsed.userId || null,
      assigned_at: now,
    } as never)
    .eq("id", parsed.expenseId);

  if (updErr) {
    return { success: false as const, error: updErr.message };
  }

  // Audit log
  const { error: auditErr } = await supabase.from("expense_audit_log").insert({
    expense_id: parsed.expenseId,
    user_id: parsed.userId || null,
    action,
    field_changed: "contract_id",
    old_value: currentContractId,
    new_value: parsed.contractId,
  } as never);

  if (auditErr) {
    // Don't fail the assignment, just log it. The data is correct, the
    // audit entry is the one thing missing — and that's recoverable.
    console.error("[assignExpense] audit log failed:", auditErr.message);
  }

  return { success: true as const, expenseId: parsed.expenseId, action };
}
