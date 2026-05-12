import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/demo-mode";

/**
 * Aggregated payroll analytics across ALL contracts. Used on the
 * Analytics → Payroll tab to power the live dashboard (replaces the
 * earlier mock data).
 *
 * Pulls every timesheet entry (paginated to bypass the 1000-row
 * Supabase default cap) and rolls them up into:
 *   - top-line YTD totals (gross, OT hours, drive hours, fringe)
 *   - per-contract labor totals (sorted)
 *   - weekly OT trend (last 12 weeks with data)
 *   - top-earning employees (top 10 by gross)
 *
 * companyFilter: 'cascadia' | 'ramos' | null (= all). Filters by
 * the contract's company_id; null contract company (privates) is
 * included in both views.
 */
export async function getPayrollAnalytics(
  companyFilter: "cascadia" | "ramos" | null = null,
) {
  if (IS_DEMO_MODE) {
    return buildDemoPayrollAnalytics(companyFilter);
  }

  const supabase = createClient();

  // Page through all entries
  type EntryRow = {
    hours_worked: number | null;
    drive_hours: number | null;
    ot_hours: number | null;
    gross_pay: number | null;
    fringe_amount: number | null;
    employee_id: string;
    employees: { first_name: string | null; last_name: string | null } | null;
    timesheets: {
      date: string;
      contract_id: string;
      contracts: {
        id: string;
        name: string | null;
        company_id: string | null;
      } | null;
    } | null;
  };
  const all: EntryRow[] = [];
  let pageStart = 0;
  while (true) {
    const { data, error } = await supabase
      .from("timesheet_entries")
      .select(
        `
        hours_worked,
        drive_hours,
        ot_hours,
        gross_pay,
        fringe_amount,
        employee_id,
        employees:employees(first_name, last_name),
        timesheets!inner(
          date,
          contract_id,
          contracts:contracts(id, name, company_id)
        )
        `,
      )
      .range(pageStart, pageStart + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as EntryRow[]));
    if (data.length < 1000) break;
    pageStart += 1000;
  }

  // Cascadia/Ramos company-id constants (mirror lib/database.types)
  const CASCADIA_ID = "00000000-0000-0000-0000-000000000001";
  const RAMOS_ID = "00000000-0000-0000-0000-000000000002";

  // Apply company filter
  const filtered = all.filter((e) => {
    if (!companyFilter) return true;
    const cid = e.timesheets?.contracts?.company_id;
    if (!cid) return true; // private contracts show in both
    if (companyFilter === "cascadia") return cid === CASCADIA_ID;
    if (companyFilter === "ramos") return cid === RAMOS_ID;
    return true;
  });

  // Top-line totals
  const totals = filtered.reduce(
    (s, e) => ({
      gross: s.gross + Number(e.gross_pay ?? 0),
      regHours: s.regHours + Number(e.hours_worked ?? 0),
      otHours: s.otHours + Number(e.ot_hours ?? 0),
      driveHours: s.driveHours + Number(e.drive_hours ?? 0),
      fringe: s.fringe + Number(e.fringe_amount ?? 0),
    }),
    { gross: 0, regHours: 0, otHours: 0, driveHours: 0, fringe: 0 },
  );

  // Per-contract labor totals
  const byContractMap = new Map<
    string,
    { contractId: string; name: string; gross: number; regHours: number }
  >();
  for (const e of filtered) {
    const c = e.timesheets?.contracts;
    if (!c) continue;
    if (!byContractMap.has(c.id)) {
      byContractMap.set(c.id, { contractId: c.id, name: c.name || "Unknown", gross: 0, regHours: 0 });
    }
    const r = byContractMap.get(c.id)!;
    r.gross += Number(e.gross_pay ?? 0);
    r.regHours += Number(e.hours_worked ?? 0);
  }
  const byContract = [...byContractMap.values()]
    .filter((r) => r.gross > 0)
    .sort((a, b) => b.gross - a.gross);

  // Weekly OT trend — group by ISO week
  const byWeekMap = new Map<string, { week: string; otHours: number; regHours: number }>();
  for (const e of filtered) {
    const date = e.timesheets?.date;
    if (!date) continue;
    // Simple week key: YYYY-WW (use Monday-anchored week)
    const d = new Date(date + "T00:00:00");
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    const weekKey = monday.toISOString().slice(0, 10);
    if (!byWeekMap.has(weekKey)) byWeekMap.set(weekKey, { week: weekKey, otHours: 0, regHours: 0 });
    const r = byWeekMap.get(weekKey)!;
    r.otHours += Number(e.ot_hours ?? 0);
    r.regHours += Number(e.hours_worked ?? 0);
  }
  const byWeek = [...byWeekMap.values()].sort((a, b) => a.week.localeCompare(b.week));

  // Top earners
  const byEmpMap = new Map<
    string,
    { employeeId: string; name: string; gross: number; regHours: number; otHours: number }
  >();
  for (const e of filtered) {
    const id = e.employee_id;
    const name = e.employees
      ? `${e.employees.last_name ?? ""}, ${e.employees.first_name ?? ""}`.replace(/^,\s*|\s*,\s*$/g, "")
      : "(unknown)";
    if (!byEmpMap.has(id)) {
      byEmpMap.set(id, { employeeId: id, name, gross: 0, regHours: 0, otHours: 0 });
    }
    const r = byEmpMap.get(id)!;
    r.gross += Number(e.gross_pay ?? 0);
    r.regHours += Number(e.hours_worked ?? 0);
    r.otHours += Number(e.ot_hours ?? 0);
  }
  const topEarners = [...byEmpMap.values()].sort((a, b) => b.gross - a.gross).slice(0, 10);

  return {
    totals,
    byContract,
    byWeek,
    topEarners,
    entryCount: filtered.length,
    employeeCount: byEmpMap.size,
  };
}

export type PayrollAnalytics = Awaited<ReturnType<typeof getPayrollAnalytics>>;

function buildDemoPayrollAnalytics(
  _companyFilter: "cascadia" | "ramos" | null,
): PayrollAnalytics {
  // Hardcoded aggregations consistent with the dashboard sparklines:
  // ~$190K weekly across 6 active contracts, OT trending up.
  return {
    totals: {
      gross: 1842500,
      regHours: 14250,
      otHours: 685,
      driveHours: 1820,
      fringe: 18400,
    },
    byContract: [
      { contractId: "vanessa-0-0", name: "Vanessa", gross: 524800, regHours: 3920 },
      { contractId: "kirk-000-0", name: "Kirk", gross: 612300, regHours: 4520 },
      { contractId: "cedar-00-0", name: "Cedar Ridge", gross: 412000, regHours: 3180 },
      { contractId: "summit-0-0", name: "Summit Ridge", gross: 293400, regHours: 2630 },
    ],
    byWeek: [
      { week: "2026-02-23", otHours: 28, regHours: 1180 },
      { week: "2026-03-02", otHours: 34, regHours: 1240 },
      { week: "2026-03-09", otHours: 41, regHours: 1310 },
      { week: "2026-03-16", otHours: 38, regHours: 1290 },
      { week: "2026-03-23", otHours: 45, regHours: 1360 },
      { week: "2026-03-30", otHours: 52, regHours: 1390 },
      { week: "2026-04-06", otHours: 47, regHours: 1410 },
      { week: "2026-04-13", otHours: 58, regHours: 1430 },
      { week: "2026-04-20", otHours: 51, regHours: 1410 },
      { week: "2026-04-27", otHours: 63, regHours: 1450 },
      { week: "2026-05-04", otHours: 67, regHours: 1444 },
    ],
    topEarners: [
      { employeeId: "marco-0-0", name: "Perez, Marco", gross: 8420, regHours: 312, otHours: 18 },
      { employeeId: "luis-00-0", name: "Garcia, Luis", gross: 8210, regHours: 305, otHours: 21 },
      { employeeId: "diego-0-0", name: "Vargas, Diego", gross: 9140, regHours: 330, otHours: 38 },
      { employeeId: "carlos-0", name: "Ruiz, Carlos", gross: 9080, regHours: 328, otHours: 36 },
      { employeeId: "elena-0-0", name: "Herrera, Elena", gross: 7920, regHours: 298, otHours: 12 },
    ],
    entryCount: 1284,
    employeeCount: 32,
  };
}
