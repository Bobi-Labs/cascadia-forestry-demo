import { createClient } from "@/lib/supabase/client";

export async function deleteUnit(input: { id: string }) {
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
