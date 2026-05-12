-- Tracker-specific user profiles (separate from main app users table)
CREATE TABLE tracker_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text NOT NULL,
  avatar_color text DEFAULT '#22c55e',
  telegram_username text,
  telegram_chat_id text,
  created_at timestamptz DEFAULT now()
);

-- Open read, authenticated write
ALTER TABLE tracker_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracker_users_read" ON tracker_users
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "tracker_users_write" ON tracker_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
