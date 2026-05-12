import { createClient } from "@/lib/supabase/client";

interface OrderUpdate {
  id: string;
  sort_order: number;
}

export async function updateTrackerItemOrder(input: {
  items: OrderUpdate[];
}) {
  const supabase = createClient();

  // Update each item's sort_order
  const promises = input.items.map(({ id, sort_order }) =>
    supabase
      .from("tracker_items")
      .update({ sort_order })
      .eq("id", id),
  );

  const results = await Promise.all(promises);
  const failed = results.find((r) => r.error);

  if (failed?.error) {
    console.error("updateTrackerItemOrder error:", failed.error);
    return { success: false as const, error: "Failed to reorder items" };
  }

  return { success: true as const };
}
