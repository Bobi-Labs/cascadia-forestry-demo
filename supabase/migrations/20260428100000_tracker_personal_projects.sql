-- Personal tracker projects per user.
--
-- Adds owned_by_email to tracker_projects so the new "Personal" tab in
-- the in-app Work Tracker can render a private board scoped to the
-- current logged-in user. Each user gets their own row; only the owner
-- sees their tracker_items.
--
-- All roles get a personal board (admin, owner, office, foreman, employee).
-- The Personal tab UI hides the Assignee select on add-task since there's
-- only one possible assignee.

ALTER TABLE tracker_projects
  ADD COLUMN IF NOT EXISTS owned_by_email text;

CREATE INDEX IF NOT EXISTS idx_tracker_projects_owner
  ON tracker_projects (owned_by_email)
  WHERE owned_by_email IS NOT NULL;

-- Bootstrap personal projects for the two known admins. Others get
-- auto-created on first Personal-tab load (lazy bootstrap in the UI).
INSERT INTO tracker_projects (id, name, client_name, phase, status, owned_by_email)
VALUES
  (gen_random_uuid(), 'Bees Personal',  'Personal', 'Personal', 'active', 'mietsko@gmail.com'),
  (gen_random_uuid(), 'Jaime Personal', 'Personal', 'Personal', 'active', 'jaime@cascadiaforestry.com')
ON CONFLICT DO NOTHING;
