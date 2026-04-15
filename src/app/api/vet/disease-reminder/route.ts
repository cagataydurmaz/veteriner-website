import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!vet) return NextResponse.json({ error: "Veteriner bulunamadı" }, { status: 403 });

    const { appointmentId, keywords } = await req.json();
    if (!appointmentId || !Array.isArray(keywords)) {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    // Verify this appointment actually belongs to the requesting vet
    const { data: apt } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", appointmentId)
      .eq("vet_id", vet.id)
      .maybeSingle();
    if (!apt) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

    // Upsert: only log once per appointment
    await supabase
      .from("disease_report_reminders")
      .upsert(
        { appointment_id: appointmentId, vet_id: vet.id, disease_keywords: keywords },
        { onConflict: "appointment_id", ignoreDuplicates: true }
      );

    return NextResponse.json({ logged: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    console.error("disease-reminder error:", msg);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
