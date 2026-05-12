-- Add the payroll fields the existing schema is missing for the timesheet
-- backfill from the running Cascadia payroll spreadsheet (Jan 16 → Apr 24).
--
-- Existing on timesheet_entries: hours_worked, drive_hours, ot_hours,
-- rate_applied, drive_rate, min_county_rate, gross_pay.
-- Missing: dt_hours (double-time), fringe_amount (per-entry fringe $).
--
-- The Payroll Tab on Project Detail (bundled free with Item 8) needs both.
-- Carolina's daily entries going forward will populate them too.

ALTER TABLE timesheet_entries
  ADD COLUMN IF NOT EXISTS dt_hours      numeric(8, 2),
  ADD COLUMN IF NOT EXISTS fringe_amount numeric(10, 2);

COMMENT ON COLUMN timesheet_entries.dt_hours IS 'Double-time hours worked (separate from OT). Backfilled from Cascadia payroll spreadsheet 2026-04-27.';
COMMENT ON COLUMN timesheet_entries.fringe_amount IS 'Per-entry fringe benefit pay in dollars. fringe_rate × hours when contract has prevailing-wage fringe; 0 otherwise.';
