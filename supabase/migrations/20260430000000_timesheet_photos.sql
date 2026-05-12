-- Codifies the existing `timesheet_photos` table.
--
-- This table was created ad-hoc (no prior migration file) to back the
-- foreman TG bot's photo-submission flow: when a foreman sends a photo
-- to the foreman channel with a `ts` caption prefix, the bot uploads
-- the photo metadata here for the office to review.
--
-- Three rows exist in production already, so this migration uses
-- IF NOT EXISTS to stay idempotent — applying it on a system that
-- already has the table is a no-op. New environments get the schema
-- from here.

CREATE TABLE IF NOT EXISTS timesheet_photos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id  text NOT NULL,
  telegram_username text,
  photo_file_id     text NOT NULL,
  photo_url         text,
  caption           text,
  status            text DEFAULT 'pending',
  reviewed_by       uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timesheet_photos_status
  ON timesheet_photos (status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_timesheet_photos_user
  ON timesheet_photos (telegram_user_id, created_at DESC);
