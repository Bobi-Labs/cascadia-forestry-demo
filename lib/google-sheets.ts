/**
 * Google Sheets reader — uses the Drive API's export endpoint to read
 * a Google Sheet. No Sheets API needed; the existing Drive API
 * credentials are sufficient.
 *
 * Exports as XLSX (not CSV) so we get ALL tabs in one request. The
 * parser iterates each tab and checks for the expected expense columns
 * (TransactionDate, Amount, CardMember, etc.) — tabs that don't match
 * (like "Unit Tracking") are silently skipped.
 *
 * This supports Jaime's workflow of adding a new tab each week: the
 * system reads every tab, the dedup layer skips rows it already has,
 * and only genuinely new rows get inserted.
 */

import { google } from "googleapis";

function getCredentials(): { client_email: string; private_key: string } {
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!b64) throw new Error("Missing GOOGLE_CREDENTIALS_BASE64 env var");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

function getDriveClient() {
  const creds = getCredentials();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

/**
 * Fetch a Google Sheet as CSV using the Drive API export endpoint.
 * Returns the raw CSV string for the FIRST tab only.
 *
 * @deprecated Use fetchSheetAsXlsx for multi-tab support
 */
export async function fetchSheetAsCsv(spreadsheetId: string): Promise<string> {
  const drive = getDriveClient();

  const res = await drive.files.export(
    {
      fileId: spreadsheetId,
      mimeType: "text/csv",
    },
    { responseType: "text" },
  );

  const data = res.data;
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return String(data);
}

/**
 * Fetch a Google Sheet as XLSX (binary workbook containing ALL tabs).
 * Returns a Buffer that the xlsx library can parse with XLSX.read().
 *
 * This is the primary export method — it supports Jaime's multi-tab
 * workflow where each week gets its own tab.
 */
export async function fetchSheetAsXlsx(spreadsheetId: string): Promise<Buffer> {
  const drive = getDriveClient();

  const res = await drive.files.export(
    {
      fileId: spreadsheetId,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    { responseType: "arraybuffer" },
  );

  const data = res.data;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  // GaxiosResponse might return other types depending on version
  return Buffer.from(data as ArrayBuffer);
}

/**
 * Get the metadata for a Google Sheet (title, last modified, etc).
 * Used for import history — "we pulled this sheet on X date, it was
 * last modified on Y date."
 */
export async function getSheetMetadata(
  spreadsheetId: string,
): Promise<{ id: string; name: string; modifiedTime: string }> {
  const drive = getDriveClient();

  const res = await drive.files.get({
    fileId: spreadsheetId,
    fields: "id, name, modifiedTime",
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    modifiedTime: res.data.modifiedTime!,
  };
}
