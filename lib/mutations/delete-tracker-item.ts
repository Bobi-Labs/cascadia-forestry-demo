import { createClient } from "@/lib/supabase/client";

export async function deleteTrackerItem(input: { id: string }) {
  const supabase = createClient();

  // Notes cascade-delete via FK, so just delete the item
  const { error } = await supabase
    .from("tracker_items")
    .delete()
    .eq("id", input.id);

  if (error) {
    console.error("deleteTrackerItem error:", error);
    return { success: false as const, error: "Failed to delete item" };
  }

  return { success: true as const };
}
