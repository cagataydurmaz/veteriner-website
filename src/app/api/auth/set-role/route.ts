import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/set-role
 * Called by the /auth/role-select page for new Google OAuth users
 * who have no public.users row yet. Uses the service client to insert
 * the row (RLS has no INSERT policy for regular users).
 *
 * Body: { role: "owner" | "vet" }
 */
export async function POST(request: NextRequest) {
  // 1. Verify the caller is authenticated
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  // 2. Validate role
  const body = await request.json().catch(() => null);
  const role = body?.role as string | undefined;
  if (role !== "owner" && role !== "vet") {
    return NextResponse.json({ error: "Geçersiz rol" }, { status: 400 });
  }

  const serviceSupabase = createServiceClient();

  // 3. Ensure the user doesn't already have a row (prevent role change)
  const { data: existing } = await serviceSupabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (existing?.role) {
    // Row already exists — just return the existing role so the client can redirect
    return NextResponse.json({ role: existing.role, existing: true });
  }

  // 4. Insert new user row
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "";

  const { error: insertError } = await serviceSupabase.from("users").insert({
    id: user.id,
    email: user.email,
    full_name: displayName,
    role,
  });

  if (insertError) {
    console.error("[set-role] insert error:", insertError.message);
    return NextResponse.json({ error: "Hesap oluşturulamadı" }, { status: 500 });
  }

  return NextResponse.json({ role, existing: false });
}
