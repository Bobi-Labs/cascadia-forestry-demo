import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * GET /api/tracker/avatar
 * Serves the real tree logo PNG for use as TG bot profile picture.
 */
export async function GET() {
  const filePath = join(process.cwd(), "public", "logo-dark.png");
  const buffer = await readFile(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
