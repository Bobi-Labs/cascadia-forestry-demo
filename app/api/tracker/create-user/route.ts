import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/tracker/create-user
 * Creates a Supabase Auth user + tracker_users profile.
 * Body: { email, password, display_name, avatar_color? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, display_name, avatar_color } = body;

    if (!email || !password || !display_name) {
      return NextResponse.json(
        { error: "email, password, and display_name are required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Create auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const authUser = authData.user;

    // Create tracker_users profile
    const { data: profile, error: profileError } = await admin
      .from("tracker_users")
      .insert({
        auth_id: authUser.id,
        display_name,
        email,
        avatar_color: avatar_color ?? "#22c55e",
      })
      .select("*")
      .single();

    if (profileError) {
      // Rollback: delete auth user
      await admin.auth.admin.deleteUser(authUser.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ user: profile });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
