import { NextRequest, NextResponse } from "next/server";
import { deleteFile, downloadFile } from "@/lib/google-drive";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET    /api/tracker/drive/[fileId] — Download file from Drive
 * DELETE /api/tracker/drive/[fileId] — Delete file from Drive + Supabase metadata
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const { buffer, mimeType, name } = await downloadFile(fileId);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Drive download error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;

    // Delete from Google Drive
    try {
      await deleteFile(fileId);
    } catch (driveErr: unknown) {
      // File may already be gone from Drive — continue to clean metadata
      console.warn("Drive delete warning:", driveErr);
    }

    // Delete metadata from Supabase (file_path stores the Drive file ID)
    const admin = createAdminClient();
    await admin.from("tracker_files").delete().eq("file_path", fileId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Drive delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 },
    );
  }
}
