-- Storage bucket for tracker file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('tracker-files', 'tracker-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can read, authenticated can upload/delete
CREATE POLICY "tracker_files_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'tracker-files');

CREATE POLICY "tracker_files_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tracker-files');

CREATE POLICY "tracker_files_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tracker-files');

-- File metadata table
CREATE TABLE tracker_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
  item_id uuid REFERENCES tracker_items(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by text NOT NULL,
  uploaded_by_id uuid REFERENCES tracker_users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tracker_files_project ON tracker_files(project_id);
CREATE INDEX idx_tracker_files_item ON tracker_files(item_id);

-- Open RLS
ALTER TABLE tracker_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracker_files_read" ON tracker_files
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "tracker_files_write" ON tracker_files
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
