import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/demo-mode";
import {
  createEmployeeSchema,
  type CreateEmployeeInput,
} from "@/lib/schemas/create-employee";

export async function createEmployee(input: CreateEmployeeInput) {
  const parsed = createEmployeeSchema.parse(input);

  if (IS_DEMO_MODE) {
    return {
      success: true as const,
      data: { id: `demo-${Date.now()}`, created_at: new Date().toISOString() },
    };
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("employees")
    .insert({
      first_name: parsed.first_name,
      last_name: parsed.last_name,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      company_auth: parsed.company_auth,
      is_foreman: parsed.is_foreman,
      is_driver: parsed.is_driver,
      is_h2b: parsed.is_h2b,
      is_office: parsed.is_office,
      rate_type: parsed.rate_type,
      rate: parsed.rate ?? null,
      daily_rate: parsed.daily_rate ?? null,
      status: parsed.status,
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("createEmployee error:", error);
    return { success: false as const, error: "Something went wrong" };
  }

  return { success: true as const, data };
}
