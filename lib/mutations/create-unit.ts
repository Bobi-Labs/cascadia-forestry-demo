import { createClient } from "@/lib/supabase/client";
import { createUnitSchema, type CreateUnitInput } from "@/lib/schemas/unit";

export async function createUnit(input: CreateUnitInput) {
  const parsed = createUnitSchema.parse(input);
  const supabase = createClient();

  const { data, error } = await supabase
    .from("units")
    .insert({
      contract_id: parsed.contract_id,
      name: parsed.name,
      work_type: parsed.work_type ?? null,
      county: parsed.county ?? null,
      state: parsed.state ?? null,
      amount: parsed.amount ?? null,
      amount_type: parsed.amount_type ?? null,
      price_per_unit: parsed.price_per_unit ?? null,
      status: parsed.status,
      completion_pct: parsed.completion_pct,
      species: parsed.species ?? null,
      target_spacing: parsed.target_spacing ?? null,
      seedlings_per_acre: parsed.seedlings_per_acre ?? null,
      total_seedlings: parsed.total_seedlings ?? null,
      stock_type: parsed.stock_type ?? null,
      tpa_target: parsed.tpa_target ?? null,
      prescription: parsed.prescription ?? null,
      avg_slope_pct: parsed.avg_slope_pct ?? null,
      terrain_difficulty: parsed.terrain_difficulty ?? null,
      elevation_min: parsed.elevation_min ?? null,
      elevation_max: parsed.elevation_max ?? null,
      township_range: parsed.township_range ?? null,
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      notes: parsed.notes ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("createUnit error:", error);
    return { success: false as const, error: error.message };
  }

  // Kick off Drive folder creation — non-blocking
  fetch("/api/drive/unit-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unitId: data.id, unitName: parsed.name, contractId: parsed.contract_id }),
  }).catch((err) => console.warn("Drive unit folder creation failed (non-fatal):", err));

  return { success: true as const, data };
}
