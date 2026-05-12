import { google } from "googleapis";
import { Readable } from "stream";

/**
 * Google Drive service account client for tracker file storage.
 *
 * Two auth modes for security:
 *   - READ client: service account directly (drive scope, shared folder only)
 *   - WRITE client: delegation as info@ (drive.file scope, only app-created files)
 *
 * This means the app can ONLY see the one shared folder and can ONLY
 * create/modify files it uploaded — zero access to other company files.
 *
 * Requires env vars:
 *   GOOGLE_CREDENTIALS_BASE64  — base64-encoded service account JSON
 *   GOOGLE_DRIVE_FOLDER_ID
 */

function getCredentials(): { client_email: string; private_key: string } {
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!b64) throw new Error("Missing GOOGLE_CREDENTIALS_BASE64 env var");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

/** Read-only client: service account with folder shared directly as Editor.
 *  Uses `drive` scope but can only see the one shared folder. */
function getReadClient() {
  const creds = getCredentials();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

/** Write client: delegation as info@ for storage quota.
 *  Uses `drive.file` scope — can ONLY touch files the app created.
 *  Jaime authorized this scope in Google Admin Console. */
function getWriteClient() {
  const creds = getCredentials();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    subject: "info@ramosreforestation.com",
  });
  return google.drive({ version: "v3", auth });
}

export function getFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID env var");
  return id;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  webViewLink: string;
  thumbnailLink?: string;
}

export const FOLDER_MIME = "application/vnd.google-apps.folder";

/** List files/folders in a Drive folder (read client).
 *  Defaults to the root project folder from env. */
export async function listFiles(parentId?: string): Promise<DriveFile[]> {
  const drive = getReadClient();
  const folderId = parentId || getFolderId();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields:
      "files(id, name, mimeType, size, createdTime, webViewLink, thumbnailLink)",
    orderBy: "folder,name", // folders first, then alpha
    pageSize: 100,
  });

  return (res.data.files ?? [])
    .filter((f) => !f.name!.startsWith("."))
    .map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      size: Number(f.size ?? 0),
      createdTime: f.createdTime!,
      webViewLink: f.webViewLink!,
      thumbnailLink: f.thumbnailLink ?? undefined,
    }));
}

/** Upload a file buffer to a folder (write client w/ delegation).
 *  Defaults to the root project folder. */
export async function uploadFile(
  fileName: string,
  mimeType: string,
  body: Buffer,
  parentId?: string,
): Promise<DriveFile> {
  // Block dotfiles (e.g. .DS_Store) from being uploaded
  if (fileName.startsWith(".")) {
    throw new Error(`Dotfiles cannot be uploaded: ${fileName}`);
  }

  const drive = getWriteClient();
  const folderId = parentId || getFolderId();

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(body),
    },
    fields: "id, name, mimeType, size, createdTime, webViewLink, thumbnailLink",
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: Number(res.data.size ?? 0),
    createdTime: res.data.createdTime!,
    webViewLink: res.data.webViewLink!,
    thumbnailLink: res.data.thumbnailLink ?? undefined,
  };
}

/**
 * Google-native Doc types need `files.export` instead of `alt=media`, which
 * only works on binary blobs. Map the native MIME to the export MIME we
 * want to serve on download. PDF is the right default for invoices +
 * anything a client downloads — it's frozen, consistent, and opens
 * everywhere.
 */
const NATIVE_EXPORT_MAP: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
  "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.drawing": { mime: "application/pdf", ext: "pdf" },
};

/**
 * Download a file's content by Drive file ID (read client).
 *
 * Transparently handles Google-native Doc types by exporting them to a
 * download-friendly format (PDF for Docs/Slides/Drawings, XLSX for Sheets).
 * Non-native files stream as-is via alt=media.
 */
export async function downloadFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
  const drive = getReadClient();

  // Get file metadata first
  const meta = await drive.files.get({ fileId, fields: "name, mimeType" });
  const nativeMime = meta.data.mimeType || "";
  const nameRaw = meta.data.name || "download";

  // Google-native types: export to PDF/XLSX
  const exportTarget = NATIVE_EXPORT_MAP[nativeMime];
  if (exportTarget) {
    const res = await drive.files.export(
      { fileId, mimeType: exportTarget.mime },
      { responseType: "arraybuffer" },
    );
    // Strip any existing extension + append ours so the downloaded file
    // opens in the right app. Google Docs names rarely have extensions.
    const nameNoExt = nameRaw.replace(/\.[a-z0-9]{2,5}$/i, "");
    return {
      buffer: Buffer.from(res.data as ArrayBuffer),
      mimeType: exportTarget.mime,
      name: `${nameNoExt}.${exportTarget.ext}`,
    };
  }

  // Regular binary file — stream via alt=media
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );

  return {
    buffer: Buffer.from(res.data as ArrayBuffer),
    mimeType: nativeMime || "application/octet-stream",
    name: nameRaw,
  };
}

/** Delete a file by Drive file ID (write client — can only delete app-created files) */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = getWriteClient();
  await drive.files.delete({ fileId });
}
