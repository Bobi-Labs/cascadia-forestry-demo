-- Item 8 — record the owning contract on each ingest batch.
--
-- Stage 1 schema (20260427000000_unit_ingest_schema.sql) only stored
-- drive_file_id on a batch. To resolve which contract a parsed unit
-- belongs to, the orchestrator would have to walk Drive parents at
-- parse time. The watcher (Stage 2) already knows the contract — it's
-- the one whose drive_folder_everyone_id contains the file — so it
-- should just record it on the batch row.
--
-- Pure additive: nullable column + index. ON DELETE SET NULL keeps
-- batch history intact if a contract is deleted later.

ALTER TABLE unit_ingest_batches
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_unit_ingest_batches_contract
  ON unit_ingest_batches (contract_id, created_at DESC)
  WHERE contract_id IS NOT NULL;
