import { createClient } from "@/lib/supabase/client";

export async function getTrackerItems(projectId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tracker_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
