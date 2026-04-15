import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

const IYZICO_BASE_URL = process.env.IYZICO_BASE_URL!;
const IYZICO_API_KEY = process.env.IYZICO_API_KEY!;
const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY!;

function generateAuthHeader(body: string, rand: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(IYZICO_API_KEY + rand + IYZICO_SECRET_KEY + body)
    .digest("base64");
  return `IYZWS apiKey:${IYZICO_API_KEY}&randomKey:${rand}&signature:${hash}`;
}

// refundType: "vet_cancel" | "owner_early" (24h+) | "owner_late" (<24h)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    // Service client for all DB writes — payment/appointment records must
    // never be blocked by RLS policies.
    const service = createServiceClient();

    const { appointmentId, refundType } = await req.json();
    if (!appointmentId || !refundType)
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });

    // Load appointment
    const { data: apt } = await supabase
      .from("appointments")
      .select("id, datetime, payment_status, payment_id, payment_amount, owner_id, vet:veterinarians(user_id)")
      .eq("id", appointmentId)
      .maybeSingle();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    if (apt.payment_status !== "held")
      return NextResponse.json({ error: "İade edilecek ödeme bulunamadı" }, { status: 400 });

    // Authorization: owner can cancel, vet can cancel
    type VetType = { user_id: string };
    const vetData = (Array.isArray(apt.vet) ? apt.vet[0] : apt.vet) as VetType | null;
    const isOwner = apt.owner_id === user.id;
    const isVet = vetData?.user_id === user.id;
    if (!isOwner && !isVet)
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

    const totalAmount = apt.payment_amount as number;
    const aptTime = new Date(apt.datetime);
    const hoursUntil = (aptTime.getTime() - Date.now()) / 3_600_000;

    // Determine refund amount
    let refundAmount: number;
    let newPaymentStatus: string;
    let refundDescription: string;

    // All cancellations → full refund (health platform policy)
    refundAmount = totalAmount;
    newPaymentStatus = "refunded_full";
    if (refundType === "vet_cancel") {
      refundDescription = "Veteriner iptali - tam iade";
    } else {
      refundDescription = "Müşteri iptali - tam iade";
    }
    void hoursUntil; // timing no longer affects refund amount

    // Call iyzico refund API
    const rand = Math.random().toString(36).slice(2);
    const conversationId = `refund-${appointmentId}-${Date.now()}`;

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "127.0.0.1";

    const refundBody = {
      locale: "tr",
      conversationId,
      paymentTransactionId: apt.payment_id,
      price: refundAmount.toFixed(2),
      currency: "TRY",
      ip: clientIp,
    };

    const bodyStr = JSON.stringify(refundBody);
    const authHeader = generateAuthHeader(bodyStr, rand);

    const iyziRes = await fetch(`${IYZICO_BASE_URL}/payment/refund`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "x-iyzi-rnd": rand,
      },
      body: bodyStr,
    });

    const iyziData = await iyziRes.json();

    if (iyziData.status !== "success") {
      console.error("Iyzico refund failed:", iyziData.errorMessage);

      // Mark appointment as cancelled but flag payment as refund_failed — money was NOT returned
      await service
        .from("appointments")
        .update({
          status: "cancelled",
          payment_status: "refund_failed",
        })
        .eq("id", appointmentId);

      // Log failed refund attempt in payments
      await service.from("payments").insert({
        owner_id: apt.owner_id,
        appointment_id: appointmentId,
        amount: refundAmount,
        type: "video_consultation",
        status: "failed",
        iyzico_payment_id: apt.payment_id,
        iyzico_transaction_id: conversationId,
        description: refundDescription,
      });

      return NextResponse.json(
        { error: "İade işlemi başarısız. Lütfen destek ile iletişime geçin.", refundFailed: true },
        { status: 502 }
      );
    }

    // Iyzico refund succeeded — update appointment with correct refund status
    await service
      .from("appointments")
      .update({
        status: "cancelled",
        payment_status: newPaymentStatus,
      })
      .eq("id", appointmentId);

    // Log successful refund in payments
    await service.from("payments").insert({
      owner_id: apt.owner_id,
      appointment_id: appointmentId,
      amount: refundAmount,
      type: "video_consultation",
      status: newPaymentStatus,
      iyzico_payment_id: iyziData.paymentId || apt.payment_id,
      iyzico_transaction_id: conversationId,
      description: refundDescription,
    });

    return NextResponse.json({
      success: true,
      refundAmount,
      isPartial: false,
      message: `Tam iade yapıldı (₺${refundAmount}).`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("video-refund error:", msg);
    return NextResponse.json({ error: "İade işlemi başarısız" }, { status: 500 });
  }
}
