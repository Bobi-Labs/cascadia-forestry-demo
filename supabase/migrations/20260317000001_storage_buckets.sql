-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('unit-documents', 'unit-documents', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to profile-photos
CREATE POLICY "Anyone can upload profile photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos');
CREATE POLICY "Anyone can update profile photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-photos');
CREATE POLICY "Anyone can read profile photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'profile-photos');

-- Allow authenticated users to manage unit documents
CREATE POLICY "Anyone can upload unit documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'unit-documents');
CREATE POLICY "Anyone can read unit documents" ON storage.objects FOR SELECT TO public USING (bucket_id = 'unit-documents');
CREATE POLICY "Anyone can delete unit documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'unit-documents');
