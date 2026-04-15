import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { broadcastVetStatus } from "@/lib/vetBroadcast";

/**
 * POST /api/vet/profile
 * Upserts vet profile data (bio, education, fees, services, schedule).
 * File uploads (avatar, diploma) stay on the client — only DB fields here.
 *
 * Uses service_role for the write to bypass RLS WITH CHECK correlated sub-query
 * which fails for user-client writes on the veterinarians table.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await req.json() as {
      bio?: string;
      education?: string;
      specialty?: string;           // JSON string e.g. '["Cerrahi","Genel Pratisyen"]'
      video_consultation_fee?: number;
      nobetci_fee?: number | null;
      offers_in_person?: boolean;
      offers_video?: boolean;
      offers_nobetci?: boolean;
      is_on_call?: boolean;
      city?: string | null;
      working_hours_start?: string;
      working_hours_end?: string;
      working_days?: string[];
      diploma_url?: string;
      needs_re_verification?: boolean;
    };

    // ── Validation ────────────────────────────────────────────────────────────
    const fee = body.video_consultation_fee != null
      ? Math.max(200, Math.floor(body.video_consultation_fee))
      : undefined;

    const nobetciFee = body.nobetci_fee != null
      ? Math.max(200, Math.floor(body.nobetci_fee))
      : null;

    // Build the upsert payload — only include fields that were sent
    const payload: Record<string, unknown> = { user_id: user.id };

    if (body.bio             !== undefined) payload.bio             = body.bio;
    if (body.education       !== undefined) payload.education       = body.education;
    if (body.specialty       !== undefined) payload.specialty       = body.specialty;
    if (fee                  !== undefined) payload.video_consultation_fee = fee;
    if (body.offers_in_person !== undefined) payload.offers_in_person = body.offers_in_person;
    if (body.offers_video    !== undefined) payload.offers_video    = body.offers_video;
    if (body.offers_nobetci  !== undefined) payload.offers_nobetci  = body.offers_nobetci;
    if (body.nobetci_fee     !== undefined) payload.nobetci_fee     = body.offers_nobetci ? nobetciFee : null;
    if (body.is_on_call      !== undefined) payload.is_on_call      = body.is_on_call;
    if (body.city            !== undefined) payload.city            = body.city || null;
    if (body.working_hours_start !== undefined) payload.working_hours_start = body.working_hours_start;
    if (body.working_hours_end   !== undefined) payload.working_hours_end   = body.working_hours_end;
    if (body.working_days    !== undefined) payload.working_days    = body.working_days;
    if (body.diploma_url     !== undefined) payload.diploma_url     = body.diploma_url;
    if (body.needs_re_verification) {
      payload.is_verified      = false;
      payload.rejection_reason = null;
    }

    // ── Service client write (bypasses RLS WITH CHECK) ────────────────────────
    const service = createServiceClient();
    const { error } = await service
      .from("veterinarians")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.error("[api/vet/profile] upsert error:", error);
      return NextResponse.json(
        { error: "Profil kaydedilemedi — lütfen tüm alanları eksiksiz doldurun." },
        { status: 500 }
      );
    }

    // ── Neural Sync: broadcast changed status fields to realtime store ────────
    // Only broadcast if togglable status columns were explicitly updated, so
    // that owner-facing listing pages and vet dashboard reflect changes instantly
    // without requiring a page reload.
    // Fire-and-forget: do NOT await the SELECT + broadcast so the HTTP response
    // returns immediately. The broadcast is best-effort and must never block the
    // profile save endpoint from completing.
    if (
      body.is_on_call !== undefined ||
      body.offers_nobetci !== undefined ||
      body.offers_in_person !== undefined ||
      body.offers_video !== undefined
    ) {
      void (async () => {
        try {
          const { data: vetRow } = await service
            .from("veterinarians")
            .select("id, is_on_call, is_online_now, is_available_today")
            .eq("user_id", user.id)
            .maybeSingle();

          if (vetRow) {
            await broadcastVetStatus(vetRow.id, {
              ...(body.is_on_call       !== undefined && { is_on_call:       body.is_on_call }),
              ...(body.offers_nobetci   !== undefined && { offers_nobetci:   body.offers_nobetci }),
              ...(body.offers_in_person !== undefined && { offers_in_person: body.offers_in_person }),
              ...(body.offers_video     !== undefined && { offers_video:     body.offers_video }),
            });
          }
        } catch (err) {
          console.warn("[api/vet/profile] broadcast failed:", err instanceof Error ? err.message : err);
        }
      })();
    }

    const message = body.needs_re_verification
      ? "Diploma güncellendi. Profiliniz yeniden incelemeye alındı."
      : "Profil güncellendi";

    return NextResponse.json({ success: true, message });
  } catch (err) {
    console.error("[api/vet/profile]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
