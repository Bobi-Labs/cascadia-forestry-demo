import { z } from "zod";

export const createCrewSetSchema = z.object({
  name: z.string().min(1, "Crew set name is required").max(50),
  foreman_id: z.string().uuid("Select a foreman"),
  is_default: z.boolean().optional(),
  member_ids: z
    .array(z.string().uuid())
    .min(1, "Select at least one crew member"),
});

export type CreateCrewSetInput = z.infer<typeof createCrewSetSchema>;
