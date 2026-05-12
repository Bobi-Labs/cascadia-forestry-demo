import { createClient } from "@/lib/supabase/client";

export async function getTrackerTelegramConfig(projectId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tracker_telegram_config")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
