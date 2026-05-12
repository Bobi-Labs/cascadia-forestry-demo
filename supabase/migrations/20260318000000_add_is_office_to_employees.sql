-- Add is_office boolean flag to employees table
-- This allows marking employees who work in an office role
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_office boolean NOT NULL DEFAULT false;
