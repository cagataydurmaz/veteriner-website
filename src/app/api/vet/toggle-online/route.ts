import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { broadcastVetStatus } from "@/lib/vetBroadcast";

/**
 * POST /api/vet/toggle-online
 * Layer 1: Requires offers_video = true
 * Layer 3: Blocked when going online if is_busy=true OR buffer_lock=true
 * Body: { online: boolean }
 */
export async function POST(req: Request) {
  const t0 = performance.now();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await req.json() as { online: boolean };
    const online = Boolean(body.online);

    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id, account_status, offers_video, is_busy, buffer_lock, is_verified")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });
    if (!vet.is_verified) return NextResponse.json({ error: "Hesabınız henüz onaylanmadı" }, { status: 403 });
    if (vet.account_status && vet.account_status !== "active") {
      return NextResponse.json({ error: "Hesabınız aktif değil" }, { status: 403 });
    }

    // ── Layer 1: Permission check ──────────────────────────────────────────────
    if (online && !vet.offers_video) {
      return NextResponse.json(
        { error: "Online görüşme seçeneğini profilinizden aktive edin", layer: 1 },
        { status: 400 }
      );
    }

    // ── Layer 3: Reality checks (only when going ONLINE) ───────────────────────
    if (online && vet.is_busy) {
      return NextResponse.json(
        { error: "Aktif görüşme devam ederken online çıkılamaz", layer: 3 },
        { status: 409 }
      );
    }
    if (online && vet.buffer_lock) {
      return NextResponse.json(
        { error: "30 dakika içinde klinikte randevunuz var — tampon koruması aktif", layer: 3 },
        { status: 409 }
      );
    }

    // ── Write Layer 2 + Layer 3 columns via service_role ──────────────────────
    // Both is_online_now (L2) and heartbeat_at (L3) use service_role to bypass
    // the RLS WITH CHECK correlated sub-query which can fail under concurrent load.
    // Auth + business-logic validation is already done above via user client.
    const service = createServiceClient();
    const updatePayload: Record<string, unknown> = { is_online_now: online };
    if (online) updatePayload.heartbeat_at = new Date().toISOString();

    const { error } = await service
      .from("veterinarians")
      .update(updatePayload)
      .eq("id", vet.id);

    if (error) throw error;

    // ── Neural Sync: broadcast to all connected owner-side subscribers ─────────
    void broadcastVetStatus(vet.id, { is_online_now: online });

    const dur = Math.round(performance.now() - t0);
    return NextResponse.json({
      success: true,
      is_online_now: online,
      message: online
        ? "Video konsültasyona açıksınız — hastalar sizi bulabilir. 📹"
        : "Online durumu kapatıldı — yeni video randevusu alınamaz.",
    }, {
      headers: { "Server-Timing": `db;dur=${dur};desc="toggle-online"` },
    });
  } catch (err) {
    console.error("[toggle-online]", err);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
