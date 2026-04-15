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
    // Use signInWithPassword to confirm the user knows their own password.
    // We capture email before potential anonymization.
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

  // ── 4. Get vet record (need vet.id for appointment cancellation) ───────────
  const { data: vet } = await service
    .from("veterinarians")
    .select("id, account_status")
    .eq("user_id", user.id)
    .single();

  if (!vet) {
    return NextResponse.json({ error: "Veteriner kaydı bulunamadı" }, { status: 404 });
  }

  // ── 5. Get user's name before anonymizing (for the goodbye email) ──────────
  const { data: userData } = await service
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const displayName = userData?.full_name?.split(" ")?.[0] ?? "Veteriner";

  // ── 6. Cancel all future appointments ─────────────────────────────────────
  await service
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("vet_id", vet.id)
    .in("status", ["pending", "confirmed"])
    .gt("datetime", new Date().toISOString());

  // ── 7. Soft-delete + anonymize veterinarians row ───────────────────────────
  await service
    .from("veterinarians")
    .update({
      account_status: "deleted",
      deleted_at: new Date().toISOString(),
    })
    .eq("id", vet.id);

  // ── 8. Soft-delete + anonymize users row ──────────────────────────────────
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

  // ── 9. Log the change ──────────────────────────────────────────────────────
  await service.from("account_status_logs").insert({
    user_id: user.id,
    user_type: "vet",
    old_status: vet.account_status ?? "active",
    new_status: "deleted",
    reason: "Kullanıcı kendi talebiyle hesabını sildi",
    changed_by: user.id,
  });

  // ── 10. Send confirmation email (best-effort, fire-and-forget) ─────────────
  sendAccountDeletionEmail({
    to: userEmail,
    name: displayName,
  }).catch((err) => console.error("[vet/self-delete] email failed:", err));

  // ── 11. Hard-delete from auth.users (GDPR compliance) ─────────────────────
  await service.auth.admin.deleteUser(user.id);

  return NextResponse.json({ success: true });
}
