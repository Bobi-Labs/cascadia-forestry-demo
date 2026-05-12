import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createUserSchema } from "@/lib/schemas/create-user";
import type { Json } from "@/lib/supabase/database.types";

export async function POST(request: Request) {
  try {
    // Verify caller is an admin
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role in public.users
    const { data: callerProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (callerProfile?.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can create users" },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, name, role, company_id, language_pref, permissions } =
      parsed.data;

    // Create auth user (no trigger — we insert public.users manually)
    const admin = createAdminClient();
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      return NextResponse.json(
        { error: `Auth creation failed: ${authError.message}` },
        { status: 500 }
      );
    }

    // Insert public.users row
    const { error: profileError } = await admin.from("users").insert({
      id: authData.user.id,
      email,
      name,
      role,
      company_id,
      language_pref,
      permissions: (permissions ?? {}) as Json,
    });

    if (profileError) {
      // Rollback: delete the auth user we just created
      await admin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Profile creation failed: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: {
        id: authData.user.id,
        email,
        name,
        role,
        company_id,
        language_pref,
      },
    });
  } catch (err) {
    console.error("create-user error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
