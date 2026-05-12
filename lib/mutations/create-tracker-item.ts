import { createClient } from "@/lib/supabase/client";
import {
  createTrackerItemSchema,
  type CreateTrackerItemInput,
} from "@/lib/schemas/tracker-item";

export async function createTrackerItem(input: CreateTrackerItemInput) {
  const parsed = createTrackerItemSchema.parse(input);
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tracker_items")
    .insert({
      project_id: parsed.project_id,
      category: parsed.category,
      title: parsed.title,
      description: parsed.description ?? null,
      priority: parsed.priority ?? "medium",
      status: parsed.status ?? "pending",
      assigned_to: parsed.assigned_to ?? null,
      due_date: parsed.due_date ?? null,
      sort_order: parsed.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createTrackerItem error:", error);
    return { success: false as const, error: "Failed to create item" };
  }

  return { success: true as const, data };
}
