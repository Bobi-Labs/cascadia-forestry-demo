-- Reserved tracker_projects rows for the 4 ops channels.
--
-- The 3 ops chats (admin_office, foreman, updates) + 1 watercooler don't
-- have natural tracker_projects rows — they're company-wide TG channels,
-- not project-scoped. To surface their messages on the new Communications
-- page using the existing tracker_messages plumbing, each gets a reserved
-- project row with a stable UUID and scope='ops'.
--
-- The BoardSwitcher in the Work Tracker page filters by scope IN
-- ('company', 'site_build', 'personal'), so 'ops' rows are invisible
-- there — they only surface in the new Communications page.
--
-- Why not chat_source column + nullable project_id? Reuses the existing
-- tracker_messages send + receive paths verbatim. Single query path to
-- maintain. Reserved UUIDs are predictable (3000…0001 through 0004) so
-- code can refer to them as constants.
--
-- Reserved IDs:
--   30000000-0000-0000-0000-000000000001  admin_office
--   30000000-0000-0000-0000-000000000002  foreman
--   30000000-0000-0000-0000-000000000003  updates
--   30000000-0000-0000-0000-000000000004  watercooler

-- Extend the scope check constraint to allow 'ops'.
ALTER TABLE tracker_projects
  DROP CONSTRAINT IF EXISTS tracker_projects_scope_check;
ALTER TABLE tracker_projects
  ADD CONSTRAINT tracker_projects_scope_check
  CHECK (scope IS NULL OR scope IN ('company', 'site_build', 'personal', 'ops'));

-- Seed the 4 ops projects. ON CONFLICT DO NOTHING keeps re-runs safe.
INSERT INTO tracker_projects (id, name, client_name, phase, status, scope)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'Admin / Office Chat',  'Operations', 'Operations', 'active', 'ops'),
  ('30000000-0000-0000-0000-000000000002', 'Foreman Chat',         'Operations', 'Operations', 'active', 'ops'),
  ('30000000-0000-0000-0000-000000000003', 'Updates & Alerts',     'Operations', 'Operations', 'active', 'ops'),
  ('30000000-0000-0000-0000-000000000004', 'Watercooler',          'Operations', 'Operations', 'active', 'ops')
ON CONFLICT (id) DO NOTHING;

-- The Communications page reads these via tracker_messages. Inserts come
-- from the ops bot webhook (TG inbound) and the new Communications send
-- API (dashboard outbound). RLS on tracker_messages is already permissive
-- for authenticated + anon, so no policy changes needed.
