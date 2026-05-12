import { createClient } from "@/lib/supabase/client";

/**
 * Live overview metrics for the main dashboard's KPI strip and sparklines.
 *
 * Pulls timesheet entries from the last ~30 days to power:
 *   - Current week gross (Mon-Sun) — replaces the old avg-rate estimate
 *   - Daily gross series for the last 14 days (sparkline source)
 *   - Daily reg-hours series for the last 14 days (crew activity)
 *
 * Paginated via .range() to bypass the Supabase 1000-row default cap.
 *
 * @param companyFilter Optional 'cascadia' | 'ramos' company filter.
 *   Null contracts (privates) appear in both.
 */
export async function getOverviewMetrics(
  companyFilter: "cascadia" | "ramos" | null = null,
) {
  const supabase = createClient();

  // 30-day window (covers current + previous week for sparklines)
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString().slice(0, 10);

  type EntryRow = {
    employee_id: string;
    hours_worked: number | null;
    drive_hours: number | null;
    ot_hours: number | null;
    gross_pay: number | null;
    timesheets: {
      date: string;
      contracts: { company_id: string | null } | null;
    } | null;
  };
  const all: EntryRow[] = [];
  let pageStart = 0;
  while (true) {
    const { data, error } = await supabase
      .from("timesheet_entries")
      .select(
        `
        employee_id,
        hours_worked,
        drive_hours,
        ot_hours,
        gross_pay,
        timesheets!inner(
          date,
          contracts:contracts(company_id)
        )
        `,
      )
      .gte("timesheets.date", fromDate)
      .range(pageStart, pageStart + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as EntryRow[]));
    if (data.length < 1000) break;
    pageStart += 1000;
  }

  const CASCADIA_ID = "00000000-0000-0000-0000-000000000001";
  const RAMOS_ID = "00000000-0000-0000-0000-000000000002";

  const filtered = all.filter((e) => {
    if (!companyFilter) return true;
    const cid = e.timesheets?.contracts?.company_id;
    if (!cid) return true; // privates show in both
    if (companyFilter === "cascadia") return cid === CASCADIA_ID;
    if (companyFilter === "ramos") return cid === RAMOS_ID;
    return true;
  });

  // "This week" — use the most-recent 7 days of work that ACTUALLY have
  // data, not the current calendar week. The current calendar week is
  // often empty (today is mid-week before Carolina enters daily) which
  // makes a $0 "this week" reading useless.
  // Find the latest date with any data, then look back 6 days from there.
  const datesWithData = filtered
    .map((e) => e.timesheets?.date)
    .filter((d): d is string => !!d)
    .sort();
  const lastDataDate = datesWithData[datesWithData.length - 1] || today.toISOString().slice(0, 10);
  const lastData = new Date(lastDataDate + "T00:00:00");
  const weekStart = new Date(lastData);
  weekStart.setDate(lastData.getDate() - 6); // 7-day window inclusive
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = lastDataDate;

  // Current-week sums
  const weekEntries = filtered.filter((e) => {
    const d = e.timesheets?.date;
    if (!d) return false;
    return d >= weekStartStr && d <= weekEndStr;
  });
  const weekTotals = weekEntries.reduce(
    (s, e) => ({
      gross: s.gross + Number(e.gross_pay ?? 0),
      regHours: s.regHours + Number(e.hours_worked ?? 0),
      otHours: s.otHours + Number(e.ot_hours ?? 0),
      driveHours: s.driveHours + Number(e.drive_hours ?? 0),
    }),
    { gross: 0, regHours: 0, otHours: 0, driveHours: 0 },
  );
  const weekUniqueEmployees = new Set(weekEntries.map((e) => e.employee_id)).size;

  // 14-day daily series for sparklines
  const dailyMap = new Map<string, { gross: number; regHours: number; otHours: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dailyMap.set(d.toISOString().slice(0, 10), { gross: 0, regHours: 0, otHours: 0 });
  }
  for (const e of filtered) {
    const d = e.timesheets?.date;
    if (!d || !dailyMap.has(d)) continue;
    const r = dailyMap.get(d)!;
    r.gross += Number(e.gross_pay ?? 0);
    r.regHours += Number(e.hours_worked ?? 0);
    r.otHours += Number(e.ot_hours ?? 0);
  }
  const dailyGross = [...dailyMap.values()].map((d) => Math.round(d.gross));
  const dailyRegHours = [...dailyMap.values()].map((d) => Math.round(d.regHours));
  const dailyOTHours = [...dailyMap.values()].map((d) => Math.round(d.otHours));

  return {
    week: {
      start: weekStartStr,
      end: weekEndStr,
      gross: weekTotals.gross,
      regHours: weekTotals.regHours,
      otHours: weekTotals.otHours,
      driveHours: weekTotals.driveHours,
      uniqueEmployees: weekUniqueEmployees,
    },
    sparklines: {
      dailyGross,
      dailyRegHours,
      dailyOTHours,
    },
    fromDate,
  };
}

export type OverviewMetrics = Awaited<ReturnType<typeof getOverviewMetrics>>;
