import { createClient } from "@/lib/supabase/client";

export async function deleteCrewSet(input: { id: string }) {
  const supabase = createClient();

  // Delete members first (FK constraint)
  const { error: membersError } = await supabase
    .from("crew_set_members")
    .delete()
    .eq("crew_set_id", input.id);

  if (membersError) {
    console.error("deleteCrewSet members error:", membersError);
    return { success: false as const, error: "Failed to remove crew members" };
  }

  // Delete the crew set
  const { error: setError } = await supabase
    .from("crew_sets")
    .delete()
    .eq("id", input.id);

  if (setError) {
    console.error("deleteCrewSet error:", setError);
    return { success: false as const, error: "Failed to delete crew set" };
  }

  return { success: true as const, data: { id: input.id } };
}
