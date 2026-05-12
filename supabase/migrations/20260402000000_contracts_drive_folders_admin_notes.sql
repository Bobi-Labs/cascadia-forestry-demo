-- Phase 2 Item 1: Google Drive file system
-- Adds Drive folder IDs for each contract + admin_notes split

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS drive_folder_everyone_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS drive_folder_admin_id    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_notes              TEXT DEFAULT NULL;

COMMENT ON COLUMN contracts.drive_folder_everyone_id IS 'Google Drive folder ID for this contract inside Operations_Everyone/Contracts/';
COMMENT ON COLUMN contracts.drive_folder_admin_id    IS 'Google Drive folder ID for this contract inside Operations_Admin/Contracts/';
COMMENT ON COLUMN contracts.admin_notes              IS 'Admin/Office only notes — never visible to foremen. Existing notes column remains as contract_notes visible to all.';
