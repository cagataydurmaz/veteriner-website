import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Called by vet when video session is marked complete.
// Marks payment as completed (funds released to vet).
// Actual payout is manual/future feature — for MVP we just record it.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { appointmentId } = await req.json();
    if (!appointmentId)
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });

    // Verify caller is the vet for this appointment
    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });

    const { data: apt } = await supabase
      .from("appointments")
      .select("id, payment_status, payment_amount, owner_id")
      .eq("id", appointmentId)
      .eq("vet_id", vet.id)
      .maybeSingle();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    if (apt.payment_status === "completed")
      return NextResponse.json({ success: true, message: "Ödeme zaten tamamlandı" });
    if (apt.payment_status !== "held")
      return NextResponse.json({ error: "Bu randevuda bekleyen ödeme yok" }, { status: 400 });

    // Service client for writes — payment + appointment status changes bypass
    // RLS WITH CHECK sub-query issue on appointments/payments tables.
    const service = createServiceClient();

    // Atomic update — only succeeds if payment_status is still "held"
    // This prevents double-release race conditions
    const { data: updated, error: updateErr } = await service
      .from("appointments")
      .update({ status: "completed", payment_status: "completed" })
      .eq("id", appointmentId)
      .eq("payment_status", "held") // guard: only update if still held
      .select("id")
      .maybeSingle();

    if (updateErr) {
      console.error("video-complete update error:", updateErr.message);
      return NextResponse.json({ error: "Güncelleme başarısız" }, { status: 500 });
    }

    if (!updated) {
      // Another request already completed it
      return NextResponse.json({ success: true, message: "Ödeme zaten tamamlandı" });
    }

    // Log completed payment
    const { error: paymentErr } = await service.from("payments").insert({
      vet_id: vet.id,
      owner_id: apt.owner_id,
      appointment_id: appointmentId,
      amount: apt.payment_amount,
      type: "video_consultation",
      status: "success",
      description: "Video görüşme tamamlandı — ödeme serbest bırakıldı",
    });

    if (paymentErr) {
      console.error("video-complete payment log error:", paymentErr.message);
      // Payment was released but log failed — non-fatal, don't rollback
    }

    return NextResponse.json({
      success: true,
      amount: apt.payment_amount,
      message: `Görüşme tamamlandı. ₺${apt.payment_amount} ödemeniz aktarılacak.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("video-complete error:", msg);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
