-- Add drive_folder_id to units table
-- Stores the Google Drive folder ID for unit-level documents (maps, specs, photos)
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT DEFAULT NULL;
