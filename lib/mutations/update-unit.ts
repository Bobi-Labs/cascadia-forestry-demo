import { createClient } from "@/lib/supabase/client";
import { updateUnitSchema, type UpdateUnitInput } from "@/lib/schemas/unit";

export async function updateUnit(input: UpdateUnitInput) {
  const { id, ...rest } = updateUnitSchema.parse(input);
  const supabase = createClient();

  // Build update object only from defined fields
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      updates[key] = value ?? null;
    }
  }

  const { data, error } = await supabase
    .from("units")
    .update(updates)
    .eq("id", id)
    .select("id, updated_at")
    .single();

  if (error) {
    console.error("updateUnit error:", error);
    return { success: false as const, error: error.message };
  }

  return { success: true as const, data };
}
