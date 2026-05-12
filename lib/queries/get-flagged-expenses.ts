import { createClient } from "@/lib/supabase/client";

/**
 * Expenses with quality_flags — rows that imported successfully but
 * are missing critical fields (vendor, cardholder, unmapped category).
 *
 * Used by the "Needs Attention" section on the Expense Assignments page
 * (admin only). These rows need Jaime to fix the source data, re-import,
 * then delete the bad version.
 */
export async function getFlaggedExpenses() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("expenses")
    .select(
      `
      id,
      display_id,
      date,
      amount,
      vendor,
      description,
      category,
      cardholder_name,
      quality_flags,
      created_at
      `,
    )
    .is("deleted_at", null)
    .eq("transaction_type", "expense")
    // overlaps checks if the quality_flags array shares ANY element with
    // the given array — i.e., "has at least one known flag"
    .overlaps("quality_flags", ["missing_vendor", "missing_cardholder", "unmapped_category"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}
