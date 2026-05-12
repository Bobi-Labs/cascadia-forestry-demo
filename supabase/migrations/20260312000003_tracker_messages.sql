-- Chat messages for tracker (mirrored to/from Telegram)
CREATE TABLE tracker_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
  author text NOT NULL,
  author_id uuid REFERENCES tracker_users(id),
  content text NOT NULL,
  source text NOT NULL DEFAULT 'web',  -- 'web' | 'telegram'
  telegram_message_id bigint,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tracker_messages_project ON tracker_messages(project_id, created_at);

-- Open RLS (same pattern as other tracker tables)
ALTER TABLE tracker_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracker_messages_read" ON tracker_messages
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "tracker_messages_write" ON tracker_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon write for TG webhook inserts
CREATE POLICY "tracker_messages_anon_insert" ON tracker_messages
  FOR INSERT TO anon WITH CHECK (true);
