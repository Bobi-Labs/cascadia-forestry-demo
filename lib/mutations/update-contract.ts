import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/demo-mode";
import {
  updateContractSchema,
  type UpdateContractInput,
} from "@/lib/schemas/update-contract";

// Date columns that should be null instead of empty string
const DATE_FIELDS = new Set(["start_date", "end_date"]);

export async function updateContract(input: UpdateContractInput) {
  const parsed = updateContractSchema.parse(input);

  if (IS_DEMO_MODE) {
    return {
      success: true as const,
      data: { id: parsed.id, updated_at: new Date().toISOString() },
    };
  }

  const supabase = createClient();

  const { id, ...fields } = parsed;

  // Build update payload — only include fields that were provided
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      // Convert empty-string dates to null so Postgres doesn't reject them.
      // Same for company_id — a cleared private-contract company select
      // sends "" and Postgres needs null (column is nullable but rejects
      // empty string as an invalid UUID).
      if ((DATE_FIELDS.has(key) || key === "company_id") && value === "") {
        updateData[key] = null;
      } else {
        updateData[key] = value ?? null;
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false as const, error: "No fields to update" };
  }

  // Use two-step approach: update, then verify.
  // A single .update().select().maybeSingle() can silently return null
  // when RLS blocks the SELECT after a successful UPDATE, making it
  // impossible to tell success from failure.
  const { error: updateError, count } = await supabase
    .from("contracts")
    .update(updateData)
    .eq("id", id);

  if (updateError) {
    if (updateError.code === "23505") {
      return {
        success: false as const,
        error: "A contract with this name already exists",
      };
    }
    console.error("updateContract error:", updateError);
    return { success: false as const, error: updateError.message };
  }

  // Verify the row was actually updated by fetching it
  const { data, error: fetchError } = await supabase
    .from("contracts")
    .select("id, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("updateContract fetch error:", fetchError);
    // The update may have succeeded but we can't confirm — treat as success
    return { success: true as const, data: { id, updated_at: null } };
  }

  if (!data) {
    return {
      success: false as const,
      error: "Contract update failed — the record could not be saved. Try refreshing the page.",
    };
  }

  return { success: true as const, data };
}
