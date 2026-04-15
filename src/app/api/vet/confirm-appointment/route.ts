import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendAppointmentConfirmationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { appointmentId } = await req.json();
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId zorunludur" }, { status: 400 });
    }

    // Verify caller is a vet
    const { data: vetRow } = await supabase
      .from("veterinarians")
      .select("id, user_id, user:users!veterinarians_user_id_fkey(full_name)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vetRow) {
      return NextResponse.json({ error: "Veteriner bulunamadı" }, { status: 403 });
    }

    // Fetch appointment with owner info
    const { data: apt, error: aptErr } = await serviceSupabase
      .from("appointments")
      .select(`
        id, datetime, type, status, payment_status, vet_id,
        owner:users!appointments_owner_id_fkey(id, full_name, email)
      `)
      .eq("id", appointmentId)
      .eq("vet_id", vetRow.id)
      .maybeSingle();

    if (aptErr || !apt) {
      return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    }

    if (apt.status !== "pending") {
      return NextResponse.json({ error: "Bu randevu zaten işleme alınmış" }, { status: 400 });
    }

    // For video appointments, payment must be held before confirmation
    if (apt.type === "video" && apt.payment_status !== "held") {
      return NextResponse.json({
        error: "Video randevusu için ödeme alınmadan onay verilemez"
      }, { status: 400 });
    }

    // Update status to confirmed
    const { error: updateErr } = await serviceSupabase
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", appointmentId);

    if (updateErr) throw updateErr;

    // Send confirmation email to owner
    type OwnerRow = { id: string; full_name: string; email: string } | null;
    const owner = (Array.isArray(apt.owner) ? apt.owner[0] : apt.owner) as OwnerRow;

    if (owner?.email) {
      const vetName =
        Array.isArray(vetRow.user)
          ? (vetRow.user[0] as { full_name: string })?.full_name
          : (vetRow.user as { full_name: string } | null)?.full_name ?? "Veterineriniz";

      const dt = new Date(apt.datetime as string);
      const date = dt.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const time = dt.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const type = (apt.type as string) === "video" ? "Video Görüşme" : "Yüz Yüze";

      sendAppointmentConfirmationEmail({
        to: owner.email,
        name: owner.full_name,
        vetName: `Dr. ${vetName}`,
        date,
        time,
        type,
        appointmentId,
      }).catch((err) => console.error("[vet/confirm-appointment] email failed:", err));
    }

    return NextResponse.json({ success: true, message: "Randevu onaylandı" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("confirm-appointment error:", msg);
    return NextResponse.json({ error: "Onaylama işlemi başarısız" }, { status: 500 });
  }
}
