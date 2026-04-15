import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/appointments/book
 *
 * Creates a new appointment.  Handles all three service flows:
 *
 *  type="clinic"    → appointment_type="clinic",  escrow_status="not_applicable"
 *                     (A booking deposit pre-auth is handled separately by
 *                      /api/payments/clinic-deposit if enabled — prevents no-shows)
 *
 *  type="online"    → appointment_type="online",  escrow_status="pending"
 *                     Funds are held via Iyzico when payment is confirmed.
 *
 *  type="emergency" → appointment_type="emergency", escrow_status="pending"
 *                     Same payment path as online; vet must have is_online_now=true.
 *
 * Body: { vetId, petId, datetime, type, complaint?, iyzico_transaction_id? }
 */

type BookType = "clinic" | "online" | "emergency";
type EscrowStatus = "pending" | "held" | "released" | "refunded" | "not_applicable";

const TYPE_TO_APPOINTMENT_TYPE: Record<BookType, string> = {
  clinic:    "clinic",
  online:    "online",
  emergency: "emergency",
};

/** Extract caller IP from standard proxy headers */
function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase        = await createClient();
    const serviceSupabase = createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Giriş yapmanız gerekmektedir" }, { status: 401 });

    let body: {
      vetId:                  string;
      petId:                  string;
      datetime:               string;
      type:                   BookType;
      complaint?:             string;
      iyzico_transaction_id?: string;
    };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Geçersiz istek verisi" }, { status: 400 }); }

    const { vetId, petId, type, complaint, iyzico_transaction_id } = body;
    let { datetime } = body;

    if (!vetId || !petId || !datetime || !type)
      return NextResponse.json({ error: "vetId, petId, datetime ve type zorunludur" }, { status: 400 });

    // ── Timezone normalization ────────────────────────────────────────────────
    // If the client sends a naive datetime (no timezone offset), treat it as
    // Istanbul time (UTC+3). This prevents Vercel's UTC server from misreading
    // "09:00" as "09:00 UTC" instead of "09:00 IST = 06:00 UTC".
    if (!/[Z]$|[+-]\d{2}:\d{2}$/.test(datetime)) {
      datetime = `${datetime}+03:00`;
    }

    if (!["clinic", "online", "emergency"].includes(type))
      return NextResponse.json({ error: "type: 'clinic' | 'online' | 'emergency'" }, { status: 400 });

    // ── Load vet ──────────────────────────────────────────────────────────────
    const { data: vet } = await serviceSupabase
      .from("veterinarians")
      .select(`
        id, is_verified, is_online_now,
        offers_video, offers_in_person, offers_nobetci,
        video_consultation_fee, consultation_fee, nobetci_fee,
        auto_approve_appointments, commission_rate_pct
      `)
      .eq("id", vetId)
      .eq("is_verified", true)
      .maybeSingle();

    if (!vet) return NextResponse.json({ error: "Veteriner bulunamadı" }, { status: 404 });

    // ── Service-type checks ───────────────────────────────────────────────────
    if (type === "online" && !vet.offers_video)
      return NextResponse.json({ error: "Bu veteriner online görüşme sunmuyor" }, { status: 400 });

    if (type === "clinic" && !vet.offers_in_person)
      return NextResponse.json({ error: "Bu veteriner klinik muayene sunmuyor" }, { status: 400 });

    if (type === "emergency") {
      if (!vet.offers_nobetci && !vet.offers_video)
        return NextResponse.json({ error: "Bu veteriner acil/nöbetçi hizmet sunmuyor" }, { status: 400 });
      if (!vet.is_online_now)
        return NextResponse.json({ error: "Bu veteriner şu an online değil" }, { status: 409 });
    }

    // ── Double-booking guard ──────────────────────────────────────────────────
    const { data: existing } = await serviceSupabase
      .from("appointments").select("id")
      .eq("vet_id", vetId).eq("datetime", datetime)
      .in("status", ["pending", "confirmed"]).maybeSingle();

    if (existing)
      return NextResponse.json({ error: "Bu saat dolu, başka bir zaman seçin" }, { status: 409 });

    // ── Verify pet ownership ──────────────────────────────────────────────────
    const { data: pet } = await serviceSupabase
      .from("pets").select("id, owner_id").eq("id", petId).maybeSingle();

    if (!pet) return NextResponse.json({ error: "Evcil hayvan bulunamadı" }, { status: 404 });
    if (pet.owner_id !== user.id)
      return NextResponse.json({ error: "Bu evcil hayvan size ait değil" }, { status: 403 });

    // ── Fee & escrow logic ────────────────────────────────────────────────────
    const feeMap: Record<BookType, number> = {
      clinic:    vet.consultation_fee       ?? 0,
      online:    vet.video_consultation_fee ?? 0,
      emergency: vet.nobetci_fee ?? vet.video_consultation_fee ?? 0,
    };
    const paymentAmount = feeMap[type];

    const escrowStatus: EscrowStatus =
      type === "clinic"    ? "not_applicable" :
      type === "online"    ? "pending"        :
      /* emergency */        "pending";

    // If an Iyzico transaction ID was passed (payment already confirmed upfront)
    // mark escrow as held immediately.
    const finalEscrowStatus: EscrowStatus =
      iyzico_transaction_id && type !== "clinic" ? "held" : escrowStatus;

    const status = vet.auto_approve_appointments ? "confirmed" : "pending";

    // ── Insert appointment ────────────────────────────────────────────────────
    const { data: newApt, error: insertErr } = await serviceSupabase
      .from("appointments")
      .insert({
        vet_id:                  vetId,
        owner_id:                user.id,
        pet_id:                  petId,
        datetime,
        type:                    type === "clinic" ? "in_person" : "video", // legacy column
        appointment_type:        TYPE_TO_APPOINTMENT_TYPE[type],
        status,
        payment_status:          iyzico_transaction_id ? "held" : "pending",
        payment_amount:          paymentAmount,
        escrow_status:           finalEscrowStatus,
        iyzico_transaction_id:   iyzico_transaction_id ?? null,
        complaint:               complaint ?? null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("appointment insert error:", insertErr);

      // 23505 = unique_violation: partial unique index (vet_id, datetime) WHERE
      // status IN ('pending','confirmed') rejected a concurrent insert.
      // This is the DB-level race condition guard — two users clicked the same
      // slot at the same millisecond; the second request reaches here.
      if (insertErr.code === "23505") {
        return NextResponse.json(
          { error: "Bu saat az önce başka biri tarafından alındı. Lütfen farklı bir saat seçin." },
          { status: 409 }
        );
      }

      // P0001 = DB trigger raised: vet not yet verified
      if (
        insertErr.code === "P0001" ||
        insertErr.message?.toLowerCase().includes("unverified") ||
        insertErr.message?.toLowerCase().includes("onaylanmamış")
      ) {
        return NextResponse.json(
          { error: "Bu hekim henüz onay sürecindedir. Lütfen daha sonra tekrar deneyin." },
          { status: 422 }
        );
      }

      return NextResponse.json({ error: "Randevu oluşturulamadı" }, { status: 500 });
    }

    // ── Buffer-lock recomputation (fire-and-forget) ───────────────────────────
    // After any new clinic/online appointment, recompute whether the vet has an
    // appointment in the ±30-minute window. If so, force buffer_lock=true so the
    // vet is hidden from the "Online Now" and "On-Call" real-time listings.
    void (async () => {
      try {
        const now         = new Date();
        const windowStart = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
        const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

        const { count } = await serviceSupabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("vet_id", vetId)
          .in("status", ["pending", "confirmed"])
          .gte("datetime", windowStart)
          .lte("datetime", windowEnd);

        if (count && count > 0) {
          await serviceSupabase
            .from("veterinarians")
            .update({ buffer_lock: true })
            .eq("id", vetId);
        }
      } catch (e) {
        console.warn("[book] buffer_lock recompute failed (non-fatal):", e);
      }
    })();

    // ── Vet notification (fire-and-forget) ───────────────────────────────────
    // Calls /api/appointments/notify-vet which sends an email to the vet.
    // Must run AFTER the response is sent so it never delays the owner's UX.
    void fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/appointments/notify-vet`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ appointmentId: newApt.id }),
    }).catch((notifyErr) => {
      console.warn("[book] notify-vet failed (non-fatal):", notifyErr instanceof Error ? notifyErr.message : notifyErr);
    });

    // ── Legal consent log (IP + timestamp for dispute resolution) ─────────────
    // Fire-and-forget — a logging failure must never block the booking response.
    serviceSupabase.from("legal_consent_logs").insert({
      user_id:        user.id,
      appointment_id: newApt.id,
      event_type:     "appointment_booking",
      ip_address:     getClientIP(req),
      user_agent:     req.headers.get("user-agent") ?? "",
      extra_data: {
        appointment_type: TYPE_TO_APPOINTMENT_TYPE[type],
        vet_id:           vetId,
        pet_id:           petId,
        datetime,
        payment_amount:   paymentAmount,
        escrow_status:    finalEscrowStatus,
      },
    }).then(({ error: logErr }) => {
      if (logErr) console.warn("legal_consent_log insert failed (non-fatal):", logErr.message);
    });

    return NextResponse.json({
      appointment:   newApt,
      auto_approved: vet.auto_approve_appointments,
      escrow_status: finalEscrowStatus,
      fee:           paymentAmount,
    });
  } catch (err) {
    console.error("book error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
