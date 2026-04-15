import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SUBSCRIPTION_TIERS } from "@/lib/constants";
import crypto from "crypto";

const IYZICO_BASE_URL = process.env.IYZICO_BASE_URL!;
const IYZICO_API_KEY = process.env.IYZICO_API_KEY!;
const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY!;

function generateIyzicoAuthHeader(
  body: string,
  randomString: string
): string {
  const hashStr = IYZICO_API_KEY + randomString + IYZICO_SECRET_KEY + body;
  const hash = crypto
    .createHash("sha256")
    .update(hashStr)
    .digest("base64");
  return `IYZWS apiKey:${IYZICO_API_KEY}&randomKey:${randomString}&signature:${hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await request.json();
    const { tier, cardToken, cardHolderName, cardNumber, expireMonth, expireYear, cvc } = body;

    if (!tier || !SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS]) {
      return NextResponse.json({ error: "Geçersiz abonelik planı" }, { status: 400 });
    }

    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id, user:users(full_name, email, phone)")
      .eq("user_id", user.id)
      .single();

    if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 404 });

    // Service client for all DB writes — bypasses RLS WITH CHECK on veterinarians,
    // subscriptions and payments tables.
    const service = createServiceClient();

    type VetUser = { full_name: string; email: string; phone: string | null };
    const vetUser = (Array.isArray(vet.user) ? vet.user[0] : vet.user) as VetUser | null;

    const tierData = SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];
    const randomString = Math.random().toString(36).slice(2);
    const conversationId = `vet-${vet.id}-${Date.now()}`;

    const paymentBody = {
      locale: "tr",
      conversationId,
      price: tierData.price.toFixed(2),
      paidPrice: tierData.price.toFixed(2),
      currency: "TRY",
      installment: "1",
      paymentChannel: "WEB",
      paymentGroup: "SUBSCRIPTION",
      paymentCard: {
        cardHolderName,
        cardNumber,
        expireMonth,
        expireYear,
        cvc,
        registerCard: "1",
      },
      buyer: {
        id: vet.id,
        name: vetUser?.full_name?.split(" ")[0] || "Ad",
        surname: vetUser?.full_name?.split(" ").slice(1).join(" ") || "Soyad",
        email: vetUser?.email || "",
        identityNumber: "11111111111",
        registrationAddress: "Türkiye",
        city: "İstanbul",
        country: "Turkey",
        phone: vetUser?.phone || "+90",
      },
      shippingAddress: {
        contactName: vetUser?.full_name || "Veteriner",
        city: "İstanbul",
        country: "Turkey",
        address: "Türkiye",
      },
      billingAddress: {
        contactName: vetUser?.full_name || "Veteriner",
        city: "İstanbul",
        country: "Turkey",
        address: "Türkiye",
      },
      basketItems: [
        {
          id: `subscription-${tier}`,
          name: `Veterineri Bul ${tierData.name} Abonelik`,
          category1: "Abonelik",
          itemType: "VIRTUAL",
          price: tierData.price.toFixed(2),
        },
      ],
    };

    const paymentBodyStr = JSON.stringify(paymentBody);
    const authHeader = generateIyzicoAuthHeader(paymentBodyStr, randomString);

    const { fetchWithTimeout } = await import("@/lib/fetchWithTimeout");
    const iyzicoResponse = await fetchWithTimeout(
      `${IYZICO_BASE_URL}/payment/auth`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "x-iyzi-rnd": randomString,
        },
        body: paymentBodyStr,
      },
      15_000 // 15 second timeout for payment
    );

    const iyzicoData = await iyzicoResponse.json();

    if (iyzicoData.status !== "success") {
      // Log failed payment
      await service.from("payments").insert({
        vet_id: vet.id,
        amount: tierData.price,
        type: "subscription",
        status: "failed",
        iyzico_transaction_id: conversationId,
        description: iyzicoData.errorMessage || "Ödeme başarısız",
      });

      return NextResponse.json(
        { error: iyzicoData.errorMessage || "Ödeme başarısız" },
        { status: 400 }
      );
    }

    const transactionId = iyzicoData.paymentId;
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    // Update vet subscription tier
    await service
      .from("veterinarians")
      .update({ subscription_tier: tier })
      .eq("id", vet.id);

    // Create subscription record
    await service.from("subscriptions").upsert({
      vet_id: vet.id,
      tier,
      status: "active",
      iyzico_subscription_id: transactionId,
      start_date: new Date().toISOString().split("T")[0],
      next_billing_date: nextBillingDate.toISOString().split("T")[0],
    });

    // Log successful payment
    await service.from("payments").insert({
      vet_id: vet.id,
      amount: tierData.price,
      type: "subscription",
      status: "success",
      iyzico_transaction_id: transactionId,
      description: `${tierData.name} plan aboneliği`,
    });

    return NextResponse.json({
      success: true,
      transactionId,
      tier,
      message: `${tierData.name} planına geçtiniz!`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Hata oluştu";
    console.error("Payment error:", msg);
    return NextResponse.json({ error: "Ödeme işlemi başarısız" }, { status: 500 });
  }
}
