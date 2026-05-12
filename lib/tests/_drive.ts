/**
 * Drive helpers for the test suite — service account direct auth with
 * defensive env-var trimming (mirrors scripts/lib/drive.mjs).
 *
 * Trim guards against the trailing-whitespace env corruption that caused
 * the April folder bugs. If a test ever reports "File not found: .", first
 * suspect env var shape (run drive-env-health).
 */
import { google, drive_v3 } from "googleapis";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  return v ? v.trim() : undefined;
}

export function requireEnv(key: string): string {
  const v = trimEnv(key);
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

export function getDriveClient(): drive_v3.Drive {
  const b64 = requireEnv("GOOGLE_CREDENTIALS_BASE64");
  const creds = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

export async function listChildren(drive: drive_v3.Drive, parentId: string) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, parents)",
    pageSize: 500,
  });
  return res.data.files ?? [];
}

export async function findFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string,
): Promise<drive_v3.Schema$File | null> {
  const safe = name.replace(/'/g, "\\'");
  const q = [
    `name = '${safe}'`,
    `mimeType = '${FOLDER_MIME}'`,
    `trashed = false`,
    parentId ? `'${parentId}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const res = await drive.files.list({ q, fields: "files(id, name, parents)", pageSize: 1 });
  return res.data.files?.[0] ?? null;
}

export async function getItem(drive: drive_v3.Drive, id: string) {
  const res = await drive.files.get({ fileId: id, fields: "id, name, mimeType, parents, trashed" });
  return res.data;
}

export async function trash(drive: drive_v3.Drive, id: string) {
  await drive.files.update({ fileId: id, requestBody: { trashed: true } });
}

export async function canRead(drive: drive_v3.Drive, id: string): Promise<boolean> {
  try {
    await drive.files.get({ fileId: id, fields: "id" });
    return true;
  } catch {
    return false;
  }
}
