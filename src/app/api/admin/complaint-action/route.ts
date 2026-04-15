import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendComplaintResolvedEmail } from "@/lib/email";

const RESOLUTION_LABELS: Record<string, string> = {
  owner_wins: "Kullanıcı haklı bulundu",
  vet_wins: "Veteriner haklı bulundu",
  split: "Ortak karar (50% iade)",
  dismissed: "Şikayet reddedildi",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify admin
  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (userData?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const complaintId = body.complaintId as string | undefined;
  const action = body.action as string | undefined;
  const resolution = body.resolution as string | undefined;
  const admin_note = body.admin_note as string | null | undefined;

  if (!complaintId) {
    return NextResponse.json({ error: "complaintId zorunlu" }, { status: 400 });
  }
  if (!action) {
    return NextResponse.json({ error: "action zorunlu" }, { status: 400 });
  }

  if (action === "set_reviewing") {
    const { error } = await service
      .from("complaints")
      .update({ status: "under_review" })
      .eq("id", complaintId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "resolve") {
    if (!resolution) return NextResponse.json({ error: "resolution zorunlu" }, { status: 400 });

    // Get complaint with appointment and parties info
    const { data: complaint } = await service
      .from("complaints")
      .select(`
        *,
        appointment:appointments(
          id, type, payment_status, payment_amount,
          owner:users!appointments_owner_id_fkey(full_name, phone, email),
          vet:veterinarians!appointments_vet_id_fkey(
            user:users!veterinarians_user_id_fkey(full_name, phone, email)
          )
        )
      `)
      .eq("id", complaintId)
      .maybeSingle();

    if (!complaint) return NextResponse.json({ error: "Şikayet bulunamadı" }, { status: 404 });

    // Update complaint
    await service
      .from("complaints")
      .update({
        status: "resolved",
        resolution,
        admin_note: admin_note || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", complaintId);

    // Trigger refund if needed
    const apt = complaint.appointment as Record<string, unknown>;
    if (apt && (resolution === "owner_wins" || resolution === "split")) {
      const isVideo = apt.type === "video";
      const hasPayment = apt.payment_status === "held" || apt.payment_status === "completed";
      if (isVideo && hasPayment) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://veterineribul.com"}/api/payments/video-refund`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appointmentId: apt.id,
              refundType: resolution === "split" ? "partial" : "full",
              reason: `Admin kararı: ${RESOLUTION_LABELS[resolution]}`,
            }),
          }).catch(() => null);
        } catch { /* ignore refund errors */ }
      }
    }

    // Notify both parties via email (best-effort, fire-and-forget)
    const ownerData = apt?.owner as Record<string, unknown> | null;
    const vetData = apt?.vet as Record<string, unknown> | null;
    const vetUser = vetData?.user as Record<string, unknown> | null;

    const aptId = String(apt?.id ?? "");

    if (ownerData?.email) {
      sendComplaintResolvedEmail({
        to: ownerData.email as string,
        name: (ownerData.full_name as string) || "Kullanıcı",
        resolution,
        appointmentId: aptId,
      }).catch((err) => console.error("[admin/complaint-action] owner email failed:", err));
    }
    if (vetUser?.email) {
      sendComplaintResolvedEmail({
        to: vetUser.email as string,
        name: (vetUser.full_name as string) || "Veteriner",
        resolution,
        appointmentId: aptId,
      }).catch((err) => console.error("[admin/complaint-action] vet email failed:", err));
    }

    return NextResponse.json({ success: true, resolution });
  }

  return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
}
