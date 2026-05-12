import { createClient } from "@/lib/supabase/client";

export async function getContracts() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("contracts")
    .select("id, name, company_id, status, start_date, end_date")
    .order("start_date", { ascending: false });

  if (error) throw error;
  return data;
}
