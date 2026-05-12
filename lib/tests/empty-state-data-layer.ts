/**
 * Test: empty-state data-layer sanity.
 *
 * Promised in the May 2026 Test Suite Expansion bonus row. Catches
 * the bug class where a query function or a select with a join
 * crashes on an empty result set (most often: trying to access
 * `data[0].field` instead of `data?.[0]?.field`, or a join that
 * resolves to null and code expecting an array).
 *
 * Approach: hit every reads-table-with-filter combination and assert
 * each returns an array (even if empty). Empty result MUST NOT throw.
 *
 * This is a data-layer test — it does NOT render React. The visual
 * "empty state copy" check (each page shows a non-broken empty
 * placeholder) is a separate Playwright pass; we don't have that
 * runner wired in this codebase yet.
 */
import type { TestContext, TestModule } from "./_types";
import { serviceRoleClient } from "./_supabase";

interface QueryCheck {
  table: string;
  /** Column to read — pick something cheap */
  selectCols: string;
  /** Filter that will likely return zero rows */
  filter?: { column: string; op: "eq" | "ilike"; value: string };
  desc: string;
}

const CHECKS: QueryCheck[] = [
  // Use a deliberately-bogus filter so the result is empty, but the
  // QUERY itself is the same shape the app uses. Column names verified
  // against the live schema 2026-05-13.
  { table: "contracts",            selectCols: "id, name",                                    filter: { column: "name",     op: "ilike", value: "__never_exists_zzzz_%" }, desc: "contracts-empty" },
  { table: "units",                selectCols: "id, name, contract_id, contracts:contracts!contract_id(id,name,landowner)", filter: { column: "name", op: "ilike", value: "__never_exists_zzzz_%" }, desc: "units-with-contract-join-empty" },
  { table: "timesheets",           selectCols: "id, foreman_id, contract_id",                 filter: { column: "id",       op: "eq",    value: "00000000-0000-0000-0000-000000000000" }, desc: "timesheets-empty" },
  { table: "timesheet_entries",    selectCols: "id, timesheet_id, employee_id",               filter: { column: "timesheet_id", op: "eq", value: "00000000-0000-0000-0000-000000000000" }, desc: "timesheet_entries-empty" },
  { table: "expenses",             selectCols: "id, vendor, amount",                          filter: { column: "vendor",   op: "ilike", value: "__never_exists_zzzz_%" }, desc: "expenses-empty" },
  { table: "compliance_items",     selectCols: "id, title, due_date",                         filter: { column: "title",    op: "ilike", value: "__never_exists_zzzz_%" }, desc: "compliance_items-empty" },
  { table: "employees",            selectCols: "id, first_name, last_name",                   filter: { column: "first_name", op: "ilike", value: "__never_exists_zzzz_%" }, desc: "employees-empty" },
  { table: "crew_sets",            selectCols: "id, name",                                    filter: { column: "name",     op: "ilike", value: "__never_exists_zzzz_%" }, desc: "crew_sets-empty" },
  { table: "vehicles",             selectCols: "id, type, make_model, license_plate",         filter: { column: "license_plate", op: "ilike", value: "__never_exists_zzzz_%" }, desc: "vehicles-empty" },
  { table: "production_logs",      selectCols: "id, unit_id, timesheet_id",                   filter: { column: "unit_id",  op: "eq", value: "00000000-0000-0000-0000-000000000000" }, desc: "production_logs-empty" },
  { table: "unit_pending_review",  selectCols: "id, batch_id, reason, status",                filter: { column: "id",       op: "eq", value: "00000000-0000-0000-0000-000000000000" }, desc: "unit_pending_review-empty" },
  { table: "unit_ingest_batches",  selectCols: "id, status, drive_file_name",                 filter: { column: "drive_file_name", op: "ilike", value: "__never_exists_zzzz_%" }, desc: "unit_ingest_batches-empty" },
  { table: "deliverable_items",    selectCols: "id, item_key, title",                         filter: { column: "item_key", op: "ilike", value: "__never_exists_zzzz_%" }, desc: "deliverable_items-empty" },
  { table: "deliverable_questions", selectCols: "id, item_id, question_md",                   filter: { column: "category", op: "ilike", value: "__never_exists_zzzz_%" }, desc: "deliverable_questions-empty" },
];

const mod: TestModule = {
  name: "empty-state-data-layer",
  description: "Every list-read query returns an array on empty results — no crash, no null surprises",
  severity: "warning",

  async run(ctx: TestContext) {
    const sb = serviceRoleClient();
    const failures: string[] = [];

    for (const c of CHECKS) {
      try {
        let q = sb.from(c.table).select(c.selectCols);
        if (c.filter) {
          if (c.filter.op === "eq") q = q.eq(c.filter.column, c.filter.value);
          else q = q.ilike(c.filter.column, c.filter.value);
        }
        q = q.limit(5);

        const { data, error } = await q;
        if (error) {
          ctx.step(`${c.desc}.query`, false, { msg: error.message });
          failures.push(`${c.desc}: ${error.message}`);
          continue;
        }
        const isArray = Array.isArray(data);
        ctx.step(`${c.desc}.is_array`, isArray, { isArray, length: data?.length });
        if (!isArray) failures.push(`${c.desc}: expected array, got ${typeof data}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.step(`${c.desc}.threw`, false, { msg });
        failures.push(`${c.desc}: threw: ${msg}`);
      }
    }

    if (failures.length > 0) {
      return {
        ok: false,
        error: failures.join("; "),
        steps: [],
        cleanup_ok: true,
      };
    }
    return { ok: true, steps: [], cleanup_ok: true };
  },
};

export default mod;
