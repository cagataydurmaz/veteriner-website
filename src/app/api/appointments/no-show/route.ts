import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Vet marks owner as no-show.
 * - Sets status = "no_show"
 * - For video: refunds owner (payment_status = "refunded_full") since vet was present
 *   but owner didn't show up — platform policy: still refund (health platform)
 * - For in_person: no payment was held, just log it
 * - Increments vet's no-show tracking (future: auto-flag repeat no-shows)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { appointmentId } = await req.json();
    if (!appointmentId)
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });

    // Verify caller is the vet
    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });

    const { data: apt } = await supabase
      .from("appointments")
      .select("id, type, status, payment_status, payment_amount, owner_id, datetime")
      .eq("id", appointmentId)
      .eq("vet_id", vet.id)
      .maybeSingle();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    if (apt.status !== "confirmed")
      return NextResponse.json({ error: "Sadece onaylanmış randevular için gelmedi işareti yapılabilir" }, { status: 400 });

    // Must be past the appointment time
    const aptTime = new Date(apt.datetime);
    if (aptTime > new Date())
      return NextResponse.json({ error: "Randevu saati henüz geçmedi" }, { status: 400 });

    // Mark as no_show
    await supabase
      .from("appointments")
      .update({
        status: "no_show",
        payment_status: apt.type === "video" ? "refunded_full" : apt.payment_status,
      })
      .eq("id", appointmentId);

    // Notify owner via notification
    await supabase.from("notifications").insert({
      user_id: apt.owner_id,
      title: "Randevunuz işlendi",
      body: "Veteriner randevunuza katılmadığınızı bildirdi. İtiraz için destek ekibimizle iletişime geçebilirsiniz.",
    });

    return NextResponse.json({
      success: true,
      message: "Gelmedi olarak işaretlendi. Hasta bilgilendirildi.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("appointments/no-show error:", msg);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
