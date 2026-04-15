import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { sendAppointmentConfirmationEmail } from "@/lib/email";

const IYZICO_BASE_URL   = process.env.IYZICO_BASE_URL!;
const IYZICO_API_KEY    = process.env.IYZICO_API_KEY!;
const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY!;

function generateAuthHeader(body: string, rand: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(IYZICO_API_KEY + rand + IYZICO_SECRET_KEY + body)
    .digest("base64");
  return `IYZWS apiKey:${IYZICO_API_KEY}&randomKey:${rand}&signature:${hash}`;
}

/**
 * POST /api/nobetci/respond
 *
 * Step 2 of the instant booking flow — called by the VET.
 * Body: { requestId: string, action: "accept" | "decline" }
 *
 * accept:
 *   - Captures the iyzico pre-authorization (charges the owner)
 *   - Creates a confirmed appointment with type=video
 *   - Generates Agora channel / video room URL
 *   - Marks vet is_busy=true
 *   - Updates instant_request: status=accepted, video_room_url, appointment_id
 *   - Sends confirmation email to owner
 *
 * decline:
 *   - Cancels the iyzico pre-authorization (full refund, never charged)
 *   - Updates instant_request: status=declined
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { requestId, action } = await req.json();
    if (!requestId || !["accept", "decline"].includes(action))
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });

    // Caller must be a vet — also fetch their display name for emails
    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id, nobetci_fee, video_consultation_fee, user:users(full_name)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });

    // Load the instant_request — must belong to this vet and still be pending
    const service = createServiceClient();
    const { data: request } = await service
      .from("instant_requests")
      .select(`
        id, status, expires_at, payment_preauth_id, fee,
        vet_id, owner_id, pet_id, complaint,
        owner:users!owner_id(full_name, email, phone)
      `)
      .eq("id", requestId)
      .eq("vet_id", vet.id)
      .maybeSingle();

    if (!request)
      return NextResponse.json({ error: "İstek bulunamadı" }, { status: 404 });
    if (request.status !== "pending")
      return NextResponse.json({ error: "Bu istek artık beklemede değil" }, { status: 409 });
    if (new Date(request.expires_at as string) < new Date())
      return NextResponse.json({ error: "Bu isteğin süresi doldu" }, { status: 410 });

    // ── DECLINE ──────────────────────────────────────────────────────────────
    if (action === "decline") {
      await service
        .from("instant_requests")
        .update({ status: "declined" })
        .eq("id", requestId);

      // Cancel pre-auth (full refund — owner was never charged)
      if (request.payment_preauth_id) {
        await cancelPreAuth(request.payment_preauth_id as string, `cancel-${requestId}`);
      }

      return NextResponse.json({ success: true, action: "declined" });
    }

    // ── ACCEPT ───────────────────────────────────────────────────────────────

    // Atomically mark request as accepted to prevent double-processing
    const { data: claimed } = await service
      .from("instant_requests")
      .update({ status: "accepted" })
      .eq("id", requestId)
      .eq("status", "pending")           // guard
      .select("id")
      .maybeSingle();

    if (!claimed)
      return NextResponse.json({ error: "Bu istek zaten işlendi" }, { status: 409 });

    const fee = (request.fee ?? vet.nobetci_fee ?? vet.video_consultation_fee ?? 300) as number;

    // Capture pre-authorization (actual charge)
    let paymentId = request.payment_preauth_id as string;
    if (paymentId) {
      const rand           = Math.random().toString(36).slice(2);
      const conversationId = `postcauth-${requestId}-${Date.now()}`;
      const postcauthBody  = JSON.stringify({
        locale:         "tr",
        conversationId,
        paymentId,
      });
      const authHeader = generateAuthHeader(postcauthBody, rand);

      const captureRes  = await fetch(`${IYZICO_BASE_URL}/payment/postcauth`, {
        method:  "POST",
        headers: {
          Authorization:           authHeader,
          "Content-Type":          "application/json",
          "x-iyzi-rnd":            rand,
          "x-iyzi-client-version": "iyzipay-node-2.0.48",
        },
        body: postcauthBody,
      });
      const captureData = await captureRes.json();

      if (captureData.status !== "success") {
        // Roll back the status to pending so cron can clean up
        await service.from("instant_requests").update({ status: "pending" }).eq("id", requestId);
        return NextResponse.json(
          { error: captureData.errorMessage || "Ödeme çekilemedi" },
          { status: 402 }
        );
      }

      paymentId = captureData.paymentId || paymentId;
    }

    // Generate Agora channel + video room URL before the atomic DB write
    const now          = new Date();
    const channelName  = randomUUID();
    const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com";
    // video_room_url will be updated with real appointmentId after the RPC returns it
    const tempRoomUrl  = `${appUrl}/video/${channelName}`;

    // ── Atomic DB write via PostgreSQL RPC ────────────────────────────────────
    // accept_nobetci_request wraps all 4 operations in a single transaction:
    //   INSERT appointments, INSERT payments, UPDATE veterinarians, UPDATE instant_requests
    // If any step fails the entire transaction rolls back — no orphaned payments.
    const { data: rpcResult, error: rpcErr } = await service
      .rpc("accept_nobetci_request", {
        p_request_id:     requestId,
        p_vet_id:         vet.id,
        p_owner_id:       request.owner_id,
        p_pet_id:         request.pet_id,
        p_complaint:      (request.complaint as string) || "Acil/Nöbetçi görüşme",
        p_fee:            fee,
        p_payment_id:     paymentId,
        p_video_channel:  channelName,
        p_video_room_url: tempRoomUrl,
      });

    if (rpcErr || !rpcResult) {
      // RPC failed after payment was already captured — log for manual reconciliation
      console.error("[nobetci/respond] accept_nobetci_request RPC failed:", rpcErr);
      return NextResponse.json(
        { error: "Randevu oluşturulamadı — destek ekibimizle iletişime geçin" },
        { status: 500 }
      );
    }

    const result       = rpcResult as { appointment_id: string; video_room_url: string };
    const apt          = { id: result.appointment_id };

    // Patch the video room URL with the real appointment ID
    const videoRoomUrl = `${appUrl}/video/${channelName}?appointment=${apt.id}`;
    await service
      .from("appointments")
      .update({ video_room_url: videoRoomUrl })
      .eq("id", apt.id);
    await service
      .from("instant_requests")
      .update({ video_room_url: videoRoomUrl })
      .eq("id", requestId);

    // Send confirmation email to owner
    const ownerData = Array.isArray(request.owner) ? request.owner[0] : request.owner as { full_name?: string; email?: string } | null;
    const vetUser   = Array.isArray(vet?.user) ? vet.user[0] : vet?.user as { full_name?: string } | null;
    if (ownerData?.email) {
      sendAppointmentConfirmationEmail({
        to:            ownerData.email,
        name:          ownerData.full_name || "Kullanıcı",
        vetName:       `Vet. Hek. ${vetUser?.full_name ?? ""}`,
        date:          now.toLocaleDateString("tr-TR"),
        time:          now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        appointmentId: apt.id,
        type:          "video",
      }).catch((emailErr) => console.error("[nobetci/respond] confirmation email failed:", emailErr));
    }

    return NextResponse.json({
      success:       true,
      action:        "accepted",
      appointmentId: apt.id,
      videoRoomUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("[nobetci/respond] error:", msg);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}

async function cancelPreAuth(paymentId: string, conversationId: string) {
  try {
    const rand   = Math.random().toString(36).slice(2);
    const body   = JSON.stringify({ locale: "tr", conversationId, paymentId });
    const hash   = crypto
      .createHash("sha256")
      .update(IYZICO_API_KEY + rand + IYZICO_SECRET_KEY + body)
      .digest("base64");
    const auth   = `IYZWS apiKey:${IYZICO_API_KEY}&randomKey:${rand}&signature:${hash}`;
    const res    = await fetch(`${IYZICO_BASE_URL}/payment/cancel`, {
      method:  "POST",
      headers: { Authorization: auth, "Content-Type": "application/json", "x-iyzi-rnd": rand, "x-iyzi-client-version": "iyzipay-node-2.0.48" },
      body,
    });
    const data = await res.json().catch(() => ({})) as { status?: string; errorMessage?: string };
    if (data.status !== "success") {
      // CRITICAL: pre-auth was NOT cancelled — owner may be charged for a declined request.
      // This requires manual intervention via iyzico dashboard.
      console.error("[nobetci/respond] cancelPreAuth FAILED — manual refund required", {
        paymentId,
        conversationId,
        iyzicoStatus: data.status,
        iyzicoError:  data.errorMessage,
      });
    }
  } catch (err) {
    // Network error during cancellation — owner may be charged.
    console.error("[nobetci/respond] cancelPreAuth network error — manual refund required", {
      paymentId,
      conversationId,
      error: err instanceof Error ? err.message : err,
    });
  }
}
