import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/demo-mode";
import {
  updateEmployeeSchema,
  type UpdateEmployeeInput,
} from "@/lib/schemas/update-employee";

export async function updateEmployee(input: UpdateEmployeeInput) {
  const parsed = updateEmployeeSchema.parse(input);

  if (IS_DEMO_MODE) {
    return {
      success: true as const,
      data: { id: parsed.id, updated_at: new Date().toISOString() },
    };
  }

  const supabase = createClient();

  const { id, ...fields } = parsed;

  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updateData[key] = value ?? null;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false as const, error: "No fields to update" };
  }

  const { data, error } = await supabase
    .from("employees")
    .update(updateData)
    .eq("id", id)
    .select("id, updated_at")
    .single();

  if (error) {
    console.error("updateEmployee error:", error);
    return { success: false as const, error: "Something went wrong" };
  }

  return { success: true as const, data };
}
