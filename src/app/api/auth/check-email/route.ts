import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/check-email
 *
 * Accepts { email } OR { phone }
 *
 * Returns:
 *   { exists: false }
 *   { exists: true, role: "owner"|"vet"|"admin", provider: "email"|"google"|"phone"|"unknown" }
 *
 * `provider` tells the UI how this account was created so it can show the
 * right guidance (e.g. "log in with Google", "use email+password", etc.)
 */
function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createServiceClient();

    // Rate limit: 10 requests per IP per minute (prevents email enumeration)
    const ip = getIp(req);
    const rlKey = `check-email::${ip}`;
    const { data: rl } = await supabase
      .from("rate_limit")
      .select("attempt_count, locked_until")
      .eq("key", rlKey)
      .maybeSingle();

    if (rl?.locked_until && new Date(rl.locked_until) > new Date()) {
      return NextResponse.json({ error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });
    }
    const newRlCount = (rl?.attempt_count ?? 0) + 1;
    const rlLocked = newRlCount >= 10 ? new Date(Date.now() + 60_000).toISOString() : null;
    await supabase.from("rate_limit").upsert(
      { key: rlKey, attempt_count: newRlCount, locked_until: rlLocked, last_attempt_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    // ── Phone lookup ──────────────────────────────────────────────────────────
    if (body.phone) {
      const raw        = String(body.phone).trim();
      const normalised = raw.startsWith("+90") ? raw : `+90${raw.replace(/^0/, "")}`;

      const { data, error } = await supabase
        .from("users")
        .select("id, role")
        .eq("phone", normalised)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data)  return NextResponse.json({ exists: false });
      return NextResponse.json({ exists: true, role: data.role, provider: "phone" });
    }

    // ── Email lookup ──────────────────────────────────────────────────────────
    const email = body.email;
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email veya phone zorunludur" }, { status: 400 });
    }

    const emailNorm = email.toLowerCase().trim();

    // 1. Check public.users (role) — case-insensitive so "User@Gmail.com" matches "user@gmail.com"
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, role")
      .ilike("email", emailNorm)
      .maybeSingle();

    if (userError) {
      console.error("check-email user error:", userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (!userData) return NextResponse.json({ exists: false });

    // 2. Detect auth provider from auth.users via service role
    //    identities.provider = "email" | "google" | "phone" | …
    const { data: authUser } = await supabase.auth.admin.getUserById(userData.id);
    const identities = authUser?.user?.identities ?? [];
    const providers  = identities.map((i: { provider: string }) => i.provider);

    let provider: string;
    if (providers.includes("google"))      provider = "google";
    else if (providers.includes("email"))  provider = "email";
    else if (providers.includes("phone"))  provider = "phone";
    else                                   provider = "unknown";

    return NextResponse.json({ exists: true, role: userData.role, provider });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
