-- Tracker board scope + banner image.
--
-- Adds two columns to tracker_projects:
--   scope        — 'company' | 'site_build' | 'personal'
--                  Drives the in-app Work Tracker BoardSwitcher pills inside
--                  the HeaderCard (replaces the old above-dashboard tab nav).
--   banner_url   — public URL of the banner image rendered behind the project
--                  title overlay on the HeaderCard. NULL falls back to the
--                  gradient placeholder.
--
-- Both are additive + nullable. The backfill below tags every existing row:
--   - 10000000-...0001 → 'site_build' (OURS dev project)
--   - 20000000-...0001 → 'company'    (CLIENT-facing board)
--   - any row with owned_by_email → 'personal'
--
-- After this lands, the BoardSwitcher renders Company / Site Build (admin
-- only) / Personal pills in HeaderCard's Cell 1, and the legacy tab nav in
-- components/pages/work-tracker.tsx goes away.

ALTER TABLE tracker_projects
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS banner_url text;

-- Constraint matches bobi-worktracker's three scopes. Nullable so older rows
-- that haven't been categorized yet don't blow up.
ALTER TABLE tracker_projects
  DROP CONSTRAINT IF EXISTS tracker_projects_scope_check;
ALTER TABLE tracker_projects
  ADD CONSTRAINT tracker_projects_scope_check
  CHECK (scope IS NULL OR scope IN ('company', 'site_build', 'personal'));

-- Backfill: existing rows
UPDATE tracker_projects
SET scope = 'site_build'
WHERE id = '10000000-0000-0000-0000-000000000001'
  AND scope IS NULL;

UPDATE tracker_projects
SET scope = 'company'
WHERE id = '20000000-0000-0000-0000-000000000001'
  AND scope IS NULL;

UPDATE tracker_projects
SET scope = 'personal'
WHERE owned_by_email IS NOT NULL
  AND scope IS NULL;

-- Index used by BoardSwitcher's "find the company / site_build project"
-- lookup (scope is small-cardinality so a partial index keeps it lean).
CREATE INDEX IF NOT EXISTS idx_tracker_projects_scope
  ON tracker_projects (scope)
  WHERE scope IS NOT NULL;
