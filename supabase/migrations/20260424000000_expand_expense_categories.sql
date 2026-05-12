-- Expand the expense_category enum from 8 to 15 buckets.
--
-- Context: audit on 2026-04-24 revealed the 8-bucket schema was
-- conflating distinct concepts (airlines + hotels, rental cars +
-- vehicle repair, tolls + misc). ENUM expansion + renames give us
-- reporting granularity that matches how the business actually
-- spends money.
--
-- This migration only touches the TYPE definition and the
-- sheet_category_map lookup table. The data remap for existing
-- rows runs separately via scripts/remap-expense-categories.mjs
-- so it stays auditable (transaction + audit-log entries).

-- ============================================================
-- 1. Rename existing enum values where the name was too narrow.
--    These are in-place renames — old references update automatically.
-- ============================================================
ALTER TYPE expense_category RENAME VALUE 'hotel'          TO 'lodging';
ALTER TYPE expense_category RENAME VALUE 'food'           TO 'meals';
ALTER TYPE expense_category RENAME VALUE 'vehicle_repair' TO 'vehicle_maintenance';

-- ============================================================
-- 2. Add the seven new enum values.
--    Postgres 12+ allows ADD VALUE inside a transaction as long as
--    the new values aren't referenced in the same txn — we satisfy
--    that by doing seeds + data remap in a separate script.
-- ============================================================
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'vehicle_rental';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'airfare_transit';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'tolls_parking';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'groceries';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'office_admin';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'professional_services';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'fees_insurance';
