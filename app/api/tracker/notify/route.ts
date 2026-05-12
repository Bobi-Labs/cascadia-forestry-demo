import { NextResponse } from "next/server";
import { notifyIfConfigured } from "@/lib/tracker/telegram";
import { notifyMentionedUsers } from "@/lib/tracker/mentions";

/**
 * POST /api/tracker/notify
 *
 * Called by the client after successful item mutations.
 * Fire-and-forget — client doesn't need to wait for the response.
 *
 * Body: { projectId, event, item, note? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, event, item, note } = body;

    if (!projectId || !event || !item) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, event, item" },
        { status: 400 },
      );
    }

    await notifyIfConfigured(projectId, event, item, note);

    // Also handle @mentions in note content
    if (note?.content && note.content.includes("@")) {
      await notifyMentionedUsers(projectId, note.author ?? "Someone", note.content, "note").catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Tracker notify error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
