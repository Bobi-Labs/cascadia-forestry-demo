import { createClient } from "@/lib/supabase/client";

/**
 * History of expense import batches. Used by the admin dashboard's import
 * panel and by Phase G's audit/reporting view. Newest first.
 */
export async function getExpenseImports() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("expense_imports")
    .select(
      "id, spreadsheet_id, tab_name, imported_by, status, row_count, imported_count, skipped_count, error_count, auto_matched_count, error_log, created_at, imported_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

export type ExpenseImport = NonNullable<Awaited<ReturnType<typeof getExpenseImports>>>[number];
