import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/google-drive";

/**
 * POST /api/drive/upload
 *
 * Uploads a file to a Drive folder. Validates input loudly so the UI can
 * surface the real reason on failure — silent upload failure is how the
 * April 18 "Chrome-saved PDF" incident slipped past the office.
 *
 * Auth enforced by middleware.
 *
 * FormData fields:
 *   file        — the File blob
 *   folderId    — target Drive folder ID
 */

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/** First bytes of a well-formed PDF. Chrome "save as PDF" sometimes produces
 *  files that are webpage archives with .pdf extension — Drive accepts them
 *  but they render as garbage or fail downstream. We reject here, loudly. */
function looksLikePdf(head: Buffer): boolean {
  return head.length >= 5 && head.slice(0, 5).toString("ascii") === "%PDF-";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;

    if (!file || !folderId) {
      return NextResponse.json({ error: "file and folderId are required" }, { status: 400 });
    }

    if (file.name.startsWith(".")) {
      return NextResponse.json({ error: "Dotfiles (names starting with '.') cannot be uploaded." }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "File is empty — 0 bytes. Check that the file saved correctly before uploading." },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `File is ${mb} MB — over the 50 MB upload limit. Compress or split the file and try again.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // PDF magic-byte check. Catches Chrome-saved "pseudo-PDFs" and other
    // mis-labeled content before it lands in Drive.
    const claimedPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (claimedPdf && !looksLikePdf(buffer.slice(0, 8))) {
      return NextResponse.json(
        {
          error:
            "This file is labeled as PDF but isn't a real PDF — likely a webpage saved via Chrome's 'Save as PDF'. Open the original in Adobe/Preview and re-export as a true PDF, then try again.",
        },
        { status: 400 },
      );
    }

    const driveFile = await uploadFile(
      file.name,
      file.type || "application/octet-stream",
      buffer,
      folderId,
    );

    return NextResponse.json({ file: driveFile });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Drive upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
