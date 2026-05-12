import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/drive/contract-folders
 *
 * Creates Drive subfolders for a newly created contract and writes
 * the folder IDs back to the contracts table.
 *
 * Body: { contractId: string, contractName: string, landowner?: string }
 *
 * Creates:
 *   Everyone/Contracts/{Landowner}/{name}/                     → drive_folder_everyone_id
 *   Everyone/Contracts/{Landowner}/{name}/Units/
 *   Admin/Contracts/{Landowner}/{name}/                        → drive_folder_admin_id
 *   Admin/Contracts/{Landowner}/{name}/Pricing & Originals/
 *
 * Maps & Specs is NO LONGER auto-created on contract create. Per the
 * 2026-05-08 call: most contracts have a single contract PDF that
 * lives at the project root (no Maps & Specs subfolder needed); empty
 * subfolders create UI friction when navigating. Office creates Maps &
 * Specs by hand only when a contract actually has multiple maps to
 * organize. The unit-ingest scanner walks the project root recursively
 * regardless, so files dropped at root or inside a Maps & Specs folder
 * created later both still get picked up.
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

async function ensureFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string
): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${safeName}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id!;
  const created = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id",
  });
  return created.data.id!;
}

export async function POST(req: NextRequest) {
  // Navigate from the root folders dynamically — avoids stale/wrong
  // CONTRACTS subfolder env vars causing new project folders to land in
  // the wrong location.
  // .trim() defends against trailing whitespace/newlines from env-pull quirks —
  // this bit us twice (April 7 on _CONTRACTS_ID, April 16 on _FOLDER_ID) before
  // being baked in here.
  const everyoneRootId = process.env.GOOGLE_DRIVE_EVERYONE_FOLDER_ID?.trim();
  const adminRootId = process.env.GOOGLE_DRIVE_ADMIN_FOLDER_ID?.trim();

  if (!everyoneRootId || !adminRootId) {
    return NextResponse.json({ error: "Missing GOOGLE_DRIVE_EVERYONE_FOLDER_ID or GOOGLE_DRIVE_ADMIN_FOLDER_ID" }, { status: 500 });
  }

  let contractId: string;
  let contractName: string;
  let landowner: string;

  try {
    const body = await req.json();
    contractId = body.contractId;
    contractName = body.contractName;
    landowner = body.landowner?.trim() || "Other";
    if (!contractId || !contractName) throw new Error("Missing contractId or contractName");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const drive = getDriveClient();

    // Everyone tree — root/Contracts/{Landowner}/{name}/
    const everyoneContractsId = await ensureFolder(drive, everyoneRootId, "Contracts");
    const everyoneLandownerFolderId = await ensureFolder(drive, everyoneContractsId, landowner);
    const everyoneFolderId = await ensureFolder(drive, everyoneLandownerFolderId, contractName);
    // Units stays — office uses it as the per-unit notes/photos
    // container and the unit-ingest scanner specifically walks it.
    // Maps & Specs is NOT created here; office adds one only when
    // they actually have multi-file map content to organize.
    await ensureFolder(drive, everyoneFolderId, "Units");

    // Admin tree — root/Contracts/{Landowner}/{name}/
    const adminContractsId = await ensureFolder(drive, adminRootId, "Contracts");
    const adminLandownerFolderId = await ensureFolder(drive, adminContractsId, landowner);
    const adminFolderId = await ensureFolder(drive, adminLandownerFolderId, contractName);
    await ensureFolder(drive, adminFolderId, "Pricing & Originals");

    // Write IDs back to DB
    const supabase = createAdminClient();
    const { error: updateError } = await supabase
      .from("contracts")
      .update({
        drive_folder_everyone_id: everyoneFolderId,
        drive_folder_admin_id: adminFolderId,
      })
      .eq("id", contractId);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      ok: true,
      everyoneFolderId,
      adminFolderId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Drive contract-folders error:", msg);
    // Non-fatal — contract already created, folders can be backfilled later
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
