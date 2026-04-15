import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { vetId, appointmentId, reason, details } = await req.json();

    const validReasons = [
      "platform_disina_yonlendirdi",
      "iletisim_bilgisi_paylasti",
      "uygunsuz_davranis",
      "diger",
    ];

    if (!vetId || !reason || !validReasons.includes(reason)) {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    // Verify vet exists
    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id")
      .eq("id", vetId)
      .single();

    if (!vet) return NextResponse.json({ error: "Veteriner bulunamadı" }, { status: 404 });

    // Service client for all writes — violation_reports, veterinarians, system_errors
    // must bypass RLS WITH CHECK to avoid 500 errors.
    const service = createServiceClient();

    // Check for duplicate report within 24h
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data: existing } = await supabase
      .from("violation_reports")
      .select("id")
      .eq("reporter_id", user.id)
      .eq("vet_id", vetId)
      .eq("reason", reason)
      .gte("created_at", oneDayAgo)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Bu konuda son 24 saat içinde zaten bir rapor gönderdiniz" },
        { status: 429 }
      );
    }

    const { error } = await service.from("violation_reports").insert({
      reporter_id: user.id,
      vet_id: vetId,
      appointment_id: appointmentId || null,
      reason,
      details: details || null,
      status: "pending",
    });

    if (error) throw error;

    // Auto-review trigger: count off-platform reports for this vet
    if (reason === "platform_disina_yonlendirdi" || reason === "iletisim_bilgisi_paylasti") {
      const { count: offPlatformCount } = await supabase
        .from("violation_reports")
        .select("*", { count: "exact", head: true })
        .eq("vet_id", vetId)
        .in("reason", ["platform_disina_yonlendirdi", "iletisim_bilgisi_paylasti"])
        .eq("status", "pending");

      if ((offPlatformCount ?? 0) >= 3) {
        // Flag vet for automatic admin review
        void service.from("veterinarians").update({ needs_review: true }).eq("id", vetId);
        void service.from("system_errors").insert({
          context: "auto_review_trigger",
          message: `Vet ${vetId} flagged for admin review: ${offPlatformCount} off-platform reports`,
          severity: "high",
        });
      }
    }

    return NextResponse.json({ success: true, message: "Raporunuz alındı. İncelendikten sonra gerekli işlem yapılacaktır." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("report submit error:", msg);
    return NextResponse.json({ error: "Rapor gönderilemedi" }, { status: 500 });
  }
}
