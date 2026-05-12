import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/drive/unit-folder
 *
 * Creates a Drive subfolder for a new unit inside the contract's Units/ folder
 * and writes drive_folder_id back to the units table.
 *
 * Body: { unitId: string, unitName: string, contractId: string }
 *
 * Creates:
 *   Everyone/Contracts/{Landowner}/{Contract}/Units/{unit_name}/
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
  let unitId: string;
  let unitName: string;
  let contractId: string;

  try {
    const body = await req.json();
    unitId = body.unitId;
    unitName = body.unitName;
    contractId = body.contractId;
    if (!unitId || !unitName || !contractId) throw new Error("Missing unitId, unitName, or contractId");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    // Look up contract's Drive folder
    const { data: contract, error: contractErr } = await supabase
      .from("contracts")
      .select("drive_folder_everyone_id")
      .eq("id", contractId)
      .single();

    if (contractErr || !contract?.drive_folder_everyone_id) {
      return NextResponse.json({ error: "Contract has no Drive folder yet" }, { status: 422 });
    }

    const drive = getDriveClient();

    // Ensure Units/ subfolder exists under the contract folder
    const unitsFolderId = await ensureFolder(drive, contract.drive_folder_everyone_id, "Units");

    // Create the unit subfolder
    const unitFolderId = await ensureFolder(drive, unitsFolderId, unitName);

    // Write ID back to units table
    const { error: updateErr } = await supabase
      .from("units")
      .update({ drive_folder_id: unitFolderId })
      .eq("id", unitId);

    if (updateErr) throw new Error(updateErr.message);

    return NextResponse.json({ ok: true, unitFolderId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Drive unit-folder error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
