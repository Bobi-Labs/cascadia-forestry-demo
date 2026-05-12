import { z } from "zod";

/**
 * Assigning an expense to a contract. Used both for first-time assignment
 * and for re-assignment (the mutation auto-detects which based on the
 * current state of the row).
 */
export const assignExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  contractId: z.string().uuid(),
  userId: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type AssignExpenseInput = z.infer<typeof assignExpenseSchema>;

/**
 * Clearing a contract assignment from an expense. Sends the expense back
 * to the pending queue.
 */
export const unassignExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  userId: z.string().nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});

export type UnassignExpenseInput = z.infer<typeof unassignExpenseSchema>;
