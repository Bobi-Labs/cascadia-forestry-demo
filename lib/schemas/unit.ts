import { z } from "zod";

// Species entries are stored as JSON strings in the text[] column
// Format: {"name":"Douglas Fir","stockType":"1+1","count":5000}
export const speciesEntrySchema = z.object({
  name: z.string().min(1, "Species name is required"),
  stockType: z.string().optional().default(""),
  count: z.coerce.number().int().min(0).optional().nullable(),
});

export type SpeciesEntry = z.infer<typeof speciesEntrySchema>;

/** Encode a SpeciesEntry into a string for storage in text[] */
export function encodeSpeciesEntry(entry: SpeciesEntry): string {
  return JSON.stringify(entry);
}

/** Decode a species string — supports both legacy plain strings and JSON objects */
export function decodeSpeciesEntry(raw: string): SpeciesEntry {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.name === "string") {
      return {
        name: parsed.name,
        stockType: parsed.stockType ?? "",
        count: parsed.count ?? null,
      };
    }
  } catch {
    // Not JSON — legacy plain species name
  }
  return { name: raw, stockType: "", count: null };
}

export const createUnitSchema = z.object({
  contract_id: z.string().uuid(),
  name: z.string().min(1, "Unit name is required").max(200),
  work_type: z.string().max(100).optional().nullable(),
  county: z.string().max(100).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  amount: z.coerce.number().min(0).optional().nullable(),
  amount_type: z.enum(["tree", "acre", "hour"]).optional().nullable(),
  price_per_unit: z.coerce.number().min(0).optional().nullable(),
  // Multi-price fields — same unit can be billed multiple ways at once
  // (e.g. PCT thinning bid per-acre AND any cleanup time per-hour).
  // All optional + null-safe; office picks which to use at invoice time.
  price_per_tree: z.coerce.number().min(0).optional().nullable(),
  price_per_acre: z.coerce.number().min(0).optional().nullable(),
  price_per_hour: z.coerce.number().min(0).optional().nullable(),
  status: z.enum(["not_started", "in_progress", "completed", "pending"]).default("not_started"),
  completion_pct: z.coerce.number().min(0).max(100).default(0),
  species: z.array(z.string()).optional().nullable(),
  target_spacing: z.string().max(100).optional().nullable(),
  seedlings_per_acre: z.coerce.number().int().min(0).optional().nullable(),
  total_seedlings: z.coerce.number().int().min(0).optional().nullable(),
  stock_type: z.string().max(100).optional().nullable(),
  tpa_target: z.coerce.number().int().min(0).optional().nullable(),
  prescription: z.string().max(500).optional().nullable(),
  avg_slope_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  terrain_difficulty: z.enum(["easy", "moderate", "hard"]).optional().nullable(),
  elevation_min: z.coerce.number().min(0).optional().nullable(),
  elevation_max: z.coerce.number().min(0).optional().nullable(),
  township_range: z.string().max(100).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const updateUnitSchema = createUnitSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
