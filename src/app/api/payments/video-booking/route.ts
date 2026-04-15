import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { sendAppointmentConfirmationEmail } from "@/lib/email";

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { appointmentId, cardHolderName, cardNumber, expireMonth, expireYear, cvc } = await req.json();

    if (!appointmentId || !cardNumber)
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });

    // Load appointment + vet fee
    const { data: apt } = await supabase
      .from("appointments")
      .select(`
        id, datetime, type, payment_status, payment_amount,
        vet:veterinarians(id, video_consultation_fee, user:users(full_name)),
        owner:users!appointments_owner_id_fkey(full_name, email, phone)
      `)
      .eq("id", appointmentId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    if (apt.type !== "video") return NextResponse.json({ error: "Sadece video randevular için ödeme gereklidir" }, { status: 400 });

    // ── Idempotency check ────────────────────────────────────────────────────
    // If a successful payment already exists for this appointment (e.g., the
    // client retried after a network timeout), return 200 immediately.
    // This prevents iyzico from charging twice for the same appointment.
    if (apt.payment_status === "held" || apt.payment_status === "completed") {
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("iyzico_payment_id, amount")
        .eq("appointment_id", appointmentId)
        .eq("status", "success")
        .maybeSingle();
      return NextResponse.json({
        success: true,
        paymentId: existingPayment?.iyzico_payment_id ?? null,
        amount: existingPayment?.amount ?? 0,
        message: "Bu randevu için ödeme daha önce alınmıştı.",
        idempotent: true,
      });
    }
    // ────────────────────────────────────────────────────────────────────────

    type VetType = { id: string; video_consultation_fee: number; user: { full_name: string } | { full_name: string }[] | null };
    type OwnerType = { full_name: string; email: string; phone: string | null };

    const vet = apt.vet as VetType | VetType[] | null;
    const vetData = Array.isArray(vet) ? vet[0] : vet;
    const ownerData = (Array.isArray(apt.owner) ? apt.owner[0] : apt.owner) as OwnerType | null;

    // Use the price locked at booking time (prevents post-booking fee changes from affecting payment).
    // Falls back to current vet fee (legacy appointments created before price-locking was added)
    // and then to the platform default of 300.
    const amount = (apt as { payment_amount?: number | null }).payment_amount
      ?? vetData?.video_consultation_fee
      ?? 300;
    const rand = Math.random().toString(36).slice(2);
    // Stable conversationId = appointment-scoped idempotency key for iyzico
    const conversationId = `video-${appointmentId}`;

    const ownerName = ownerData?.full_name || "Danışan";
    const [firstName, ...rest] = ownerName.split(" ");
    const lastName = rest.join(" ") || "Kullanıcı";

    const paymentBody = {
      locale: "tr",
      conversationId,
      price: amount.toFixed(2),
      paidPrice: amount.toFixed(2),
      currency: "TRY",
      installment: "1",
      paymentChannel: "WEB",
      paymentGroup: "SERVICE",
      paymentCard: { cardHolderName, cardNumber, expireMonth, expireYear, cvc },
      buyer: {
        id: user.id,
        name: firstName,
        surname: lastName,
        email: ownerData?.email || user.email || "",
        identityNumber: "11111111111",
        registrationAddress: "Türkiye",
        city: "İstanbul",
        country: "Turkey",
        phone: ownerData?.phone || "+90",
      },
      shippingAddress: { contactName: ownerName, city: "İstanbul", country: "Turkey", address: "Online" },
      billingAddress: { contactName: ownerName, city: "İstanbul", country: "Turkey", address: "Online" },
      basketItems: [
        {
          id: appointmentId,
          name: "Video Veteriner Görüşmesi",
          category1: "Sağlık",
          itemType: "VIRTUAL",
          price: amount.toFixed(2),
        },
      ],
    };

    const bodyStr = JSON.stringify(paymentBody);
    const authHeader = generateAuthHeader(bodyStr, rand);

    const iyziRes = await fetch(`${IYZICO_BASE_URL}/payment/auth`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "x-iyzi-rnd": rand,
      },
      body: bodyStr,
    });

    const iyziData = await iyziRes.json();

    // Service client for all financial writes — payment records must never
    // be subject to user-level RLS, and appointment status updates bypass
    // the veterinarians WITH CHECK issue that affects related tables.
    const service = createServiceClient();

    // Platform komisyonu: %15 platform, %85 veteriner
    const COMMISSION_RATE = 0.15;
    const commission = Math.round(amount * COMMISSION_RATE * 100) / 100;
    const vetPayout  = Math.round((amount - commission) * 100) / 100;

    // Log payment attempt (regardless of success/failure for audit trail)
    await service.from("payments").insert({
      vet_id: vetData?.id,
      owner_id: user.id,
      appointment_id: appointmentId,
      amount,
      platform_commission: iyziData.status === "success" ? commission : null,
      vet_payout:          iyziData.status === "success" ? vetPayout  : null,
      type: "video_consultation",
      status: iyziData.status === "success" ? "success" : "failed",
      iyzico_payment_id: iyziData.paymentId || null,
      iyzico_transaction_id: conversationId,
      description: "Video görüşme ödemesi",
    });

    if (iyziData.status !== "success") {
      return NextResponse.json(
        { error: iyziData.errorMessage || "Ödeme başarısız — kart bilgilerini kontrol edin." },
        { status: 400 }
      );
    }

    // Mark appointment payment as held (escrow)
    await service
      .from("appointments")
      .update({
        payment_status: "held",
        payment_id: iyziData.paymentId,
        payment_amount: amount,
        status: "confirmed",
      })
      .eq("id", appointmentId);

    // Email onay bildirimi (best-effort, fire-and-forget)
    if (ownerData?.email) {
      const aptDateTime = new Date(apt.datetime);
      const vetUserData = Array.isArray(vetData?.user) ? vetData?.user[0] : vetData?.user;
      sendAppointmentConfirmationEmail({
        to: ownerData.email,
        name: ownerData.full_name || "Kullanıcı",
        vetName: vetUserData?.full_name ? `Dr. ${vetUserData.full_name}` : "Veteriner",
        date: aptDateTime.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
        time: aptDateTime.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        type: "Video Görüşme",
        appointmentId,
      }).catch((err) => console.error("[payments/video-booking] email failed:", err));
    }

    return NextResponse.json({
      success: true,
      paymentId: iyziData.paymentId,
      amount,
      message: "Ödeme alındı, randevunuz onaylandı!",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("video-booking payment error:", msg);
    return NextResponse.json({ error: "Ödeme işlemi başarısız" }, { status: 500 });
  }
}
