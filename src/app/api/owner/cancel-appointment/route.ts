import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { sendAppointmentCancelledEmail } from "@/lib/email";

/**
 * POST /api/owner/cancel-appointment
 *
 * Owner-initiated appointment cancellation with 6502 Law refund policy:
 *
 *   >24 hours before appointment  →  100% refund
 *   2h – 24h before appointment  →    0% refund (vet protected — lost time)
 *   <2  hours before appointment  →    0% refund (absolute non-cancellation zone)
 *
 * For clinic appointments (escrow_status = "not_applicable") no financial
 * operation is performed — only status is updated.
 *
 * Body: { appointmentId: string, reason?: string }
 */

const IYZICO_BASE_URL   = process.env.IYZICO_BASE_URL!;
const IYZICO_API_KEY    = process.env.IYZICO_API_KEY!;
const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY!;

function iyzicoAuthHeader(body: string, rand: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(IYZICO_API_KEY + rand + IYZICO_SECRET_KEY + body)
    .digest("base64");
  return `IYZWS apiKey:${IYZICO_API_KEY}&randomKey:${rand}&signature:${hash}`;
}

/** Hours until a future datetime (negative = already past) */
function hoursUntil(dt: string): number {
  return (new Date(dt).getTime() - Date.now()) / (1000 * 60 * 60);
}

export async function POST(req: NextRequest) {
  try {
    const supabase        = await createClient();
    const serviceSupabase = createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });

    let body: { appointmentId: string; reason?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }

    const { appointmentId, reason } = body;
    if (!appointmentId)
      return NextResponse.json({ error: "appointmentId zorunludur" }, { status: 400 });

    // ── Load appointment ─────────────────────────────────────────────────────
    const { data: apt } = await serviceSupabase
      .from("appointments")
      .select(`
        id, datetime, status, type, appointment_type,
        payment_status, payment_id, payment_amount,
        escrow_status, owner_id, vet_id,
        vet:veterinarians!vet_id(id, user_id, user:users(full_name, email))
      `)
      .eq("id", appointmentId)
      .eq("owner_id", user.id)   // owner can only cancel their own appointments
      .maybeSingle();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    if (apt.status === "cancelled")
      return NextResponse.json({ error: "Randevu zaten iptal edilmiş" }, { status: 400 });
    if (apt.status === "completed")
      return NextResponse.json({ error: "Tamamlanmış randevu iptal edilemez" }, { status: 400 });
    if (!["pending", "confirmed"].includes(apt.status))
      return NextResponse.json({ error: "Bu randevu iptal edilemez" }, { status: 400 });

    // ── 6502 Law: determine refund eligibility ────────────────────────────────
    const hrs = hoursUntil(apt.datetime as string);
    const isPaymentHeld = (apt.escrow_status === "held" || apt.payment_status === "held") && apt.payment_id;
    const isRemoteAppointment = apt.appointment_type === "online" || apt.appointment_type === "emergency"
      || apt.type === "video";

    // Determine refund rate
    let refundRate = 0;        // default: no refund
    let refundPolicy = "";

    if (hrs > 24) {
      refundRate = 1.0;        // 100% — >24h cancellation window
      refundPolicy = ">24 saat öncesi iptal — tam iade";
    } else {
      refundRate = 0;          // 0% — <24h window (2h-24h range and <2h)
      refundPolicy = hrs < 2
        ? "<2 saat öncesi iptal — iade yapılmaz"
        : "<24 saat öncesi iptal — iade yapılmaz";
    }

    const refundAmount = Math.round((apt.payment_amount ?? 0) * refundRate * 100) / 100;

    // ── Mark appointment cancelled ────────────────────────────────────────────
    await serviceSupabase
      .from("appointments")
      .update({
        status:             "cancelled",
        cancelled_by:       "owner",
        cancelled_at:       new Date().toISOString(),
        cancellation_reason: reason ?? "Pet sahibi tarafından iptal edildi",
        refund_status:      isRemoteAppointment && isPaymentHeld
          ? (refundRate > 0 ? "pending" : "none")
          : "none",
        refund_amount:      refundAmount,
      })
      .eq("id", appointmentId);

    // ── Log legal consent event ───────────────────────────────────────────────
    serviceSupabase.from("legal_consent_logs").insert({
      user_id:        user.id,
      appointment_id: appointmentId,
      event_type:     "cancellation",
      ip_address:     req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      user_agent:     req.headers.get("user-agent") ?? "",
      extra_data: {
        hours_until:   hrs,
        refund_rate:   refundRate,
        refund_amount: refundAmount,
        refund_policy: refundPolicy,
      },
    }).then(({ error: logErr }) => {
      if (logErr) console.warn("legal_consent_log (cancellation) failed:", logErr.message);
    });

    // ── Process Iyzico refund if applicable ───────────────────────────────────
    let refunded = false;

    if (isRemoteAppointment && isPaymentHeld && refundAmount > 0) {
      try {
        const rand = Math.random().toString(36).slice(2);
        const conversationId = `owner-cancel-${appointmentId}-${Date.now()}`;

        const refundBody = JSON.stringify({
          locale:         "tr",
          conversationId,
          paymentId:      apt.payment_id,
          price:          refundAmount.toFixed(2),
          currency:       "TRY",
          ip:             req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1",
        });

        const iyziRes = await fetch(`${IYZICO_BASE_URL}/payment/refund`, {
          method: "POST",
          headers: {
            Authorization: iyzicoAuthHeader(refundBody, rand),
            "Content-Type": "application/json",
            "x-iyzi-rnd":   rand,
          },
          body: refundBody,
        });

        const iyziData = await iyziRes.json();

        if (iyziData.status === "success") {
          await serviceSupabase
            .from("appointments")
            .update({ payment_status: "refunded", escrow_status: "refunded", refund_status: "full" })
            .eq("id", appointmentId);

          await serviceSupabase.from("payments").insert({
            vet_id:                apt.vet_id,
            owner_id:              user.id,
            appointment_id:        appointmentId,
            amount:                -refundAmount,
            type:                  "refund",
            status:                "refunded",
            iyzico_payment_id:     apt.payment_id,
            iyzico_transaction_id: conversationId,
            description:           `Pet sahibi iptali — ${refundPolicy}`,
          });

          refunded = true;
        } else {
          // Iyzico refused — mark as failed but don't block the cancellation
          await serviceSupabase
            .from("appointments")
            .update({ refund_status: "failed" })
            .eq("id", appointmentId);

          console.error("Iyzico owner refund failed:", iyziData.errorMessage);
        }
      } catch (refundErr) {
        console.error("owner cancel — refund exception:", refundErr instanceof Error ? refundErr.message : refundErr);
        await serviceSupabase
          .from("appointments")
          .update({ refund_status: "failed" })
          .eq("id", appointmentId);
      }
    } else if (isRemoteAppointment && isPaymentHeld && refundAmount === 0) {
      // No refund due — escrow stays held; released to vet as compensation
      await serviceSupabase
        .from("appointments")
        .update({ escrow_status: "released", payment_status: "completed" })
        .eq("id", appointmentId);

      await serviceSupabase.from("payments").insert({
        vet_id:         apt.vet_id,
        owner_id:       user.id,
        appointment_id: appointmentId,
        amount:         apt.payment_amount ?? 0,
        type:           "cancellation_compensation",
        status:         "released",
        description:    `Pet sahibi iptali — ${refundPolicy} — ücret veterinere aktarıldı`,
        vet_payout:     apt.payment_amount ?? 0,
        platform_commission: 0,
      });
    }

    // ── Email notification to vet ─────────────────────────────────────────────
    const vetRow = (Array.isArray(apt.vet) ? apt.vet[0] : apt.vet) as {
      user: { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null
    } | null;
    const vetUserData = Array.isArray(vetRow?.user) ? vetRow?.user[0] : vetRow?.user;

    if (vetUserData?.email) {
      const aptDt = new Date(apt.datetime as string);
      sendAppointmentCancelledEmail({
        to:     vetUserData.email,
        name:   vetUserData.full_name ?? "Veteriner",
        vetName: "",
        date:   aptDt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
        time:   aptDt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        reason: `Pet sahibi tarafından iptal edildi. ${refundPolicy}.`,
      }).catch((err) => console.error("[owner/cancel-appointment] email failed:", err));
    }

    // ── Build response message ────────────────────────────────────────────────
    let message: string;
    if (!isRemoteAppointment) {
      message = "Klinik randevunuz iptal edildi.";
    } else if (refunded) {
      message = `Randevunuz iptal edildi. ₺${refundAmount.toFixed(2)} iadeniz 3–14 iş günü içinde kartınıza yansıyacak.`;
    } else if (refundAmount === 0 && isPaymentHeld) {
      message = `Randevunuz iptal edildi. ${refundPolicy} — ücret iade edilmeyecektir.`;
    } else {
      message = "Randevunuz iptal edildi.";
    }

    // ── Buffer-lock recomputation (fire-and-forget) ───────────────────────────
    // After cancellation the slot is freed. Recompute buffer_lock immediately
    // so the vet doesn't have to wait up to 5 min for the cron to clear it.
    void (async () => {
      try {
        const now         = new Date();
        const windowStart = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
        const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
        const { count } = await serviceSupabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("vet_id", apt.vet_id)
          .in("status", ["pending", "confirmed"])
          .gte("datetime", windowStart)
          .lte("datetime", windowEnd);
        await serviceSupabase
          .from("veterinarians")
          .update({ buffer_lock: (count ?? 0) > 0 })
          .eq("id", apt.vet_id);
      } catch (e) {
        console.warn("[owner/cancel-appointment] buffer_lock recompute failed (non-fatal):", e);
      }
    })();

    return NextResponse.json({
      success:       true,
      refunded,
      refund_amount: refundAmount,
      refund_policy: refundPolicy,
      hours_until:   Math.round(hrs * 10) / 10,
      message,
    });

  } catch (err) {
    console.error("owner/cancel-appointment error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "İptal işlemi başarısız" }, { status: 500 });
  }
}
