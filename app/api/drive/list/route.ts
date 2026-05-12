import { NextRequest, NextResponse } from "next/server";
import { listFiles } from "@/lib/google-drive";

/**
 * GET /api/drive/list?folderId=...
 *
 * Lists files and folders inside a given Drive folder.
 * Auth is enforced by middleware — only authenticated users reach this.
 * The caller is responsible for passing a folder ID they have access to
 * (validated by the fact that the service account owns the folder tree).
 */
export async function GET(req: NextRequest) {
  const folderId = req.nextUrl.searchParams.get("folderId");

  if (!folderId) {
    return NextResponse.json({ error: "folderId is required" }, { status: 400 });
  }

  try {
    const files = await listFiles(folderId);
    return NextResponse.json({ files });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Drive list error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
