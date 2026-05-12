-- Work Tracker tables
-- Replaces Google Sheets project tracker with a live web app at /tracker

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE tracker_category AS ENUM (
  'data_needed', 'question', 'decision', 'task', 'bug', 'feature'
);

CREATE TYPE tracker_priority AS ENUM (
  'blocking', 'high', 'medium', 'low'
);

CREATE TYPE tracker_item_status AS ENUM (
  'pending', 'in_progress', 'done', 'blocked', 'cancelled'
);

CREATE TYPE tracker_project_status AS ENUM (
  'active', 'paused', 'completed'
);

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE tracker_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  client_name text,
  phase       text,
  budget      numeric(10,2),
  hours_total numeric(6,1),
  hours_used  numeric(6,1) DEFAULT 0,
  status      tracker_project_status DEFAULT 'active',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE tracker_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
  category     tracker_category NOT NULL,
  title        text NOT NULL,
  description  text,
  priority     tracker_priority DEFAULT 'medium',
  status       tracker_item_status DEFAULT 'pending',
  assigned_to  text,
  due_date     date,
  completed_at timestamptz,
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE tracker_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES tracker_items(id) ON DELETE CASCADE,
  author     text NOT NULL,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE tracker_telegram_config (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE UNIQUE,
  chat_id    text,
  bot_token  text,
  notify_on  text[] DEFAULT '{status_change,new_item}',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_tracker_items_project_status ON tracker_items(project_id, status);
CREATE INDEX idx_tracker_notes_item ON tracker_notes(item_id);

-- ============================================================
-- TRIGGERS — updated_at auto-update
-- ============================================================

-- Reuse the existing handle_updated_at function if it exists, otherwise create it
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_tracker_projects_updated_at
  BEFORE UPDATE ON tracker_projects
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_tracker_items_updated_at
  BEFORE UPDATE ON tracker_items
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- RLS — open access (no auth on tracker)
-- TODO: lock down when auth is added to tracker
-- ============================================================

ALTER TABLE tracker_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracker_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracker_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracker_telegram_config ENABLE ROW LEVEL SECURITY;

-- tracker_projects
CREATE POLICY "tracker_projects_anon_all" ON tracker_projects
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "tracker_projects_auth_all" ON tracker_projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tracker_items
CREATE POLICY "tracker_items_anon_all" ON tracker_items
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "tracker_items_auth_all" ON tracker_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tracker_notes
CREATE POLICY "tracker_notes_anon_all" ON tracker_notes
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "tracker_notes_auth_all" ON tracker_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tracker_telegram_config
CREATE POLICY "tracker_telegram_config_anon_all" ON tracker_telegram_config
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "tracker_telegram_config_auth_all" ON tracker_telegram_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
