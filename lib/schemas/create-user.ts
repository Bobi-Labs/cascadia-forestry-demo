import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["admin", "office", "foreman", "crew"]),
  company_id: z
    .string()
    .uuid("Invalid company ID")
    .nullable()
    .default(null),
  language_pref: z.enum(["en", "es"]).default("en"),
  permissions: z
    .record(z.unknown())
    .nullable()
    .default(null),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
