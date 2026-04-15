import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSMS } from "@/lib/sms";
import { sendAccountStatusEmail, sendAccountDeletionEmail } from "@/lib/email";

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
  const ownerId = body.ownerId as string | undefined;
  const action = body.action as string | undefined;
  const account_status = body.account_status as string | undefined;
  const suspended_until = body.suspended_until as string | null | undefined;
  const suspension_reason = body.suspension_reason as string | null | undefined;
  const banned_reason = body.banned_reason as string | null | undefined;
  const durationDays = body.durationDays as number | string | undefined;
  const admin_note = body.admin_note as string | null | undefined;

  if (!ownerId) {
    return NextResponse.json({ error: "ownerId zorunlu" }, { status: 400 });
  }
  if (!action) {
    return NextResponse.json({ error: "action zorunlu" }, { status: 400 });
  }

  // Helper — fire-and-forget audit log write
  const auditLog = (targetId: string, reason?: string | null, metadata?: Record<string, unknown>) =>
    service.from("admin_audit_logs").insert({
      admin_id: user.id,
      action,
      target_type: "owner",
      target_id: targetId,
      reason: reason ?? null,
      metadata: metadata ?? null,
    }).then(
      () => null,
      (e: unknown) => { console.error("[audit]", e); }
    );

  // ── set_status ──────────────────────────────────────────────────────────────
  if (action === "set_status") {
    // Resolve suspended_until if not explicitly provided but durationDays is given
    let resolvedUntil = suspended_until ?? null;
    if (account_status === "suspended" && !resolvedUntil && durationDays) {
      const d = new Date();
      d.setDate(d.getDate() + Number(durationDays));
      resolvedUntil = d.toISOString();
    }

    // Get old status for logging
    const { data: ownerBefore } = await service
      .from("users")
      .select("account_status, phone, email, full_name")
      .eq("id", ownerId)
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

    await service.from("users").update(updatePayload).eq("id", ownerId);
    await auditLog(ownerId, (suspension_reason ?? banned_reason ?? null) as string | null, {
      new_status: account_status,
      old_status: ownerBefore?.account_status ?? "active",
      suspended_until: resolvedUntil,
    });

    // Log the change
    await service.from("account_status_logs").insert({
      user_id: ownerId,
      user_type: "owner",
      old_status: ownerBefore?.account_status ?? "active",
      new_status: account_status,
      reason: suspension_reason ?? banned_reason ?? null,
      changed_by: user.id,
    });

    // Email notification (birincil) + SMS yalnızca banned için (best-effort)
    const ownerEmail = (ownerBefore as Record<string, unknown> | null)?.email as string | null;
    const ownerName = (ownerBefore as Record<string, unknown> | null)?.full_name as string | null;
    const ownerPhone = (ownerBefore as Record<string, unknown> | null)?.phone as string | null;

    if (ownerEmail) {
      sendAccountStatusEmail({
        to: ownerEmail,
        name: ownerName || "Kullanıcı",
        status: account_status as string,
        reason: (suspension_reason ?? banned_reason ?? null) as string | null,
        suspendedUntil: resolvedUntil,
      }).catch((err) => console.error("[admin/owner-action] set_status email failed:", err));
    }

    // SMS yedek — yalnızca banned durumu için
    if (account_status === "banned" && ownerPhone) {
      sendSMS(
        ownerPhone,
        "Hesabınız kalıcı olarak kapatıldı. İtiraz için destek@veterineribul.com"
      ).catch((err) => console.error("[admin/owner-action] set_status sms failed:", err));
    }

    return NextResponse.json({ success: true });
  }

  // ── set_admin_note ──────────────────────────────────────────────────────────
  if (action === "set_admin_note") {
    await service
      .from("users")
      .update({ admin_note: admin_note ?? null })
      .eq("id", ownerId);
    await auditLog(ownerId, (admin_note as string) || null);
    return NextResponse.json({ success: true });
  }

  // ── delete_account ──────────────────────────────────────────────────────────
  if (action === "delete_account") {
    // Get owner info before anonymizing (for email and logging)
    const { data: ownerBefore } = await service
      .from("users")
      .select("account_status, email, full_name")
      .eq("id", ownerId)
      .maybeSingle();

    const ownerEmail = ownerBefore?.email as string | null;
    const ownerName = (ownerBefore?.full_name as string | null)?.split(" ")?.[0] ?? "Kullanıcı";

    // Cancel all pending/confirmed future appointments for this owner
    await service
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("owner_id", ownerId)
      .in("status", ["pending", "confirmed"])
      .gt("datetime", new Date().toISOString());

    // Send deletion email before anonymizing (best-effort)
    if (ownerEmail) {
      sendAccountDeletionEmail({
        to: ownerEmail,
        name: ownerName,
      }).catch((err) => console.error("[admin/owner-action] delete_account email failed:", err));
    }

    // Soft delete + anonymize
    await service
      .from("users")
      .update({
        account_status: "deleted",
        deleted_at: new Date().toISOString(),
        full_name: "[Silindi]",
        email: null,
        phone: null,
      })
      .eq("id", ownerId);

    // Log
    await service.from("account_status_logs").insert({
      user_id: ownerId,
      user_type: "owner",
      old_status: ownerBefore?.account_status ?? "active",
      new_status: "deleted",
      reason: "KVKK gereği hesap silme",
      changed_by: user.id,
    });

    // Hard-delete from auth.users (GDPR compliance, invalidates all sessions)
    await service.auth.admin.deleteUser(ownerId);

    await auditLog(ownerId, "KVKK/GDPR hesap silme");

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
}
