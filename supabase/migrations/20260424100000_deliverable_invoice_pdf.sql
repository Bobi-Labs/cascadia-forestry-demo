-- Add invoice PDF link to deliverable_items.
--
-- Invoices live in the existing shared Drive folder (service-account-accessible)
-- at Invoices/<item_key>.pdf. The file ID is stored here and served via the
-- existing /api/tracker/drive/[fileId] proxy which streams as attachment.
--
-- Nullable — items without a uploaded invoice just show the "not yet issued"
-- state. When Jaime drops a PDF in the Invoices folder, we seed the file ID
-- and a Download button appears in the Invoice tab.

ALTER TABLE deliverable_items
  ADD COLUMN IF NOT EXISTS invoice_drive_file_id text;

COMMENT ON COLUMN deliverable_items.invoice_drive_file_id IS
  'Google Drive file ID of the invoice PDF. When set, the Invoice tab renders a Download button that streams via /api/tracker/drive/[fileId]. Populate by uploading to the shared Invoices folder and seeding the file ID.';
