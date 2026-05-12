import { createClient } from "@/lib/supabase/client";
import {
  updateTrackerItemSchema,
  type UpdateTrackerItemInput,
} from "@/lib/schemas/tracker-item";

export async function updateTrackerItem(input: UpdateTrackerItemInput) {
  const parsed = updateTrackerItemSchema.parse(input);
  const supabase = createClient();

  const { id, ...fields } = parsed;

  // Auto-set completed_at when status changes to done
  const updates: Record<string, unknown> = { ...fields };
  if (fields.status === "done") {
    updates.completed_at = new Date().toISOString();
  } else if (fields.status) {
    updates.completed_at = null;
  }

  const { data, error } = await supabase
    .from("tracker_items")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("updateTrackerItem error:", error);
    return { success: false as const, error: "Failed to update item" };
  }

  return { success: true as const, data };
}
