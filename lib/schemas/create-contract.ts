import { z } from "zod";
import type { AssertInsertMatch } from "@/lib/supabase/type-check";

// HTML date inputs send "" when cleared. Sending "" to a Postgres date
// column causes "invalid input syntax for type date" errors. Coerce
// empty strings to null so both start_date and end_date accept "no date".
// Per Jaime (April 2026): private contracts often have no fixed schedule,
// so neither field should force submit.
const coerceDateOrNull = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v ?? null));

export const createContractSchema = z.object({
  // Required
  name: z.string().min(1, "Contract name is required").max(200),
  // Company is required for all contract_type values EXCEPT 'private'.
  // Private/landowner jobs can be worked by Cascadia OR Ramos (or both in the
  // same year), so Jaime doesn't want to lock them to one company. When left
  // blank on a private contract, company_id stores NULL and the contract
  // appears in both Cascadia and Ramos filter views. A superRefine below
  // enforces the "required unless private" rule.
  company_id: z.string().uuid().optional().nullable().or(z.literal("")),
  status: z.enum(
    ["open", "active", "upcoming", "seasonal", "closed", "archived", "pending_approval"],
    { message: "Select a status" },
  ),

  // Dates — both optional
  start_date: coerceDateOrNull,
  end_date: coerceDateOrNull,
  contract_number: z.string().max(100).optional().nullable(),
  contract_type: z
    .enum(["private", "dnr_gna", "federal", "weyerhaeuser", "state", "county", "other"])
    .optional()
    .nullable(),
  location: z.string().max(500).optional().nullable(),
  landowner: z.string().max(200).optional().nullable(),
  // Physical street address of the landowner / project site. Separate from
  // `location` which is the free-text region ("Lewis County, WA"). This
  // column was added in an earlier migration but never wired up — being
  // surfaced now per Jaime so addresses can eventually feed geocoding +
  // map pin work in Phase 2 Item 5.
  landowner_address: z.string().max(500).optional().nullable(),

  // Financial
  contract_price: z.coerce.number().min(0).optional().nullable(),
  bond_amount: z.coerce.number().min(0).optional().nullable(),
  has_prevailing_wage: z.boolean().optional(),
  has_fringe: z.boolean().optional(),
  fringe_rate: z.coerce.number().min(0).optional().nullable(),

  // Scope
  unit_type: z.enum(["tree", "acre", "hour"]).optional().nullable(),
  total_seedlings: z.coerce.number().int().min(0).optional().nullable(),
  total_acres: z.coerce.number().min(0).optional().nullable(),

  // Contact
  contact_name: z.string().max(200).optional().nullable(),
  contact_phone: z.string().max(50).optional().nullable(),
  contact_email: z.string().email().optional().or(z.literal("")).nullable(),

  // Assignment
  foreman_id: z.string().uuid().optional().nullable(),

  // Other
  prime_contractor: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
}).superRefine((data, ctx) => {
  // Company is required for every contract_type except 'private'.
  const isPrivate = data.contract_type === "private";
  const hasCompany = !!data.company_id && data.company_id !== "";
  if (!isPrivate && !hasCompany) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["company_id"],
      message: "Select a company",
    });
  }
});

export type CreateContractInput = z.infer<typeof createContractSchema>;

// Drift check — errors at build time if Zod output doesn't match DB schema
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Check = AssertInsertMatch<CreateContractInput, "contracts">;
