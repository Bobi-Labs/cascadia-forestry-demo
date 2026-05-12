-- Migration: Remove all dev_anon_* bypass policies.
-- These were used during development to allow unauthenticated access.
-- Real RLS policies (from migration 002) + auth take over.
--
-- ⚠️  ONLY PUSH THIS after verifying all 6 users can login and see correct data.

-- bids
DROP POLICY IF EXISTS "dev_anon_read" ON public.bids;

-- compliance_items
DROP POLICY IF EXISTS "dev_anon_read" ON public.compliance_items;

-- contract_documents
DROP POLICY IF EXISTS "dev_anon_read" ON public.contract_documents;

-- contracts
DROP POLICY IF EXISTS "dev_anon_read" ON public.contracts;

-- crew_set_members
DROP POLICY IF EXISTS "dev_anon_read" ON public.crew_set_members;

-- crew_sets
DROP POLICY IF EXISTS "dev_anon_read" ON public.crew_sets;

-- employees
DROP POLICY IF EXISTS "dev_anon_read" ON public.employees;

-- notifications
DROP POLICY IF EXISTS "dev_anon_read" ON public.notifications;

-- production_logs
DROP POLICY IF EXISTS "dev_anon_read" ON public.production_logs;
DROP POLICY IF EXISTS "dev_anon_insert" ON public.production_logs;
DROP POLICY IF EXISTS "dev_anon_delete" ON public.production_logs;

-- timesheet_entries
DROP POLICY IF EXISTS "dev_anon_read" ON public.timesheet_entries;
DROP POLICY IF EXISTS "dev_anon_insert" ON public.timesheet_entries;
DROP POLICY IF EXISTS "dev_anon_delete" ON public.timesheet_entries;

-- timesheet_unit_hours
DROP POLICY IF EXISTS "dev_anon_read" ON public.timesheet_unit_hours;
DROP POLICY IF EXISTS "dev_anon_insert" ON public.timesheet_unit_hours;
DROP POLICY IF EXISTS "dev_anon_delete" ON public.timesheet_unit_hours;

-- timesheets
DROP POLICY IF EXISTS "dev_anon_read" ON public.timesheets;
DROP POLICY IF EXISTS "dev_anon_insert" ON public.timesheets;
DROP POLICY IF EXISTS "dev_anon_update" ON public.timesheets;
DROP POLICY IF EXISTS "dev_anon_delete" ON public.timesheets;

-- units
DROP POLICY IF EXISTS "dev_anon_read" ON public.units;

-- vehicles
DROP POLICY IF EXISTS "dev_anon_read" ON public.vehicles;

-- Clean up the temporary helper function
DROP FUNCTION IF EXISTS public.list_dev_policies();
