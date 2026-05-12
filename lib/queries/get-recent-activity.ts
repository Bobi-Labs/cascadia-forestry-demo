import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/demo-mode";
import { demoFixtures } from "@/lib/demo-fixtures";

/**
 * Unified recent activity feed for the overview dashboard. Pulls the most
 * recent events from across the system:
 *   - Timesheets submitted/approved
 *   - Expenses imported
 *   - Contracts created
 *   - Tracker items completed
 *
 * Returns up to 15 events, sorted newest first. Each event has a
 * standardised shape so the UI can render them with one component.
 */
export type ActivityEvent = {
  id: string;
  kind: "timesheet" | "expense_batch" | "contract" | "tracker";
  timestamp: string;
  title: string;
  subtitle?: string;
  href?: string;
};

export async function getRecentActivity(
  companyFilter: "cascadia" | "ramos" | null = null,
): Promise<ActivityEvent[]> {
  if (IS_DEMO_MODE) {
    return buildDemoRecentActivity();
  }

  const supabase = createClient();

  const CASCADIA_ID = "00000000-0000-0000-0000-000000000001";
  const RAMOS_ID = "00000000-0000-0000-0000-000000000002";

  const matchesCompany = (cid: string | null | undefined) => {
    if (!companyFilter) return true;
    if (!cid) return true;
    return companyFilter === "cascadia" ? cid === CASCADIA_ID : cid === RAMOS_ID;
  };

  const events: ActivityEvent[] = [];

  // Recent timesheets (last 30)
  const { data: ts } = await supabase
    .from("timesheets")
    .select(
      `id, date, status, created_at, contracts:contracts(name, company_id), employees:employees!foreman_id(first_name, last_name)`,
    )
    .order("created_at", { ascending: false })
    .limit(30);
  for (const t of ts || []) {
    const contract = t.contracts as { name: string | null; company_id: string | null } | null;
    if (!matchesCompany(contract?.company_id)) continue;
    const foreman = t.employees as { first_name: string | null; last_name: string | null } | null;
    const foremanName = foreman ? `${foreman.first_name ?? ""} ${foreman.last_name ?? ""}`.trim() : "—";
    events.push({
      id: `ts-${t.id}`,
      kind: "timesheet",
      timestamp: t.created_at,
      title: `Timesheet ${t.status}`,
      subtitle: `${foremanName} · ${contract?.name || "—"} · ${t.date}`,
    });
  }

  // Recent expense imports
  const { data: imports } = await supabase
    .from("expense_imports")
    .select("id, created_at, imported_count, tab_name")
    .order("created_at", { ascending: false })
    .limit(5);
  for (const i of imports || []) {
    if (!i.created_at) continue;
    events.push({
      id: `exp-${i.id}`,
      kind: "expense_batch",
      timestamp: i.created_at,
      title: `Expense batch imported`,
      subtitle: `${i.imported_count || 0} rows · ${i.tab_name || "—"}`,
    });
  }

  // Recent contracts created
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, name, landowner, company_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  for (const c of contracts || []) {
    if (!matchesCompany(c.company_id)) continue;
    events.push({
      id: `con-${c.id}`,
      kind: "contract",
      timestamp: c.created_at,
      title: `Contract added`,
      subtitle: `${c.name} · ${c.landowner || "—"}`,
    });
  }

  // Recent tracker items completed (status='done')
  const { data: tracker } = await supabase
    .from("tracker_items")
    .select("id, title, assigned_to, updated_at, status")
    .eq("status", "done")
    .order("updated_at", { ascending: false })
    .limit(10);
  for (const t of tracker || []) {
    if (!t.updated_at) continue;
    events.push({
      id: `trk-${t.id}`,
      kind: "tracker",
      timestamp: t.updated_at,
      title: `${t.title}`,
      subtitle: `Completed by ${t.assigned_to || "—"}`,
    });
  }

  // Sort all events by timestamp desc, take top 15
  events.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return events.slice(0, 15);
}

function buildDemoRecentActivity(): ActivityEvent[] {
  const ts = (demoFixtures.timesheets ?? []) as Array<Record<string, unknown>>;
  const employees = (demoFixtures.employees ?? []) as Array<Record<string, unknown>>;
  const contracts = (demoFixtures.contracts ?? []) as Array<Record<string, unknown>>;
  const empById = new Map(employees.map((e) => [e.id as string, e]));
  const contractById = new Map(contracts.map((c) => [c.id as string, c]));

  const events: ActivityEvent[] = ts.map((t) => {
    const emp = empById.get(t.foreman_id as string);
    const contract = contractById.get(t.contract_id as string);
    const foremanName = emp
      ? `${emp.first_name as string} ${emp.last_name as string}`
      : "Unknown";
    const contractName = (contract?.name as string) ?? "Unknown";
    return {
      id: `ts-${t.id as string}`,
      kind: "timesheet" as const,
      timestamp: (t.created_at as string) ?? (t.date as string),
      title: `Timesheet ${t.status as string}`,
      subtitle: `${foremanName} · ${contractName} · ${t.date as string}`,
    };
  });

  events.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return events.slice(0, 15);
}
