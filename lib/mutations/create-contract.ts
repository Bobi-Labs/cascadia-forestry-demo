import { createClient } from "@/lib/supabase/client";
import {
  createContractSchema,
  type CreateContractInput,
} from "@/lib/schemas/create-contract";

export async function createContract(input: CreateContractInput) {
  const parsed = createContractSchema.parse(input);
  const supabase = createClient();

  // Private contracts can have null company_id (Jaime: private/landowner
  // jobs can be worked by either Cascadia or Ramos in the same year).
  // Empty string also maps to null since HTML selects send "" when cleared.
  const companyId = parsed.company_id && parsed.company_id !== "" ? parsed.company_id : null;

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      name: parsed.name,
      company_id: companyId,
      status: parsed.status,
      start_date: parsed.start_date ?? null,
      end_date: parsed.end_date ?? null,
      contract_number: parsed.contract_number ?? null,
      contract_type: parsed.contract_type ?? null,
      location: parsed.location ?? null,
      landowner: parsed.landowner ?? null,
      landowner_address: parsed.landowner_address ?? null,
      contract_price: parsed.contract_price ?? null,
      bond_amount: parsed.bond_amount ?? null,
      has_prevailing_wage: parsed.has_prevailing_wage ?? false,
      has_fringe: parsed.has_fringe ?? false,
      fringe_rate: parsed.fringe_rate ?? null,
      unit_type: parsed.unit_type ?? null,
      total_seedlings: parsed.total_seedlings ?? null,
      total_acres: parsed.total_acres ?? null,
      contact_name: parsed.contact_name ?? null,
      contact_phone: parsed.contact_phone ?? null,
      contact_email: parsed.contact_email ?? null,
      foreman_id: parsed.foreman_id ?? null,
      prime_contractor: parsed.prime_contractor ?? null,
      notes: parsed.notes ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false as const, error: "A contract with this name already exists" };
    }
    console.error("createContract error:", error);
    return { success: false as const, error: "Something went wrong" };
  }

  // Create Drive folders — await so we catch errors
  try {
    const driveRes = await fetch("/api/drive/contract-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ contractId: data.id, contractName: parsed.name, landowner: parsed.landowner ?? "" }),
    });
    const driveJson = await driveRes.json();
    if (!driveRes.ok) {
      console.error("Drive folder creation failed:", driveJson);
    }
  } catch (err) {
    console.error("Drive folder creation error:", err);
  }

  return { success: true as const, data };
}
