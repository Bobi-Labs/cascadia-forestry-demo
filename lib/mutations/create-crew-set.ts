import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/demo-mode";
import {
  createCrewSetSchema,
  type CreateCrewSetInput,
} from "@/lib/schemas/create-crew-set";

export async function createCrewSet(input: CreateCrewSetInput) {
  const parsed = createCrewSetSchema.parse(input);

  if (IS_DEMO_MODE) {
    return {
      success: true as const,
      data: { id: `demo-${Date.now()}`, created_at: new Date().toISOString() },
    };
  }

  const supabase = createClient();

  // 1. Insert the crew set
  const { data: crewSet, error: setError } = await supabase
    .from("crew_sets")
    .insert({
      name: parsed.name,
      foreman_id: parsed.foreman_id,
      is_default: parsed.is_default ?? false,
    })
    .select("id, created_at")
    .single();

  if (setError) {
    console.error("createCrewSet error:", setError);
    return { success: false as const, error: "Failed to create crew set" };
  }

  // 2. Insert members
  const members = parsed.member_ids.map((employee_id) => ({
    crew_set_id: crewSet.id,
    employee_id,
    is_default: true,
  }));

  const { error: membersError } = await supabase
    .from("crew_set_members")
    .insert(members);

  if (membersError) {
    // Rollback: delete the crew set
    await supabase.from("crew_sets").delete().eq("id", crewSet.id);
    console.error("createCrewSet members error:", membersError);
    return { success: false as const, error: "Failed to add crew members" };
  }

  return { success: true as const, data: crewSet };
}
