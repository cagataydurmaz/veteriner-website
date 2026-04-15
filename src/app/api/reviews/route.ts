import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { appointmentId, vetId, rating, comment } = await req.json();
    if (!appointmentId || !vetId || !rating)
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
    if (rating < 1 || rating > 5)
      return NextResponse.json({ error: "Puan 1-5 arasında olmalıdır" }, { status: 400 });

    const service = createServiceClient();

    // Validate: appointment must be completed and owned by this user
    const { data: apt } = await service
      .from("appointments")
      .select("id, status, owner_id, vet_id, datetime")
      .eq("id", appointmentId)
      .eq("owner_id", user.id)
      .eq("vet_id", vetId)
      .maybeSingle();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    if (apt.status !== "completed")
      return NextResponse.json({ error: "Yalnızca tamamlanan randevular değerlendirilebilir" }, { status: 400 });

    // Check review window: must be within 30 days of completion
    const aptDate = new Date(apt.datetime);
    const daysSince = (Date.now() - aptDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30)
      return NextResponse.json({ error: "Değerlendirme süresi dolmuştur (30 gün)" }, { status: 400 });

    // Upsert review
    const { error: reviewError } = await service.from("reviews").upsert({
      appointment_id: appointmentId,
      vet_id: vetId,
      owner_id: user.id,
      rating,
      comment: comment || null,
      is_approved: false, // needs admin approval
    }, { onConflict: "appointment_id" });

    if (reviewError) throw reviewError;

    // Recalculate vet average server-side (only approved reviews)
    const { data: allReviews } = await service
      .from("reviews")
      .select("rating")
      .eq("vet_id", vetId)
      .eq("is_approved", true);

    if (allReviews && allReviews.length > 0) {
      const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
      await service.from("veterinarians").update({
        average_rating: Math.round(avg * 10) / 10,
        total_reviews: allReviews.length,
      }).eq("id", vetId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
