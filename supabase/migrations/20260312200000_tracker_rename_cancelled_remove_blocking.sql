-- Rename "cancelled" status to "future_phase" and migrate "blocking" priority to "high"

-- 1. Rename the enum value for status
ALTER TYPE tracker_item_status RENAME VALUE 'cancelled' TO 'future_phase';

-- 2. Migrate all items with "blocking" priority to "high"
UPDATE tracker_items SET priority = 'high' WHERE priority = 'blocking';
