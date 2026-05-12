import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/demo-mode";
import { demoFixtures } from "@/lib/demo-fixtures";

export async function getContracts() {
  if (IS_DEMO_MODE) {
    return (demoFixtures.contracts ?? [])
      .map((c) => ({
        id: c.id as string,
        name: c.name as string,
        company_id: c.company_id as string,
        status: c.status as string,
        start_date: c.start_date as string | null,
        end_date: c.end_date as string | null,
      }))
      .sort((a, b) =>
        (b.start_date || "").localeCompare(a.start_date || ""),
      );
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("contracts")
    .select("id, name, company_id, status, start_date, end_date")
    .order("start_date", { ascending: false });

  if (error) throw error;
  return data;
}
