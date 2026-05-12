import { createClient } from "@/lib/supabase/client";

/**
 * Aggregated payroll data for a specific contract. Used on the contract
 * detail page's Payroll tab. Pulls all timesheet entries on this contract
 * and rolls them up into:
 *   - top-line totals (gross, hours, OT hours, drive hours, fringe)
 *   - per-employee breakdown
 *   - per-month time series for the gross trend
 *
 * Returns shape:
 *   {
 *     totals: { gross, regHours, otHours, driveHours, fringe, entryCount },
 *     byEmployee: [{ employee, regHours, otHours, driveHours, gross, fringe }],
 *     byMonth: [{ month, gross, regHours }]
 *   }
 *
 * Source data is the unified Cascadia payroll backfill (Dec 8 2025 →
 * Apr 18 2026 at time of writing). Going forward Carolina's daily entries
 * land in the same table.
 */
export async function getContractPayroll(contractId: string) {
  const supabase = createClient();

  // Page through entries — Supabase default 1000-row cap would silently
  // truncate. Use .range() to get everything.
  const all: Array<{
    hours_worked: number | null;
    drive_hours: number | null;
    ot_hours: number | null;
    gross_pay: number | null;
    fringe_amount: number | null;
    employee_id: string;
    employees: { id: string; first_name: string | null; last_name: string | null } | null;
    timesheets: { date: string } | null;
  }> = [];
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
        employees:employees(id, first_name, last_name),
        timesheets!inner(date, contract_id)
        `,
      )
      .eq("timesheets.contract_id", contractId)
      .range(pageStart, pageStart + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as typeof all));
    if (data.length < 1000) break;
    pageStart += 1000;
  }

  // Top-line totals
  const totals = all.reduce(
    (s, e) => ({
      gross: s.gross + Number(e.gross_pay ?? 0),
      regHours: s.regHours + Number(e.hours_worked ?? 0),
      otHours: s.otHours + Number(e.ot_hours ?? 0),
      driveHours: s.driveHours + Number(e.drive_hours ?? 0),
      fringe: s.fringe + Number(e.fringe_amount ?? 0),
      entryCount: s.entryCount + 1,
    }),
    { gross: 0, regHours: 0, otHours: 0, driveHours: 0, fringe: 0, entryCount: 0 },
  );

  // Per-employee breakdown
  const byEmpMap = new Map<
    string,
    { employeeId: string; name: string; regHours: number; otHours: number; driveHours: number; gross: number; fringe: number }
  >();
  for (const e of all) {
    const id = e.employee_id;
    const name = e.employees
      ? `${e.employees.last_name ?? ""}, ${e.employees.first_name ?? ""}`.replace(/^,\s*|\s*,\s*$/g, "")
      : "(unknown)";
    if (!byEmpMap.has(id)) {
      byEmpMap.set(id, { employeeId: id, name, regHours: 0, otHours: 0, driveHours: 0, gross: 0, fringe: 0 });
    }
    const r = byEmpMap.get(id)!;
    r.regHours += Number(e.hours_worked ?? 0);
    r.otHours += Number(e.ot_hours ?? 0);
    r.driveHours += Number(e.drive_hours ?? 0);
    r.gross += Number(e.gross_pay ?? 0);
    r.fringe += Number(e.fringe_amount ?? 0);
  }
  const byEmployee = [...byEmpMap.values()].sort((a, b) => b.gross - a.gross);

  // Per-month time series (for the gross trend chart later)
  const byMonthMap = new Map<string, { month: string; gross: number; regHours: number }>();
  for (const e of all) {
    const date = e.timesheets?.date;
    if (!date) continue;
    const month = date.slice(0, 7); // YYYY-MM
    if (!byMonthMap.has(month)) byMonthMap.set(month, { month, gross: 0, regHours: 0 });
    const r = byMonthMap.get(month)!;
    r.gross += Number(e.gross_pay ?? 0);
    r.regHours += Number(e.hours_worked ?? 0);
  }
  const byMonth = [...byMonthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  return { totals, byEmployee, byMonth };
}

export type ContractPayroll = Awaited<ReturnType<typeof getContractPayroll>>;
