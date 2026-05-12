import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/demo-mode";

export async function deleteUnit(input: { id: string }) {
  if (IS_DEMO_MODE) {
    return { success: true as const };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("units")
    .delete()
    .eq("id", input.id);

  if (error) {
    console.error("deleteUnit error:", error);
    return { success: false as const, error: error.message };
  }

  return { success: true as const };
}
