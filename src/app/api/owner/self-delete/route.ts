import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendAccountDeletionEmail } from "@/lib/email";

export async function POST(request: Request) {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  const { password } = await request.json();

  const service = createServiceClient();

  // ── 3. Determine if user is Google-only (no email identity) ───────────────
  const { data: authUserData } = await service.auth.admin.getUserById(user.id);
  const identities = authUserData?.user?.identities ?? [];
  const hasEmailIdentity = identities.some((i) => i.provider === "email");

  if (hasEmailIdentity) {
    // Email+password user — verify password
    if (!password) {
      return NextResponse.json({ error: "Şifre gerekli" }, { status: 400 });
    }
    const userEmail = user.email!;
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    });
    if (authError) {
      return NextResponse.json({ error: "Şifre yanlış" }, { status: 401 });
    }
  }
  // Google-only users: skip password verification

  const userEmail = user.email!;

  // ── 4. Get user's name before anonymizing (for the goodbye email) ──────────
  const { data: userData } = await service
    .from("users")
    .select("full_name, account_status")
    .eq("id", user.id)
    .single();

  const displayName = userData?.full_name?.split(" ")?.[0] ?? "Kullanıcı";

  // ── 5. Cancel all future appointments booked by this owner ────────────────
  await service
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("owner_id", user.id)
    .in("status", ["pending", "confirmed"])
    .gt("datetime", new Date().toISOString());

  // ── 6. Soft-delete + anonymize users row ──────────────────────────────────
  await service
    .from("users")
    .update({
      account_status: "deleted",
      deleted_at: new Date().toISOString(),
      full_name: "[Silindi]",
      email: null,
      phone: null,
    })
    .eq("id", user.id);

  // ── 7. Log the change ──────────────────────────────────────────────────────
  await service.from("account_status_logs").insert({
    user_id: user.id,
    user_type: "owner",
    old_status: userData?.account_status ?? "active",
    new_status: "deleted",
    reason: "Kullanıcı kendi talebiyle hesabını sildi",
    changed_by: user.id,
  });

  // ── 8. Send confirmation email (best-effort, fire-and-forget) ─────────────
  sendAccountDeletionEmail({
    to: userEmail,
    name: displayName,
  }).catch((err) => console.error("[owner/self-delete] email failed:", err));

  // ── 9. Hard-delete from auth.users (GDPR compliance) ──────────────────────
  await service.auth.admin.deleteUser(user.id);

  return NextResponse.json({ success: true });
}
