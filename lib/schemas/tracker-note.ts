import { z } from "zod";
import type { AssertInsertMatch } from "@/lib/supabase/type-check";

export const createTrackerNoteSchema = z.object({
  item_id: z.string().uuid("Item ID is required"),
  author: z.string().min(1, "Author is required").max(100),
  content: z.string().min(1, "Note content is required").max(5000),
});

export type CreateTrackerNoteInput = z.infer<typeof createTrackerNoteSchema>;

// Drift check
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Check = AssertInsertMatch<CreateTrackerNoteInput, "tracker_notes">;
