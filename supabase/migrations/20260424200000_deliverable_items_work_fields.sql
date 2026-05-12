-- Add work-state columns to deliverable_items so Ongoing Work rows can
-- show at-a-glance columns: Due Date, Invoice (already on table), State,
-- and Status. Added per the 2026-04-24 deliverables panel overhaul.
--
-- All nullable — existing rows keep working without backfill. Fill per
-- item as work progresses.
--
-- Free-text rather than an enum so we can evolve vocabulary without
-- migrations. UI surfaces the values via a color-coded badge map that
-- falls back gracefully on unknown values.

ALTER TABLE deliverable_items
  ADD COLUMN IF NOT EXISTS due_date      date,
  ADD COLUMN IF NOT EXISTS work_state    text,
  ADD COLUMN IF NOT EXISTS health_status text;

COMMENT ON COLUMN deliverable_items.due_date IS
  'Target ship date for an ongoing item. Null = not yet scheduled.';
COMMENT ON COLUMN deliverable_items.work_state IS
  'Lifecycle phase of the work. Conventional values: scoping, building, testing, done. Free-text to allow evolution.';
COMMENT ON COLUMN deliverable_items.health_status IS
  'Health flag surfaced on the Ongoing Work row. Conventional values: on_track, needs_input, blocked, at_risk. Null = untagged.';
