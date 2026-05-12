import { NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * POST /api/drive/setup
 *
 * One-time idempotent endpoint that creates the full Operations folder structure
 * inside both root folders. Safe to re-run — checks for existing folders before
 * creating so nothing gets duplicated.
 *
 * Everyone root  → Contracts/, Company — Cascadia/, Company — Ramos/,
 *                  Crew/, Safety/, Templates/
 * Admin root     → Contracts/, Financial/, Equipment/, Expenses/, Invoicing/
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";

function getDriveClient() {
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!b64) throw new Error("Missing GOOGLE_CREDENTIALS_BASE64");
  const creds = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

/** Get or create a folder by name inside a parent. Returns the folder ID. */
async function ensureFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string
): Promise<string> {
  // Check if it already exists
  const existing = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
  });

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!;
  }

  // Create it
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id",
  });

  return created.data.id!;
}

export async function POST() {
  const everyoneRootId = process.env.GOOGLE_DRIVE_EVERYONE_FOLDER_ID;
  const adminRootId = process.env.GOOGLE_DRIVE_ADMIN_FOLDER_ID;

  if (!everyoneRootId || !adminRootId) {
    return NextResponse.json(
      { error: "Missing GOOGLE_DRIVE_EVERYONE_FOLDER_ID or GOOGLE_DRIVE_ADMIN_FOLDER_ID" },
      { status: 500 }
    );
  }

  const drive = getDriveClient();
  const created: string[] = [];
  const existing: string[] = [];

  async function ensure(parentId: string, name: string): Promise<string> {
    // Check existing before create so we can report accurately
    const res = await drive.files.list({
      q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "files(id, name)",
      pageSize: 1,
    });
    if (res.data.files && res.data.files.length > 0) {
      existing.push(name);
      return res.data.files[0].id!;
    }
    const newFolder = await drive.files.create({
      requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
      fields: "id",
    });
    created.push(name);
    return newFolder.data.id!;
  }

  try {
    // ── Operations_Everyone structure ────────────────────────────────────────
    const everyoneContractsId = await ensure(everyoneRootId, "Contracts");
    await ensure(everyoneRootId, "Company — Cascadia");
    await ensure(everyoneRootId, "Company — Ramos");
    await ensure(everyoneRootId, "Crew");
    await ensure(everyoneRootId, "Safety");
    await ensure(everyoneRootId, "Templates");

    // ── Operations_Admin structure ────────────────────────────────────────────
    const adminContractsId = await ensure(adminRootId, "Contracts");
    await ensure(adminRootId, "Financial");
    await ensure(adminRootId, "Equipment");
    await ensure(adminRootId, "Expenses");
    await ensure(adminRootId, "Invoicing");

    return NextResponse.json({
      ok: true,
      created,
      existing,
      roots: {
        everyoneContractsId,
        adminContractsId,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Drive setup error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
