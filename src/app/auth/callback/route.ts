import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code      = searchParams.get("code");
  const oauthRole = request.cookies.get("oauth_role")?.value;

  // ── Handle Supabase error redirects (expired / used links) ────────────────
  const urlError     = searchParams.get("error");
  const urlErrorCode = searchParams.get("error_code");
  const urlErrorDesc = searchParams.get("error_description") ?? "";

  if (urlError || urlErrorCode) {
    const descLower = urlErrorDesc.toLowerCase();
    const isExpired =
      urlErrorCode === "otp_expired" ||
      descLower.includes("expired") ||
      descLower.includes("token has expired");
    const isUsed =
      descLower.includes("already been used") ||
      descLower.includes("invalid") ||
      urlErrorCode === "access_denied";

    if (searchParams.get("type") === "recovery") {
      const params = new URLSearchParams();
      if (urlErrorCode) params.set("error_code", urlErrorCode);
      if (urlErrorDesc) params.set("error_description", urlErrorDesc);
      return NextResponse.redirect(`${origin}/auth/reset-password?${params.toString()}`);
    }
    const clearCookie = (url: string) => {
      const r = NextResponse.redirect(url);
      r.cookies.delete("oauth_role");
      return r;
    };
    if (isExpired) return clearCookie(`${origin}/auth/login?error=link_expired`);
    if (isUsed)    return clearCookie(`${origin}/auth/login?error=link_used`);
    return clearCookie(`${origin}/auth/login?error=link_invalid`);
  }

  if (!code) return NextResponse.redirect(`${origin}/auth/login`);

  // ── Exchange code for session ──────────────────────────────────────────────
  const supabase = await createClient();
  const type = searchParams.get("type"); // e.g. "recovery"
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const msgLower = (error.message ?? "").toLowerCase();
    if (
      msgLower.includes("expired") ||
      msgLower.includes("invalid") ||
      msgLower.includes("already been used") ||
      msgLower.includes("pkce")
    ) {
      return NextResponse.redirect(`${origin}/auth/login?error=link_expired`);
    }
    return NextResponse.redirect(`${origin}/auth/login?error=link_invalid`);
  }

  if (!data.user) return NextResponse.redirect(`${origin}/auth/login`);

  // ── Password recovery flow: always go to reset page, never to dashboard ────
  // Detection layers (any one is sufficient):
  //   1. type=recovery  — explicit query param from Supabase email link
  //   2. AMR entries    — session-level indicator (may be absent in PKCE flow)
  //   3. provider       — app_metadata provider set to "recovery"
  //   4. recovery_sent_at — most reliable fallback: Supabase always sets this
  //      timestamp when a recovery email is sent. If it's recent (<10 min),
  //      this is almost certainly a password-reset flow, not a normal sign-in.
  const amrEntries = (data.session as { amr?: Array<{ method: string }> } | null)?.amr ?? [];
  const recoverySentAt = data.user.recovery_sent_at
    ? new Date(data.user.recovery_sent_at).getTime()
    : 0;
  const isRecentRecovery =
    recoverySentAt > 0 && Date.now() - recoverySentAt < 10 * 60 * 1000; // 10 min window

  const isRecovery =
    type === "recovery" ||
    amrEntries.some((a) => a.method === "recovery") ||
    data.user.app_metadata?.provider === "recovery" ||
    isRecentRecovery;
  if (isRecovery) {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  const serviceSupabase = createServiceClient();

  // ── Look up role in public.users ───────────────────────────────────────────
  // Primary: match by auth UUID
  let { data: userData } = await serviceSupabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  // Fallback: Google OAuth sometimes creates a new UUID for an existing account.
  // Try matching by email and re-point the row to the new UUID for future logins.
  if (!userData && data.user.email) {
    const { data: byEmail } = await serviceSupabase
      .from("users")
      .select("role, id")
      .ilike("email", data.user.email)   // case-insensitive
      .maybeSingle();

    if (byEmail) {
      // Re-point the row's id to the new Google auth UUID
      await serviceSupabase
        .from("users")
        .update({ id: data.user.id })
        .eq("id", byEmail.id);
      userData = { role: byEmail.role };
    }
  }

  // ── Existing user: redirect straight to their dashboard ───────────────────
  if (userData) {
    const role = userData.role;

    if (role === "admin") {
      const res = NextResponse.redirect(`${origin}/admin/dashboard`);
      res.cookies.delete("oauth_role");
      return res;
    }

    if (role === "vet") {
      const { data: vetData } = await serviceSupabase
        .from("veterinarians")
        .select("is_verified")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const dest = vetData?.is_verified === false
        ? `${origin}/vet/pending-approval`
        : `${origin}/vet/dashboard`;
      const res = NextResponse.redirect(dest);
      res.cookies.delete("oauth_role");
      return res;
    }

    if (role === "owner") {
      const res = NextResponse.redirect(`${origin}/owner/dashboard`);
      res.cookies.delete("oauth_role");
      return res;
    }

    // Unknown role
    const res = NextResponse.redirect(`${origin}/auth/role-select`);
    res.cookies.delete("oauth_role");
    return res;
  }

  // ── New user: no public.users row yet ─────────────────────────────────────
  const metaRole    = data.user.user_metadata?.role as string | undefined;
  const metaName    = data.user.user_metadata?.full_name as string | undefined;
  const displayName = metaName || data.user.email?.split("@")[0] || "";

  // Vet registration via Google (oauth_role cookie set on login page vet tab)
  if (oauthRole === "vet") {
    await serviceSupabase.from("users").upsert(
      { id: data.user.id, email: data.user.email, full_name: displayName, role: "vet" },
      { onConflict: "id" }
    );
    const response = NextResponse.redirect(`${origin}/auth/vet-register?google=true`);
    response.cookies.delete("oauth_role");
    return response;
  }

  // Vet via email/password whose public.users row failed to create
  if (metaRole === "vet") {
    await serviceSupabase.from("users").upsert(
      { id: data.user.id, email: data.user.email, full_name: displayName, role: "vet" },
      { onConflict: "id" }
    );
    return NextResponse.redirect(`${origin}/vet/dashboard`);
  }

  // Completely new user — ask them to pick a role
  return NextResponse.redirect(`${origin}/auth/role-select`);
}
