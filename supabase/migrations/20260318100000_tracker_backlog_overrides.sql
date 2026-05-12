-- Backlog override storage for the Deliverables panel
-- Replaces localStorage with persistent DB storage for priority/phase edits

CREATE TABLE tracker_backlog_overrides (
  item_id    text PRIMARY KEY,                    -- matches the hardcoded backlog item id (e.g. 'payroll-engine')
  priority   smallint CHECK (priority BETWEEN 1 AND 5),
  phase      text,                                -- e.g. 'Phase 2', 'Phase 3', 'Phase 4', 'Future'
  size       smallint CHECK (size IN (1,2,3,5,8,13)),
  updated_at timestamptz DEFAULT now(),
  updated_by text                                 -- email of who made the change
);

-- Allow authenticated users to read
CREATE POLICY "backlog_overrides_select" ON tracker_backlog_overrides
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert/update (app-level check for admin/editor)
CREATE POLICY "backlog_overrides_insert" ON tracker_backlog_overrides
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "backlog_overrides_update" ON tracker_backlog_overrides
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Dev anon read for current dev mode
CREATE POLICY "backlog_overrides_dev_anon_read" ON tracker_backlog_overrides
  FOR SELECT TO anon USING (true);

CREATE POLICY "backlog_overrides_dev_anon_write" ON tracker_backlog_overrides
  FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tracker_backlog_overrides ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at
CREATE TRIGGER set_backlog_overrides_updated_at
  BEFORE UPDATE ON tracker_backlog_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
