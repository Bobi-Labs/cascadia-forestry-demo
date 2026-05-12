-- Open read/write policies for authenticated users on all main data tables.
-- These are intentionally permissive — proper role-based restrictions will
-- be added once the role system is fully implemented.
--
-- Tables that already have policies (users, tracker_*, prevailing_wage_rates) are skipped.

-- ============================================================
-- CONTRACTS
-- ============================================================
CREATE POLICY "auth_select_contracts" ON public.contracts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_contracts" ON public.contracts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_contracts" ON public.contracts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_contracts" ON public.contracts
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UNITS
-- ============================================================
CREATE POLICY "auth_select_units" ON public.units
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_units" ON public.units
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_units" ON public.units
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_units" ON public.units
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE POLICY "auth_select_employees" ON public.employees
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_employees" ON public.employees
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TIMESHEETS
-- ============================================================
CREATE POLICY "auth_select_timesheets" ON public.timesheets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_timesheets" ON public.timesheets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_timesheets" ON public.timesheets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TIMESHEET ENTRIES
-- ============================================================
CREATE POLICY "auth_select_timesheet_entries" ON public.timesheet_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_timesheet_entries" ON public.timesheet_entries
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_timesheet_entries" ON public.timesheet_entries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- COMPANIES (read-only for most)
-- ============================================================
CREATE POLICY "auth_select_companies" ON public.companies
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- WORK TYPES (read-only)
-- ============================================================
CREATE POLICY "auth_select_work_types" ON public.work_types
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- CREW SETS + MEMBERS
-- ============================================================
CREATE POLICY "auth_select_crew_sets" ON public.crew_sets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_crew_sets" ON public.crew_sets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_crew_sets" ON public.crew_sets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_crew_sets" ON public.crew_sets
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_crew_set_members" ON public.crew_set_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_crew_set_members" ON public.crew_set_members
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_delete_crew_set_members" ON public.crew_set_members
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE POLICY "auth_select_vehicles" ON public.vehicles
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- COMPLIANCE ITEMS
-- ============================================================
CREATE POLICY "auth_select_compliance_items" ON public.compliance_items
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PRODUCTION LOGS
-- ============================================================
CREATE POLICY "auth_select_production_logs" ON public.production_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_production_logs" ON public.production_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- UNIT NOTES
-- ============================================================
CREATE POLICY "auth_select_unit_notes" ON public.unit_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_unit_notes" ON public.unit_notes
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- TIMESHEET UNIT HOURS
-- ============================================================
CREATE POLICY "auth_select_timesheet_unit_hours" ON public.timesheet_unit_hours
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_timesheet_unit_hours" ON public.timesheet_unit_hours
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_timesheet_unit_hours" ON public.timesheet_unit_hours
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
