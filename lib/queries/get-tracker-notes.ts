import { createClient } from "@/lib/supabase/client";

export async function getTrackerNotes(itemId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tracker_notes")
    .select("*")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}
