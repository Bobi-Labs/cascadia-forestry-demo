import { createClient } from "@/lib/supabase/client";
import {
  createTrackerNoteSchema,
  type CreateTrackerNoteInput,
} from "@/lib/schemas/tracker-note";

export async function createTrackerNote(input: CreateTrackerNoteInput) {
  const parsed = createTrackerNoteSchema.parse(input);
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tracker_notes")
    .insert({
      item_id: parsed.item_id,
      author: parsed.author,
      content: parsed.content,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createTrackerNote error:", error);
    return { success: false as const, error: "Failed to add note" };
  }

  return { success: true as const, data };
}
