import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/demo-mode";
import {
  updateCrewSetSchema,
  type UpdateCrewSetInput,
} from "@/lib/schemas/update-crew-set";

export async function updateCrewSet(input: UpdateCrewSetInput) {
  const parsed = updateCrewSetSchema.parse(input);

  if (IS_DEMO_MODE) {
    return { success: true as const, data: { id: parsed.id } };
  }

  const supabase = createClient();

  const { id, member_ids, ...fields } = parsed;

  // 1. Update crew set fields (if any provided)
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updateData[key] = value ?? null;
    }
  }

  if (Object.keys(updateData).length > 0) {
    const { error: setError } = await supabase
      .from("crew_sets")
      .update(updateData)
      .eq("id", id);

    if (setError) {
      console.error("updateCrewSet error:", setError);
      return { success: false as const, error: "Failed to update crew set" };
    }
  }

  // 2. Replace members if provided
  if (member_ids) {
    // Delete existing members
    const { error: deleteError } = await supabase
      .from("crew_set_members")
      .delete()
      .eq("crew_set_id", id);

    if (deleteError) {
      console.error("updateCrewSet delete members error:", deleteError);
      return { success: false as const, error: "Failed to update members" };
    }

    // Insert new members
    const members = member_ids.map((employee_id) => ({
      crew_set_id: id,
      employee_id,
      is_default: true,
    }));

    const { error: insertError } = await supabase
      .from("crew_set_members")
      .insert(members);

    if (insertError) {
      console.error("updateCrewSet insert members error:", insertError);
      return { success: false as const, error: "Failed to add new members" };
    }
  }

  return { success: true as const, data: { id } };
}
