import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { sendAppointmentCancelledEmail } from "@/lib/email";

const IYZICO_BASE_URL    = process.env.IYZICO_BASE_URL!;
const IYZICO_API_KEY     = process.env.IYZICO_API_KEY!;
const IYZICO_SECRET_KEY  = process.env.IYZICO_SECRET_KEY!;

function iyzicoAuthHeader(body: string, rand: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(IYZICO_API_KEY + rand + IYZICO_SECRET_KEY + body)
    .digest("base64");
  return `IYZWS apiKey:${IYZICO_API_KEY}&randomKey:${rand}&signature:${hash}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase        = await createClient();
    const serviceSupabase = await createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { appointmentId, reason } = await req.json();
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId zorunludur" }, { status: 400 });
    }

    // Fetch appointment with full context
    const { data: apt, error: aptErr } = await serviceSupabase
      .from("appointments")
      .select(`
        id, type, status, payment_status, payment_id, payment_amount, owner_id, vet_id,
        datetime,
        owner:users!owner_id(full_name, phone),
        vet:veterinarians!vet_id(id, user_id, cancellation_count, user:users(full_name))
      `)
      .eq("id", appointmentId)
      .maybeSingle();

    if (aptErr || !apt) {
      return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    }

    type VetRow = { id: string; user_id: string; cancellation_count: number; user: { full_name: string } | { full_name: string }[] | null };
    type OwnerRow = { full_name: string; phone: string | null };

    const vetRow  = (Array.isArray(apt.vet)   ? apt.vet[0]   : apt.vet)  as VetRow  | null;
    const ownerRow = (Array.isArray(apt.owner) ? apt.owner[0] : apt.owner) as OwnerRow | null;

    // Confirm the caller is the vet of this appointment
    if (vetRow?.user_id !== user.id) {
      return NextResponse.json({ error: "Bu randevu size ait değil" }, { status: 403 });
    }

    // Prevent double-cancellation
    if (apt.status === "cancelled") {
      return NextResponse.json({ error: "Bu randevu zaten iptal edilmiş" }, { status: 400 });
    }

    // ── 1. Update appointment status ──────────────────────────────────────────
    await serviceSupabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancellation_reason: reason || "Veteriner tarafından iptal edildi",
      })
      .eq("id", appointmentId);

    // ── 2. Auto-refund for video appointments ─────────────────────────────────
    let refunded = false;
    if (apt.type === "video" && apt.payment_status === "held" && apt.payment_id) {
      try {
        const rand = Math.random().toString(36).slice(2);
        const conversationId = `refund-${appointmentId}-${Date.now()}`;
        const clientIp =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          "127.0.0.1";
        const refundBody = JSON.stringify({
          locale: "tr",
          conversationId,
          paymentId: apt.payment_id,
          price: (apt.payment_amount ?? 0).toFixed(2),
          currency: "TRY",
          ip: clientIp,
        });

        const refRes = await fetch(`${IYZICO_BASE_URL}/payment/refund`, {
          method: "POST",
          headers: {
            Authorization: iyzicoAuthHeader(refundBody, rand),
            "Content-Type": "application/json",
            "x-iyzi-rnd": rand,
          },
          body: refundBody,
        });

        const refData = await refRes.json();

        if (refData.status !== "success") {
          // Refund failed — revert appointment status and surface the error
          await serviceSupabase
            .from("appointments")
            .update({ status: "cancelled", payment_status: "held" })
            .eq("id", appointmentId);
          return NextResponse.json(
            { error: `İade başarısız: ${refData.errorMessage ?? "Ödeme sağlayıcısı hatası"}` },
            { status: 502 }
          );
        }

        await serviceSupabase
          .from("appointments")
          .update({ payment_status: "refunded" })
          .eq("id", appointmentId);

        await serviceSupabase.from("payments").insert({
          vet_id:       vetRow?.id,
          owner_id:     apt.owner_id,
          appointment_id: appointmentId,
          amount:       -(apt.payment_amount ?? 0),
          type:         "video_consultation",
          status:       "refunded",
          iyzico_payment_id:   apt.payment_id,
          iyzico_transaction_id: conversationId,
          description:  "Veteriner iptali — otomatik iade",
        });

        refunded = true;
      } catch (refundErr) {
        console.error("Refund error:", refundErr instanceof Error ? refundErr.message : refundErr);
        return NextResponse.json(
          { error: "İade işlemi sırasında beklenmeyen bir hata oluştu. Lütfen destek ekibiyle iletişime geçin." },
          { status: 500 }
        );
      }
    }

    // ── 3. Email notification to owner ───────────────────────────────────────
    const [ownerEmailData] = await Promise.all([
      serviceSupabase
        .from("users")
        .select("email, full_name")
        .eq("id", apt.owner_id)
        .maybeSingle(),
    ]);

    if (ownerEmailData.data?.email) {
      const vetNameStr = Array.isArray(vetRow?.user)
        ? (vetRow.user[0] as { full_name: string })?.full_name
        : (vetRow?.user as { full_name: string } | null)?.full_name ?? "Veteriner";
      const dt = new Date(apt.datetime as string);
      sendAppointmentCancelledEmail({
        to: ownerEmailData.data.email,
        name: ownerEmailData.data.full_name ?? "Kullanıcı",
        vetName: `Dr. ${vetNameStr}`,
        date: dt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
        time: dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        reason: reason || null,
      }).catch((err) => console.error("[vet/cancel-appointment] email failed:", err));
    }

    // ── 4. Track cancellation rate — flag vet if >20% ─────────────────────────
    const newCancellationCount = (vetRow?.cancellation_count ?? 0) + 1;

    if (vetRow?.id) {
      await serviceSupabase
        .from("veterinarians")
        .update({ cancellation_count: newCancellationCount })
        .eq("id", vetRow.id);
    }

    // Check cancellation rate — only count completed + cancelled (fair baseline)
    const { count: totalApts } = await serviceSupabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("vet_id", apt.vet_id)
      .in("status", ["completed", "cancelled"]);

    const total = totalApts ?? 0;
    if (vetRow?.id && total >= 10 && newCancellationCount / total > 0.2) {
      await serviceSupabase
        .from("veterinarians")
        .update({ is_flagged: true })
        .eq("id", vetRow.id);

      await serviceSupabase.from("system_errors").insert({
        severity: "medium",
        message:  `Vet ${vetRow.id} cancellation rate exceeded 20% (${newCancellationCount}/${total})`,
      });
    }

    // ── Buffer-lock recomputation (fire-and-forget) ───────────────────────────
    // After cancellation the slot is freed. Recompute buffer_lock immediately
    // so the vet doesn't have to wait up to 5 min for the cron to clear it.
    void (async () => {
      try {
        const vetId = vetRow?.id;
        if (!vetId) return;
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
        await serviceSupabase
          .from("veterinarians")
          .update({ buffer_lock: (count ?? 0) > 0 })
          .eq("id", vetId);
      } catch (e) {
        console.warn("[vet/cancel-appointment] buffer_lock recompute failed (non-fatal):", e);
      }
    })();

    return NextResponse.json({
      success: true,
      refunded,
      message: refunded ? "Randevu iptal edildi ve ödeme iade edildi." : "Randevu iptal edildi.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("cancel-appointment error:", msg);
    return NextResponse.json({ error: "İptal işlemi başarısız" }, { status: 500 });
  }
}
