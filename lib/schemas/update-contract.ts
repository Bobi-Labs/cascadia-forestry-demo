import { z } from "zod";

/**
 * Coerce a number input, treating empty strings as null.
 * HTML number inputs send "" when cleared — Number("") === 0 which
 * would silently convert null DB values to 0. This helper avoids that.
 */
const coerceNumberOrNull = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  });

/**
 * Coerce a date string, treating empty strings as null.
 * HTML date inputs send "" when cleared — sending "" to a Postgres
 * date column causes an "invalid input syntax for type date" error.
 */
const coerceDateOrNull = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v ?? null));

export const updateContractSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Contract name is required").max(200).optional(),
  // Nullable: private contracts can have no assigned company (worked by
  // either Cascadia or Ramos). Empty string coerces to null downstream.
  company_id: z.string().uuid().optional().nullable().or(z.literal("")),
  status: z
    .enum(["open", "active", "upcoming", "seasonal", "closed", "archived", "pending_approval"])
    .optional(),
  start_date: coerceDateOrNull,
  end_date: coerceDateOrNull,
  contract_number: z.string().max(100).optional().nullable(),
  contract_type: z
    .enum(["private", "dnr_gna", "federal", "weyerhaeuser", "state", "county", "other"])
    .optional()
    .nullable(),
  location: z.string().max(500).optional().nullable(),
  landowner: z.string().max(200).optional().nullable(),
  // Address — see create-contract.ts for the rationale.
  landowner_address: z.string().max(500).optional().nullable(),
  contract_price: coerceNumberOrNull,
  bond_amount: coerceNumberOrNull,
  has_prevailing_wage: z.boolean().optional(),
  has_fringe: z.boolean().optional(),
  fringe_rate: coerceNumberOrNull,
  unit_type: z.enum(["tree", "acre", "hour"]).optional().nullable(),
  total_seedlings: coerceNumberOrNull,
  total_acres: coerceNumberOrNull,
  contact_name: z.string().max(200).optional().nullable(),
  contact_phone: z.string().max(50).optional().nullable(),
  contact_email: z.string().email().optional().or(z.literal("")).nullable(),
  foreman_id: z.string().uuid().optional().nullable(),
  prime_contractor: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
}).superRefine((data, ctx) => {
  // Only enforce company requirement if both fields are present in the
  // update payload. Partial updates that don't touch contract_type or
  // company_id should pass through untouched.
  if (data.contract_type !== undefined && data.company_id !== undefined) {
    const isPrivate = data.contract_type === "private";
    const hasCompany = !!data.company_id && data.company_id !== "";
    if (!isPrivate && !hasCompany) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["company_id"],
        message: "Select a company",
      });
    }
  }
});

export type UpdateContractInput = z.infer<typeof updateContractSchema>;
