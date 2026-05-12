import { z } from "zod";

export const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().min(1, "First name is required").optional(),
  last_name: z.string().min(1, "Last name is required").optional(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  address_us: z.string().max(500).optional().nullable(),
  rate: z.coerce.number().min(0).optional().nullable(),
  daily_rate: z.coerce.number().min(0).optional().nullable(),
  rate_type: z.enum(["hourly", "daily"]).optional(),
  is_h2b: z.boolean().optional(),
  is_driver: z.boolean().optional(),
  is_foreman: z.boolean().optional(),
  is_office: z.boolean().optional(),
  company_auth: z.enum(["cascadia", "ramos", "both"]).optional(),
  status: z.enum(["active", "inactive", "terminated"]).optional(),
  passport_exp: z.string().optional().nullable(),
  visa_exp: z.string().optional().nullable(),
  dl_exp: z.string().optional().nullable(),
  drive_auth_exp: z.string().optional().nullable(),
  cpr_exp: z.string().optional().nullable(),
  herbicide_license_exp: z.string().optional().nullable(),
  fingerprints_exp: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
