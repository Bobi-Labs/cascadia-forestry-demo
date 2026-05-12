import { z } from "zod";

export const updateCrewSetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Crew set name is required").max(50).optional(),
  foreman_id: z.string().uuid().optional(),
  is_default: z.boolean().optional(),
  member_ids: z
    .array(z.string().uuid())
    .min(1, "Select at least one crew member")
    .optional(),
});

export type UpdateCrewSetInput = z.infer<typeof updateCrewSetSchema>;
