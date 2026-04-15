import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { sendAppointmentConfirmationEmail } from "@/lib/email";

const IYZICO_BASE_URL  = process.env.IYZICO_BASE_URL!;
const IYZICO_API_KEY   = process.env.IYZICO_API_KEY!;
const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY!;

function generateAuthHeader(body: string, rand: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(IYZICO_API_KEY + rand + IYZICO_SECRET_KEY + body)
    .digest("base64");
  return `IYZWS apiKey:${IYZICO_API_KEY}&randomKey:${rand}&signature:${hash}`;
}

/**
 * Instant (Acil/Nöbetçi) booking — no time slot needed.
 * Creates appointment + processes payment in one step.
 * Vet must have is_on_call=true.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    // Service client for all DB writes
    const service = createServiceClient();

    const { vetId, petId, complaint, cardHolderName, cardNumber, expireMonth, expireYear, cvc } = await req.json();

    if (!vetId || !petId || !cardNumber)
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });

    // Load vet — must be verified, on_call, offers_nobetci
    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id, is_on_call, offers_nobetci, nobetci_fee, video_consultation_fee, user:users(full_name, email)")
      .eq("id", vetId)
      .eq("is_verified", true)
      .maybeSingle();

    if (!vet)
      return NextResponse.json({ error: "Veteriner bulunamadı" }, { status: 404 });
    if (!vet.is_on_call)
      return NextResponse.json({ error: "Bu veteriner şu an nöbetçi değil" }, { status: 409 });
    if (!vet.offers_nobetci)
      return NextResponse.json({ error: "Bu veteriner nöbetçi hizmet sunmuyor" }, { status: 400 });

    // Load owner info
    const { data: owner } = await supabase
      .from("users")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .maybeSingle();

    if (!owner) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

    const fee = (vet.nobetci_fee ?? vet.video_consultation_fee ?? 300) as number;
    const vetUser = Array.isArray(vet.user) ? vet.user[0] : vet.user as { full_name?: string; email?: string } | null;

    // Create appointment — datetime = now (instant)
    const now = new Date();
    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .insert({
        owner_id:       user.id,
        vet_id:         vet.id,
        pet_id:         petId,
        datetime:       now.toISOString(),
        type:           "video",
        status:         "pending",
        payment_status: "pending",
        payment_amount: fee,
        notes:          complaint || "Acil/Nöbetçi görüşme",
        duration_minutes: 30,
      })
      .select("id")
      .maybeSingle();

    if (aptErr || !apt)
      return NextResponse.json({ error: "Randevu oluşturulamadı" }, { status: 500 });

    // Process iyzico payment
    const rand           = Math.random().toString(36).slice(2);
    const conversationId = `nobetci-${apt.id}-${Date.now()}`;
    const clientIp       = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

    const paymentBody = {
      locale:                "tr",
      conversationId,
      price:                 fee.toFixed(2),
      paidPrice:             fee.toFixed(2),
      currency:              "TRY",
      installment:           "1",
      basketId:              apt.id,
      paymentChannel:        "WEB",
      paymentGroup:          "PRODUCT",
      paymentCard: {
        cardHolderName: cardHolderName || owner.full_name,
        cardNumber:     cardNumber.replace(/\s/g, ""),
        expireMonth,
        expireYear,
        cvc,
        registerCard:   "0",
      },
      buyer: {
        id:                  user.id,
        name:                owner.full_name?.split(" ")[0] || "Ad",
        surname:             owner.full_name?.split(" ").slice(1).join(" ") || "Soyad",
        gsmNumber:           owner.phone || "+905000000000",
        email:               owner.email || "user@example.com",
        identityNumber:      "11111111111",
        registrationAddress: "Türkiye",
        ip:                  clientIp,
        city:                "Istanbul",
        country:             "Turkey",
      },
      shippingAddress: {
        contactName: owner.full_name || "Ad Soyad",
        city:        "Istanbul",
        country:     "Turkey",
        address:     "Türkiye",
      },
      billingAddress: {
        contactName: owner.full_name || "Ad Soyad",
        city:        "Istanbul",
        country:     "Turkey",
        address:     "Türkiye",
      },
      basketItems: [{
        id:        "nobetci-consultation",
        name:      "Acil/Nöbetçi Video Görüşmesi",
        category1: "Veteriner Hizmet",
        itemType:  "VIRTUAL",
        price:     fee.toFixed(2),
      }],
    };

    const bodyStr   = JSON.stringify(paymentBody);
    const authHeader = generateAuthHeader(bodyStr, rand);

    const iyziRes = await fetch(`${IYZICO_BASE_URL}/payment/auth`, {
      method:  "POST",
      headers: {
        Authorization:    authHeader,
        "Content-Type":   "application/json",
        "x-iyzi-rnd":     rand,
        "x-iyzi-client-version": "iyzipay-node-2.0.48",
      },
      body: bodyStr,
    });

    const iyziData = await iyziRes.json();

    if (iyziData.status !== "success") {
      // Clean up the appointment we just created
      await supabase.from("appointments").delete().eq("id", apt.id);
      return NextResponse.json(
        { error: iyziData.errorMessage || "Ödeme başarısız" },
        { status: 402 }
      );
    }

    const paymentId = iyziData.paymentId || iyziData.conversationId;

    // Update appointment: confirmed + payment held
    await service
      .from("appointments")
      .update({
        status:         "confirmed",
        payment_status: "held",
        payment_id:     paymentId,
      })
      .eq("id", apt.id);

    // Log payment
    await service.from("payments").insert({
      vet_id:              vet.id,
      owner_id:            user.id,
      appointment_id:      apt.id,
      amount:              fee,
      type:                "nobetci_consultation",
      status:              "held",
      iyzico_payment_id:   paymentId,
      iyzico_transaction_id: conversationId,
      description:         "Acil/Nöbetçi video görüşmesi — ödeme beklemede",
    });

    // Create video room
    const roomRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/video/create-room`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ appointmentId: apt.id }),
      }
    );
    const roomData = roomRes.ok ? await roomRes.json() : null;

    // Send confirmation email to owner
    if (owner.email) {
      const dt   = new Date();
      sendAppointmentConfirmationEmail({
        to:            owner.email,
        name:          owner.full_name || "Kullanıcı",
        vetName:       `Vet. Hek. ${vetUser?.full_name ?? ""}`,
        date:          dt.toLocaleDateString("tr-TR"),
        time:          dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        appointmentId: apt.id,
        type:          "video",
      }).catch((err) => console.error("[payments/nobetci-booking] email failed:", err));
    }

    return NextResponse.json({
      success:       true,
      appointmentId: apt.id,
      videoRoomUrl:  roomData?.roomUrl || `/video/${apt.id}`,
      message:       "Nöbetçi veteriner bağlantısı hazır!",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("nobetci-booking error:", msg);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
