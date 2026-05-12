import { z } from "zod";

export const createEmployeeSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Invalid email").optional().or(z.literal("")).nullable(),
  company_auth: z.enum(["cascadia", "ramos", "both"]),
  is_foreman: z.boolean().default(false),
  is_driver: z.boolean().default(false),
  is_h2b: z.boolean().default(false),
  is_office: z.boolean().default(false),
  rate_type: z.enum(["hourly", "daily"]).default("hourly"),
  rate: z.coerce.number().min(0).optional().nullable(),
  daily_rate: z.coerce.number().min(0).optional().nullable(),
  status: z.enum(["active", "inactive", "seasonal"]).default("active"),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
