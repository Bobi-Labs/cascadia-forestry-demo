-- Add note column to tracker_files for file descriptions/annotations
ALTER TABLE tracker_files ADD COLUMN IF NOT EXISTS note text;
