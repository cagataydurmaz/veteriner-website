import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/vet/settings
 * Updates vet-level settings (auto_approve_appointments, etc.).
 *
 * Uses service_role for the write to bypass RLS WITH CHECK correlated sub-query
 * which fails for user-client writes on the veterinarians table.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await req.json() as { auto_approve_appointments?: boolean };

    // Fetch vet id via user client (auth-validated)
    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });

    // Build update payload
    const update: Record<string, unknown> = {};
    if (body.auto_approve_appointments !== undefined) {
      update.auto_approve_appointments = Boolean(body.auto_approve_appointments);
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
    }

    // Service client write
    const service = createServiceClient();
    const { error } = await service
      .from("veterinarians")
      .update(update)
      .eq("id", vet.id);

    if (error) {
      console.error("[api/vet/settings] update error:", error);
      return NextResponse.json({ error: "Ayar kaydedilemedi. Tekrar deneyin." }, { status: 500 });
    }

    const autoApprove = update.auto_approve_appointments as boolean;
    return NextResponse.json({
      success: true,
      message: autoApprove
        ? "Otomatik onay açıldı — randevular anında kesinleşecek."
        : "Manuel onay modu aktif — her talebi kendiniz onaylayacaksınız.",
    });
  } catch (err) {
    console.error("[api/vet/settings]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
