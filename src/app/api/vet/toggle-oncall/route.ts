import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { broadcastVetStatus } from "@/lib/vetBroadcast";

/**
 * POST /api/vet/toggle-oncall
 * Layer 1: Requires offers_nobetci = true
 * Layer 3: Blocked while is_busy = true OR buffer_lock = true
 * Body: { oncall: boolean }
 */
export async function POST(req: Request) {
  const t0 = performance.now();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await req.json() as { oncall: boolean };
    const oncall = Boolean(body.oncall);

    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id, account_status, offers_nobetci, is_busy, buffer_lock, is_verified")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });
    if (!vet.is_verified) return NextResponse.json({ error: "Hesabınız henüz onaylanmadı" }, { status: 403 });
    if (vet.account_status && vet.account_status !== "active") {
      return NextResponse.json({ error: "Hesabınız aktif değil" }, { status: 403 });
    }

    // ── Layer 1: Permission check ──────────────────────────────────────────────
    if (oncall && !vet.offers_nobetci) {
      return NextResponse.json(
        { error: "Nöbetçi hizmetini profilinizden aktive edin", layer: 1 },
        { status: 400 }
      );
    }

    // ── Layer 3: Reality checks ────────────────────────────────────────────────
    if (oncall && vet.is_busy) {
      return NextResponse.json(
        { error: "Aktif görüşme devam ederken nöbet durumu değiştirilemez", layer: 3 },
        { status: 409 }
      );
    }
    if (oncall && vet.buffer_lock) {
      return NextResponse.json(
        { error: "30 dakika içinde klinikte randevunuz var — tampon koruması aktif", layer: 3 },
        { status: 409 }
      );
    }

    // Use service client — bypasses RLS WITH CHECK on Layer 2 columns.
    // Auth + business-logic validation already done above via user client.
    const service = createServiceClient();
    const { error } = await service
      .from("veterinarians")
      .update({ is_on_call: oncall })
      .eq("id", vet.id);

    if (error) throw error;

    // ── Neural Sync: broadcast to all connected owner-side subscribers ─────────
    void broadcastVetStatus(vet.id, { is_on_call: oncall });

    const dur = Math.round(performance.now() - t0);
    return NextResponse.json({
      success: true,
      is_on_call: oncall,
      message: oncall
        ? "Nöbet moduna geçtiniz — acil hasta talepleri alabilirsiniz. 🚨"
        : "Nöbet modu kapatıldı — acil talepler durduruldu.",
    }, {
      headers: { "Server-Timing": `db;dur=${dur};desc="toggle-oncall"` },
    });
  } catch (err) {
    console.error("[toggle-oncall]", err);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
