import { createClient } from "@/lib/supabase/client";

interface BulkUpdate {
  ids: string[];
  status?: "pending" | "in_progress" | "done" | "blocked" | "future_phase";
  priority?: "high" | "medium" | "low";
}

export async function updateTrackerItemsBulk(input: BulkUpdate) {
  const supabase = createClient();

  const updates: Record<string, unknown> = {};
  if (input.status) {
    updates.status = input.status;
    if (input.status === "done") {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }
  }
  if (input.priority) updates.priority = input.priority;

  const { error } = await supabase
    .from("tracker_items")
    .update(updates)
    .in("id", input.ids);

  if (error) {
    console.error("updateTrackerItemsBulk error:", error);
    return { success: false as const, error: "Failed to bulk update items" };
  }

  return { success: true as const };
}
