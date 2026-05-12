import { z } from "zod";

export const updateTrackerProjectSchema = z.object({
  id: z.string().uuid("Project ID is required"),
  name: z.string().min(1).max(200).optional(),
  client_name: z.string().max(200).optional().nullable(),
  phase: z.string().max(100).optional().nullable(),
  budget: z.coerce.number().min(0).optional().nullable(),
  hours_total: z.coerce.number().min(0).optional().nullable(),
  hours_used: z.coerce.number().min(0).optional().nullable(),
  status: z.enum(["active", "paused", "completed"]).optional(),
});

export type UpdateTrackerProjectInput = z.infer<
  typeof updateTrackerProjectSchema
>;
