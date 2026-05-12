import { NextRequest, NextResponse } from "next/server";
import { listFiles, uploadFile } from "@/lib/google-drive";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET  /api/tracker/drive — List files from shared Google Drive folder
 * POST /api/tracker/drive — Upload file to Drive + save metadata to Supabase
 */

export async function GET(req: NextRequest) {
  try {
    const folderId = req.nextUrl.searchParams.get("folderId") || undefined;
    const files = await listFiles(folderId);
    return NextResponse.json({ files });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Drive list error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const uploadedBy = formData.get("uploadedBy") as string | null;
    const uploadedById = formData.get("uploadedById") as string | null;
    const itemId = formData.get("itemId") as string | null;
    const note = formData.get("note") as string | null;
    const folderId = formData.get("folderId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "file and projectId are required" },
        { status: 400 },
      );
    }

    // Block dotfiles (e.g. .DS_Store)
    if (file.name.startsWith(".")) {
      return NextResponse.json(
        { error: `Dotfiles like "${file.name}" cannot be uploaded` },
        { status: 400 },
      );
    }

    // Upload to Google Drive
    const buffer = Buffer.from(await file.arrayBuffer());
    const driveFile = await uploadFile(file.name, file.type, buffer, folderId || undefined);

    // Save metadata in Supabase (lightweight index)
    const admin = createAdminClient();
    const { error: metaError } = await admin.from("tracker_files").insert({
      project_id: projectId,
      item_id: itemId || null,
      file_name: driveFile.name,
      file_path: driveFile.id, // Store Drive file ID instead of storage path
      file_size: driveFile.size,
      mime_type: driveFile.mimeType,
      uploaded_by: uploadedBy || "Unknown",
      uploaded_by_id: uploadedById || null,
      note: note || null,
    });

    if (metaError) {
      console.error("Supabase metadata error:", metaError.message);
    }

    return NextResponse.json({
      file: {
        ...driveFile,
        dbId: null, // Will be populated on refetch
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Drive upload error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}
