-- Item 8 — track the file's actual parent folder + relative path on each
-- batch row so the Pending Units page can link the office directly to
-- the folder a file lives in (e.g. "<Contract>/Maps & Specs/") instead
-- of only the contract root.
--
-- Both columns are nullable. Backfilling existing rows isn't worth the
-- complexity — the next ingest re-scan populates them, and rows that
-- predate this migration just won't show the file-folder link in the UI
-- (graceful fallback to project-folder-only).
--
-- Driven by the May 8 walkthrough: "the folder it's showing is the
-- parent, not the actual holder of the PDF — would be good to have both."

ALTER TABLE unit_ingest_batches
  ADD COLUMN IF NOT EXISTS drive_parent_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_relative_path TEXT;

COMMENT ON COLUMN unit_ingest_batches.drive_parent_folder_id IS
  'Drive folder ID of the file''s immediate parent. Lets the UI link to the actual containing folder, not just the contract root.';
COMMENT ON COLUMN unit_ingest_batches.drive_relative_path IS
  'Slash-separated path inside the contract folder, e.g. "Maps & Specs/2026 Plan.pdf". Display-only; for office context.';
