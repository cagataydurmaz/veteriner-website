import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSMS } from "@/lib/sms";
import { sendAccountStatusEmail, sendVetApprovalEmail, sendAccountDeletionEmail } from "@/lib/email";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (userData?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const vetId = body.vetId as string | undefined;
  const action = body.action as string | undefined;
  const account_status = body.account_status as string | undefined;
  const suspended_until = body.suspended_until as string | null | undefined;
  const suspension_reason = body.suspension_reason as string | null | undefined;
  const banned_reason = body.banned_reason as string | null | undefined;
  const durationDays = body.durationDays as number | string | undefined;
  const admin_note = body.admin_note as string | null | undefined;
  const reject_reason = body.reject_reason as string | null | undefined;

  if (!vetId) {
    return NextResponse.json({ error: "vetId zorunlu" }, { status: 400 });
  }
  if (!action) {
    return NextResponse.json({ error: "action zorunlu" }, { status: 400 });
  }

  // Helper — fire-and-forget audit log write
  const auditLog = (targetId: string, reason?: string | null, metadata?: Record<string, unknown>) =>
    service.from("admin_audit_logs").insert({
      admin_id: user.id,
      action,
      target_type: "vet",
      target_id: targetId,
      reason: reason ?? null,
      metadata: metadata ?? null,
    }).then(
      () => null,
      (e: unknown) => { console.error("[audit]", e); }
    );

  // ── approve_vet ─────────────────────────────────────────────────────────────
  if (action === "approve_vet") {
    await service.from("veterinarians").update({ is_verified: true }).eq("id", vetId);
    await auditLog(vetId);

    const { data: vetData } = await service
      .from("veterinarians")
      .select("user:users(email, full_name)")
      .eq("id", vetId)
      .maybeSingle();
    const vetUser = (vetData as Record<string, unknown>)?.user as Record<string, unknown> | null;

    if (vetUser?.email) {
      sendVetApprovalEmail({
        to: vetUser.email as string,
        name: (vetUser.full_name as string) || "Veteriner",
        approved: true,
      }).catch((err) => console.error("[admin/vet-action] approve_vet email failed:", err));
    }

    return NextResponse.json({ success: true });
  }

  // ── reject_vet ──────────────────────────────────────────────────────────────
  if (action === "reject_vet") {
    if (!reject_reason || !(reject_reason as string).trim()) {
      return NextResponse.json({ error: "Red gerekçesi zorunludur. Veterinere sebep belirtilmelidir." }, { status: 400 });
    }
    await service
      .from("veterinarians")
      .update({ is_verified: false, rejection_reason: (reject_reason as string).trim() })
      .eq("id", vetId);
    await auditLog(vetId, (reject_reason as string) || null);

    const { data: vetData } = await service
      .from("veterinarians")
      .select("user:users(email, full_name)")
      .eq("id", vetId)
      .maybeSingle();
    const vetUser = (vetData as Record<string, unknown>)?.user as Record<string, unknown> | null;

    if (vetUser?.email) {
      sendVetApprovalEmail({
        to: vetUser.email as string,
        name: (vetUser.full_name as string) || "Veteriner",
        approved: false,
        reason: (reject_reason as string) || null,
      }).catch((err) => console.error("[admin/vet-action] reject_vet email failed:", err));
    }

    return NextResponse.json({ success: true });
  }

  // ── set_status ──────────────────────────────────────────────────────────────
  if (action === "set_status") {
    // Resolve suspended_until if not explicitly provided but durationDays is given
    let resolvedUntil = suspended_until ?? null;
    if (account_status === "suspended" && !resolvedUntil && durationDays) {
      const d = new Date();
      d.setDate(d.getDate() + Number(durationDays));
      resolvedUntil = d.toISOString();
    }

    // Get old status first for logging
    const { data: vetBefore } = await service
      .from("veterinarians")
      .select("account_status, user_id")
      .eq("id", vetId)
      .maybeSingle();

    const updatePayload: Record<string, unknown> = { account_status };
    if (account_status === "suspended") {
      updatePayload.suspended_until = resolvedUntil;
      updatePayload.suspension_reason = suspension_reason ?? null;
      updatePayload.banned_reason = null;
    } else if (account_status === "banned") {
      updatePayload.banned_reason = banned_reason ?? null;
      updatePayload.suspended_until = null;
      updatePayload.suspension_reason = null;
    } else if (account_status === "active") {
      updatePayload.suspended_until = null;
      updatePayload.suspension_reason = null;
      updatePayload.banned_reason = null;
    }

    await service.from("veterinarians").update(updatePayload).eq("id", vetId);
    await auditLog(vetId, (suspension_reason ?? banned_reason ?? null) as string | null, {
      new_status: account_status,
      old_status: vetBefore?.account_status ?? "active",
      suspended_until: resolvedUntil,
    });

    // Log the change
    await service.from("account_status_logs").insert({
      user_id: vetBefore?.user_id ?? null,
      user_type: "vet",
      old_status: vetBefore?.account_status ?? "active",
      new_status: account_status,
      reason: suspension_reason ?? banned_reason ?? null,
      changed_by: user.id,
    });

    // Email notification (birincil) + SMS yalnızca banned için (best-effort)
    const { data: vetData } = await service
      .from("veterinarians")
      .select("user:users(phone, email, full_name)")
      .eq("id", vetId)
      .maybeSingle();
    const vetUser = (vetData as Record<string, unknown>)?.user as Record<string, unknown> | null;

    if (vetUser?.email) {
      sendAccountStatusEmail({
        to: vetUser.email as string,
        name: (vetUser.full_name as string) || "Veteriner",
        status: account_status as string,
        reason: (suspension_reason ?? banned_reason ?? null) as string | null,
        suspendedUntil: resolvedUntil,
      }).catch((err) => console.error("[admin/vet-action] set_status email failed:", err));
    }

    // SMS yedek — yalnızca banned durumu için
    if (account_status === "banned" && vetUser?.phone) {
      sendSMS(
        vetUser.phone as string,
        "Hesabınız kalıcı olarak kapatıldı. İtiraz için destek@veterineribul.com"
      ).catch((err) => console.error("[admin/vet-action] set_status sms failed:", err));
    }

    return NextResponse.json({ success: true });
  }

  // ── set_admin_note ──────────────────────────────────────────────────────────
  if (action === "set_admin_note") {
    await service
      .from("veterinarians")
      .update({ admin_note: admin_note ?? null })
      .eq("id", vetId);
    await auditLog(vetId, (admin_note as string) || null);
    return NextResponse.json({ success: true });
  }

  // ── delete_account ──────────────────────────────────────────────────────────
  if (action === "delete_account") {
    // Get vet's user_id and status first
    const { data: vetRecord } = await service
      .from("veterinarians")
      .select("user_id, account_status")
      .eq("id", vetId)
      .maybeSingle();

    const userId = vetRecord?.user_id;

    // Get user email + name before anonymizing (for deletion email)
    let userEmail: string | null = null;
    let userName = "Veteriner";
    if (userId) {
      const { data: userRecord } = await service
        .from("users")
        .select("email, full_name")
        .eq("id", userId)
        .maybeSingle();
      userEmail = (userRecord?.email as string | null) ?? null;
      userName = (userRecord?.full_name as string | null)?.split(" ")?.[0] ?? "Veteriner";
    }

    // Cancel all pending/confirmed future appointments for this vet
    await service
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("vet_id", vetId)
      .in("status", ["pending", "confirmed"])
      .gt("datetime", new Date().toISOString());

    // Send deletion email before anonymizing (best-effort)
    if (userEmail) {
      sendAccountDeletionEmail({
        to: userEmail,
        name: userName,
      }).catch((err) => console.error("[admin/vet-action] delete_account email failed:", err));
    }

    // Soft delete + anonymize veterinarians row
    await service
      .from("veterinarians")
      .update({
        account_status: "deleted",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", vetId);

    // Soft delete + anonymize users row
    if (userId) {
      await service
        .from("users")
        .update({
          account_status: "deleted",
          deleted_at: new Date().toISOString(),
          full_name: "[Silindi]",
          email: null,
          phone: null,
        })
        .eq("id", userId);
    }

    // Log
    await service.from("account_status_logs").insert({
      user_id: userId ?? null,
      user_type: "vet",
      old_status: vetRecord?.account_status ?? "active",
      new_status: "deleted",
      reason: "KVKK gereği hesap silme",
      changed_by: user.id,
    });

    // Hard-delete from auth.users (GDPR compliance, invalidates all sessions)
    if (userId) {
      await service.auth.admin.deleteUser(userId);
    }

    await auditLog(vetId, "KVKK/GDPR hesap silme", { userId });

    return NextResponse.json({ success: true });
  }

  // ── verify_oda ──────────────────────────────────────────────────────────────
  if (action === "verify_oda") {
    await service.from("veterinarians").update({
      oda_verified: true,
      oda_verified_at: new Date().toISOString(),
    }).eq("id", vetId);
    await auditLog(vetId, "ODA kaydı doğrulandı");
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
}
