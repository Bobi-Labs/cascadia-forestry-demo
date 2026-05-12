import { createClient } from "@/lib/supabase/client";

export async function getTrackerItem(id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tracker_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}
