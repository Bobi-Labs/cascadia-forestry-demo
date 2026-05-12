-- ─────────────────────────────────────────────────────────────────────────
-- Storage lockdown: unit-documents + tracker-files → private
-- ─────────────────────────────────────────────────────────────────────────
--
-- Both buckets were flagged public on creation. Audit found:
--   - unit-documents has 3 contract-document objects, fetched in
--     unit-form-sheet.tsx via getPublicUrl (a permanent public URL).
--     Sensitive enough that they shouldn't be world-readable.
--   - tracker-files has 1 stale object, no code reads from it
--     (the tracker file panel uses /api/tracker/drive instead, hitting
--     Google Drive, not Supabase Storage). Public flag is just risk
--     surface with no upside.
--
-- This migration:
--   1. Flips the public flag on both buckets to false.
--   2. Tightens the read policies on storage.objects so only
--      authenticated users (logged into the app) can generate signed
--      URLs. Previous policies were unscoped — anon could read too,
--      which made the bucket-public flag the only line of defense.
--   3. Tightens the delete policy on unit-documents the same way.
--      tracker-files delete was already auth-only, no change.
--
-- Application-side counterpart (already shipped): unit-form-sheet.tsx
-- now calls createSignedUrl(path, 60*60) instead of getPublicUrl. The
-- signed URL is short-lived and proves the user was authenticated at
-- the moment of generation.
--
-- Buckets intentionally LEFT public:
--   profile-photos    used as <img src=publicUrl> in topbar/sidebar/
--                     role views. Photos of employees are app-wide
--                     visible by design.
--   tracker-banners   used as background-image on tracker dashboard.
--                     Public is intentional.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Flip public flag
update storage.buckets
set public = false
where id in ('unit-documents', 'tracker-files');

-- 2. unit-documents: scope read + delete to authenticated only
drop policy if exists "Anyone can read unit documents" on storage.objects;
create policy "Authenticated read unit documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'unit-documents');

drop policy if exists "Anyone can delete unit documents" on storage.objects;
create policy "Authenticated delete unit documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'unit-documents');

-- 3. tracker-files: tighten read to authenticated; delete already
--    scoped to authenticated (tracker_files_auth_delete unchanged).
drop policy if exists "tracker_files_public_read" on storage.objects;
create policy "tracker_files_auth_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'tracker-files');
