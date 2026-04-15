import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { broadcastVetStatus } from "@/lib/vetBroadcast";

/**
 * POST /api/vet/toggle-available
 * Layer 1: Requires offers_in_person = true
 * Layer 3: Blocked while is_busy = true
 * Body: { available: boolean }
 */
export async function POST(req: Request) {
  const t0 = performance.now();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await req.json() as { available: boolean };
    const available = Boolean(body.available);

    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id, account_status, offers_in_person, is_busy, is_verified")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });
    if (!vet.is_verified) return NextResponse.json({ error: "Hesabınız henüz onaylanmadı" }, { status: 403 });
    if (vet.account_status && vet.account_status !== "active") {
      return NextResponse.json({ error: "Hesabınız aktif değil" }, { status: 403 });
    }

    // ── Layer 1: Permission check ──────────────────────────────────────────────
    if (available && !vet.offers_in_person) {
      return NextResponse.json(
        { error: "Klinikte muayene seçeneğini profilinizden aktive edin", layer: 1 },
        { status: 400 }
      );
    }

    // ── Layer 3: Reality check ─────────────────────────────────────────────────
    if (available && vet.is_busy) {
      return NextResponse.json(
        { error: "Aktif görüşme devam ederken müsaitlik değiştirilemez", layer: 3 },
        { status: 409 }
      );
    }

    // Use service client — bypasses RLS WITH CHECK on Layer 2 columns.
    // Auth + business-logic validation already done above via user client.
    const service = createServiceClient();
    const { error } = await service
      .from("veterinarians")
      .update({ is_available_today: available })
      .eq("id", vet.id);

    if (error) throw error;

    // ── Neural Sync: broadcast status change to owner-side subscribers ─────────
    void broadcastVetStatus(vet.id, { is_available_today: available });

    // ── Calendar-First check: warn if no slots are configured for today ────────
    // This doesn't block the toggle — the vet can still mark themselves available —
    // but the owner's booking UI won't show any slots if no template exists.
    let calendarWarning: string | undefined;
    if (available) {
      const todayDow = new Date().getDay(); // 0=Sun … 6=Sat
      const { count: slotCount } = await service
        .from("availability_slots")
        .select("id", { count: "exact", head: true })
        .eq("vet_id", vet.id)
        .eq("day_of_week", todayDow)
        .eq("is_active", true);

      if (!slotCount || slotCount === 0) {
        calendarWarning =
          "Bugün için takvimde aktif saat dilimi bulunmuyor. " +
          "Randevu alınabilmesi için Takvim sayfasından saat ekleyin.";
      }
    }

    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? "Günaydın! 🌅" :
      hour < 18 ? "İyi günler! ☀️" :
                  "İyi akşamlar! 🌙";

    const dur = Math.round(performance.now() - t0);
    return NextResponse.json({
      success: true,
      is_available_today: available,
      message: available
        ? `${greeting} Klinikte bugün müsait olarak görünüyorsunuz.`
        : "Klinikte müsaitlik kapatıldı — randevu akışı durduruldu.",
      ...(calendarWarning ? { warning: calendarWarning } : {}),
    }, {
      headers: { "Server-Timing": `db;dur=${dur};desc="toggle-available"` },
    });
  } catch (err) {
    console.error("[toggle-available]", err);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
