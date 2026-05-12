-- Add landowner and task_order columns to contracts table
-- These columns may already exist from a prior ad-hoc migration; IF NOT EXISTS ensures idempotency.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS landowner text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS task_order text;
