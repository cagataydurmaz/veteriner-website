import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    // Verify admin role
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Admin yetkisi gerekli" }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
    }
    const reportId = body.reportId as string | undefined;
    const action = body.action as string | undefined;

    if (!reportId || !action || !["warn_suspend", "ban", "dismiss"].includes(action)) {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    // Get the report
    const { data: report } = await supabase
      .from("violation_reports")
      .select("id, vet_id, status")
      .eq("id", reportId)
      .maybeSingle();

    if (!report) return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 });

    // Use service client for all writes — bypasses RLS WITH CHECK on
    // veterinarians table (correlated sub-query issue) and ensures
    // admin actions always succeed regardless of row-level policies.
    const service = createServiceClient();

    if (action === "dismiss") {
      await service
        .from("violation_reports")
        .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
        .eq("id", reportId);

      return NextResponse.json({ message: "Rapor reddedildi" });
    }

    if (action === "warn_suspend") {
      const suspensionUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Increment violation count, set suspension
      const { data: vet } = await supabase
        .from("veterinarians")
        .select("violation_count")
        .eq("id", report.vet_id)
        .maybeSingle();

      await service
        .from("veterinarians")
        .update({
          suspension_until: suspensionUntil,
          violation_count: (vet?.violation_count || 0) + 1,
        })
        .eq("id", report.vet_id);

      await service
        .from("violation_reports")
        .update({ status: "actioned", reviewed_at: new Date().toISOString(), admin_note: "7 gün askıya alındı" })
        .eq("id", reportId);

      return NextResponse.json({ message: "Veteriner uyarıldı ve 7 gün askıya alındı" });
    }

    if (action === "ban") {
      await service
        .from("veterinarians")
        .update({
          is_banned: true,
          violation_count: 2,
        })
        .eq("id", report.vet_id);

      await service
        .from("violation_reports")
        .update({ status: "actioned", reviewed_at: new Date().toISOString(), admin_note: "Kalıcı olarak kapatıldı" })
        .eq("id", reportId);

      return NextResponse.json({ message: "Veteriner hesabı kalıcı olarak kapatıldı" });
    }

    return NextResponse.json({ error: "Bilinmeyen işlem" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("report action error:", msg);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
