-- Item 8 — Unit Data Ingest: schema bones
-- Stage 1 of the ingest pipeline. Pure additive: 5 new tables, 5 new
-- canonical columns on units, 3 enums. No data backfill, no UI surface.
--
-- See scripts/seed-deliverables.mjs item-08-unit-ingest for full design notes.

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE unit_ingest_exclude_scope AS ENUM (
  'landowner', 'contract', 'unit'
);

CREATE TYPE unit_ingest_batch_status AS ENUM (
  'pending', 'processing', 'success', 'partial', 'failed', 'rolled_back'
);

CREATE TYPE unit_pending_review_status AS ENUM (
  'pending', 'approved', 'rejected', 'resolved'
);

-- ============================================================
-- COLUMN MAPS (per-landowner × format → canonical mapping)
-- ============================================================
-- Created first so unit_ingest_batches can FK to it.

CREATE TABLE unit_column_maps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landowner     text NOT NULL,
  format_tag    text NOT NULL,    -- e.g. 'usace-attachment-1', 'manulife-pct', 'weyerhaeuser-plantationexam'
  parser_mode   text NOT NULL CHECK (parser_mode IN ('A', 'B')),
  version       int  NOT NULL DEFAULT 1,
  is_active     boolean NOT NULL DEFAULT true,
  -- mapping shape: { source_col: { canonical_field, transform?, notes? } }
  mapping       jsonb NOT NULL,
  ai_suggested  boolean NOT NULL DEFAULT false,
  approved_by   text,
  approved_at   timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (landowner, format_tag, version)
);

CREATE INDEX idx_unit_column_maps_active
  ON unit_column_maps (landowner, format_tag) WHERE is_active = true;

-- ============================================================
-- INGEST BATCHES (one row per Drive-folder scan / file processed)
-- ============================================================

CREATE TABLE unit_ingest_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id   text NOT NULL,
  drive_file_name text,
  landowner       text,
  format_tag      text,
  parser_mode     text CHECK (parser_mode IN ('A', 'B', 'unknown')),
  column_map_id   uuid REFERENCES unit_column_maps(id) ON DELETE SET NULL,
  status          unit_ingest_batch_status NOT NULL DEFAULT 'pending',
  rows_processed  int DEFAULT 0,
  rows_created    int DEFAULT 0,
  rows_updated    int DEFAULT 0,
  rows_skipped    int DEFAULT 0,
  rows_flagged    int DEFAULT 0,
  error_log       jsonb,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_unit_ingest_batches_status
  ON unit_ingest_batches (status, created_at DESC);
CREATE INDEX idx_unit_ingest_batches_landowner
  ON unit_ingest_batches (landowner, created_at DESC);

-- ============================================================
-- PENDING REVIEW QUEUE (mirrors expense_assignments pattern)
-- ============================================================

CREATE TABLE unit_pending_review (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         uuid NOT NULL REFERENCES unit_ingest_batches(id) ON DELETE CASCADE,
  reason           text NOT NULL, -- 'unmapped_columns' | 'unknown_landowner' | 'unit_changed' | 'conflict'
  source_row       jsonb,         -- raw row as extracted from source file
  proposed_unit    jsonb,         -- canonical row we'd insert/update
  existing_unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  status           unit_pending_review_status NOT NULL DEFAULT 'pending',
  reviewed_by      text,
  reviewed_at      timestamptz,
  resolution       text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_unit_pending_review_status
  ON unit_pending_review (status, created_at DESC);
CREATE INDEX idx_unit_pending_review_batch
  ON unit_pending_review (batch_id);

-- ============================================================
-- EXCLUSION CONFIG (3 levels: landowner / contract / unit)
-- ============================================================

CREATE TABLE unit_ingest_excludes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type   unit_ingest_exclude_scope NOT NULL,
  -- scope_id stored as text so a single column covers landowner-name (text),
  -- contract.id (uuid), and unit.id (uuid). Cast at query time.
  scope_id     text NOT NULL,
  reason       text,
  created_by   text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (scope_type, scope_id)
);

CREATE INDEX idx_unit_ingest_excludes_scope
  ON unit_ingest_excludes (scope_type, scope_id);

-- ============================================================
-- AUDIT TRAIL (per-row, snapshot-on-change)
-- ============================================================

CREATE TABLE unit_ingest_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid NOT NULL REFERENCES unit_ingest_batches(id) ON DELETE CASCADE,
  unit_id         uuid REFERENCES units(id) ON DELETE SET NULL,
  action          text NOT NULL, -- 'created' | 'updated' | 'skipped' | 'flagged' | 'excluded' | 'reverted'
  source_file     text,
  column_map_id   uuid REFERENCES unit_column_maps(id) ON DELETE SET NULL,
  -- field_changes shape: { field_name: { before, after } }
  field_changes   jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_unit_ingest_audit_batch
  ON unit_ingest_audit (batch_id, created_at);
CREATE INDEX idx_unit_ingest_audit_unit
  ON unit_ingest_audit (unit_id, created_at DESC);

-- ============================================================
-- NEW CANONICAL COLUMNS ON units
-- ============================================================
-- Existing columns we already use (latitude, longitude, township_range,
-- species, stock_type, elevation_min/avg/max) are NOT duplicated.

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS stand_key         text,
  ADD COLUMN IF NOT EXISTS mu_code           text,
  ADD COLUMN IF NOT EXISTS site_index        int,
  ADD COLUMN IF NOT EXISTS prev_harvest_date date,
  ADD COLUMN IF NOT EXISTS best_use          text;

CREATE INDEX IF NOT EXISTS idx_units_stand_key ON units (stand_key) WHERE stand_key IS NOT NULL;

-- ============================================================
-- updated_at TRIGGERS
-- ============================================================

CREATE TRIGGER set_unit_column_maps_updated_at
  BEFORE UPDATE ON unit_column_maps
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_unit_ingest_batches_updated_at
  BEFORE UPDATE ON unit_ingest_batches
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_unit_pending_review_updated_at
  BEFORE UPDATE ON unit_pending_review
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- RLS — dev_anon for now, lock down with auth pass
-- ============================================================

ALTER TABLE unit_column_maps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_ingest_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_pending_review   ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_ingest_excludes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_ingest_audit     ENABLE ROW LEVEL SECURITY;

CREATE POLICY dev_anon_all ON unit_column_maps     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY dev_anon_all ON unit_ingest_batches  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY dev_anon_all ON unit_pending_review  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY dev_anon_all ON unit_ingest_excludes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY dev_anon_all ON unit_ingest_audit    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY auth_all ON unit_column_maps     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON unit_ingest_batches  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON unit_pending_review  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON unit_ingest_excludes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON unit_ingest_audit    FOR ALL TO authenticated USING (true) WITH CHECK (true);
