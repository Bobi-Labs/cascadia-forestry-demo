import { z } from "zod";
import type { AssertInsertMatch } from "@/lib/supabase/type-check";

export const createTrackerItemSchema = z.object({
  project_id: z.string().uuid("Project ID is required"),
  category: z.enum(
    ["data_needed", "question", "decision", "task", "bug", "feature"],
    { message: "Select a category" },
  ),
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional().nullable(),
  priority: z
    .enum(["high", "medium", "low"])
    .optional()
    .default("medium"),
  status: z
    .enum(["pending", "in_progress", "done", "blocked", "future_phase"])
    .optional()
    .default("pending"),
  assigned_to: z.string().max(100).optional().nullable(),
  due_date: z.string().optional().nullable(),
  sort_order: z.number().int().optional(),
});

export type CreateTrackerItemInput = z.infer<typeof createTrackerItemSchema>;

// Drift check — errors at build time if Zod output doesn't match DB schema
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _CreateCheck = AssertInsertMatch<CreateTrackerItemInput, "tracker_items">;

export const updateTrackerItemSchema = z.object({
  id: z.string().uuid("Item ID is required"),
  category: z
    .enum(["data_needed", "question", "decision", "task", "bug", "feature"])
    .optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z
    .enum(["pending", "in_progress", "done", "blocked", "future_phase"])
    .optional(),
  assigned_to: z.string().max(100).optional().nullable(),
  due_date: z.string().optional().nullable(),
  sort_order: z.number().int().optional(),
});

export type UpdateTrackerItemInput = z.infer<typeof updateTrackerItemSchema>;
