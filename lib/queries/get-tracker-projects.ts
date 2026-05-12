import { createClient } from "@/lib/supabase/client";

export async function getTrackerProjects() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tracker_projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
