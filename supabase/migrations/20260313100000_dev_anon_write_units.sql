-- Dev-only open write policies for units table.
-- Delete these when auth is added (same pattern as other dev_anon policies).

CREATE POLICY "dev_anon_insert_units" ON public.units
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "dev_anon_update_units" ON public.units
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_delete_units" ON public.units
  FOR DELETE TO anon USING (true);

-- Also ensure contracts and employees have write access for forms
CREATE POLICY "dev_anon_insert_contracts" ON public.contracts
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "dev_anon_update_contracts" ON public.contracts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Timesheets write (for approve/reject)
CREATE POLICY "dev_anon_update_timesheets" ON public.timesheets
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
