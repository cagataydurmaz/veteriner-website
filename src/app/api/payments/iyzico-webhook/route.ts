import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * POST /api/payments/iyzico-webhook
 *
 * Iyzico ödeme gateway'inden gelen durum bildirimleri (callback/webhook).
 *
 * Iyzico, ödeme başarı veya başarısızlık durumlarında bu endpoint'e POST atar.
 * Imza doğrulama: iyzico belgeleri (https://dev.iyzipay.com/tr/webhook)
 *
 * Önemli: vercel.json CSRF middleware'inden muaf tutulmalı.
 * (Zaten /api/iyzico/webhook ve /api/auth/callback muaf — bu endpoint de muaf)
 *
 * Kurulum: Iyzico Dashboard → Webhooks → https://veterineribul.com/api/payments/iyzico-webhook
 */

const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY ?? "";

/**
 * Iyzico webhook imzasını doğrula.
 * Belgeleme: https://dev.iyzipay.com/tr/webhook#dogrulama
 */
function verifyWebhookSignature(body: string, receivedSignature: string): boolean {
  if (!IYZICO_SECRET_KEY) return false;
  const computed = crypto
    .createHmac("sha1", IYZICO_SECRET_KEY)
    .update(body)
    .digest("base64");
  return computed === receivedSignature;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // İmza doğrulama (güvenlik: sahte webhook'ları reddet)
    const signature = req.headers.get("x-iyzi-signature") ?? "";
    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      console.warn("[iyzico-webhook] imza geçersiz — istek reddedildi");
      return NextResponse.json({ error: "Geçersiz imza" }, { status: 401 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
    }

    const status          = payload.status as string | undefined;
    const paymentId       = payload.paymentId as string | undefined;
    const conversationId  = payload.conversationId as string | undefined; // "video-{appointmentId}"
    const errorCode       = payload.errorCode as string | undefined;
    const errorMessage    = payload.errorMessage as string | undefined;

    console.log(`[iyzico-webhook] status=${status} paymentId=${paymentId} conversationId=${conversationId}`);

    if (!conversationId) {
      return NextResponse.json({ received: true, skipped: "no conversationId" });
    }

    const service = createServiceClient();

    // conversationId formatı: "video-{appointmentId}" veya "refund-{appointmentId}-{timestamp}"
    const videoMatch  = conversationId.match(/^video-([0-9a-f-]{36})$/);
    const refundMatch = conversationId.match(/^refund-([0-9a-f-]{36})-\d+$/);

    // ── Ödeme başarısız bildirimi ─────────────────────────────────────────────
    if (status === "failure" && videoMatch) {
      const appointmentId = videoMatch[1];

      // Randevuyu pending'e geri al + payment_status failed
      await service
        .from("appointments")
        .update({ payment_status: "failed", status: "pending" })
        .eq("id", appointmentId)
        .in("payment_status", ["pending", "processing"]);  // Yalnızca henüz tamamlanmamışsa

      // Payments tablosuna hata logu
      await service.from("payments").insert({
        appointment_id: appointmentId,
        amount: 0,
        type: "video_consultation",
        status: "failed",
        iyzico_payment_id: paymentId ?? null,
        iyzico_transaction_id: conversationId,
        description: `Webhook hatası: ${errorCode ?? "bilinmiyor"} — ${errorMessage ?? ""}`,
      });

      console.log(`[iyzico-webhook] ❌ Ödeme başarısız: appointment=${appointmentId}`);
      return NextResponse.json({ received: true, action: "payment_failed_logged" });
    }

    // ── İade tamamlandı bildirimi ─────────────────────────────────────────────
    if (status === "success" && refundMatch) {
      const appointmentId = refundMatch[1];

      // Zaten refunded_full ise tekrar işleme — idempotent
      const { data: apt } = await service
        .from("appointments")
        .select("payment_status")
        .eq("id", appointmentId)
        .maybeSingle();

      if (apt?.payment_status === "refunded_full") {
        return NextResponse.json({ received: true, skipped: "already_refunded" });
      }

      await service
        .from("appointments")
        .update({ payment_status: "refunded_full", status: "cancelled" })
        .eq("id", appointmentId);

      console.log(`[iyzico-webhook] ✅ İade tamamlandı: appointment=${appointmentId}`);
      return NextResponse.json({ received: true, action: "refund_confirmed" });
    }

    // ── Ödeme başarılı bildirimi (yedek — asıl onay video-booking route'unda) ─
    if (status === "success" && videoMatch) {
      const appointmentId = videoMatch[1];

      const { data: apt } = await service
        .from("appointments")
        .select("payment_status")
        .eq("id", appointmentId)
        .maybeSingle();

      // Zaten "held" veya "completed" ise idempotent geç
      if (apt?.payment_status === "held" || apt?.payment_status === "completed") {
        return NextResponse.json({ received: true, skipped: "already_confirmed" });
      }

      // Gecikmeli webhook onayı: randevuyu confirmed yap
      await service
        .from("appointments")
        .update({ payment_status: "held", status: "confirmed", payment_id: paymentId })
        .eq("id", appointmentId)
        .eq("payment_status", "pending");

      console.log(`[iyzico-webhook] ✅ Gecikmiş ödeme onayı: appointment=${appointmentId}`);
      return NextResponse.json({ received: true, action: "late_payment_confirmed" });
    }

    // Tanınmayan payload — logla, 200 dön (iyzico tekrar denemesini önle)
    console.log(`[iyzico-webhook] Tanınmayan payload:`, JSON.stringify(payload).slice(0, 200));
    return NextResponse.json({ received: true, skipped: "unrecognized_payload" });

  } catch (err) {
    console.error("[iyzico-webhook] hata:", err instanceof Error ? err.message : err);
    // 500 dönme — iyzico tekrar denemeye girer ve spam yapar
    return NextResponse.json({ received: true, error: "internal" }, { status: 200 });
  }
}
