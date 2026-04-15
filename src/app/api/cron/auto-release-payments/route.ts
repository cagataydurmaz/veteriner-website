import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { alertCronFailure } from "@/lib/cron-alert";

/**
 * Auto-Release Cron — runs every 15 minutes via Vercel Cron
 *
 * Problem: Vet marks session "complete" to release escrowed payment to themselves.
 * If vet forgets / goes offline / never presses the button → money stuck as "held" forever.
 *
 * Fix: 45 minutes after the appointment datetime (30 min session + 15 min buffer),
 * automatically release payment to vet for any confirmed+held appointment.
 *
 * cron: "every 15 minutes" → vercel.json: "* /15 * * * *"
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date();

  // 45 min ago = randevu saati + 30 dk seans + 15 dk buffer geçti
  const cutoff = new Date(now.getTime() - 45 * 60 * 1000);

  const results = {
    released: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // Find all confirmed appointments with held payment past the cutoff
    const { data: overdue, error: fetchError } = await supabase
      .from("appointments")
      .select("id, vet_id, owner_id, payment_amount, payment_id, datetime")
      .eq("status", "confirmed")
      .eq("payment_status", "held")
      .eq("type", "video")
      .lt("datetime", cutoff.toISOString());

    if (fetchError) throw fetchError;
    if (!overdue || overdue.length === 0) {
      return NextResponse.json({ ...results, message: "Bekleyen ödeme yok" });
    }

    for (const apt of overdue) {
      try {
        // Atomic guard: only update if still in held state (prevent race conditions)
        const { data: updated, error: updateError } = await supabase
          .from("appointments")
          .update({
            status: "completed",
            payment_status: "completed",
          })
          .eq("id", apt.id)
          .eq("status", "confirmed")       // guard: must still be confirmed
          .eq("payment_status", "held")    // guard: must still be held
          .select("id")
          .maybeSingle();

        if (updateError) throw updateError;

        // If nothing was updated → another process already handled it
        if (!updated) {
          results.skipped++;
          continue;
        }

        // Log the auto-release in payments table
        await supabase.from("payments").insert({
          vet_id: apt.vet_id,
          owner_id: apt.owner_id,
          appointment_id: apt.id,
          amount: apt.payment_amount,
          type: "video_consultation",
          status: "success",
          iyzico_payment_id: apt.payment_id,
          description: "Otomatik serbest bırakma — veteriner tamamlamadı",
        });

        results.released++;

        console.log(`[auto-release] Released payment for appointment ${apt.id} (₺${apt.payment_amount})`);
      } catch (aptErr) {
        const msg = aptErr instanceof Error ? aptErr.message : String(aptErr);
        results.errors.push(`apt:${apt.id} → ${msg}`);
        console.error(`[auto-release] Failed for apt ${apt.id}:`, msg);
      }
    }

    if (results.errors.length > 0) {
      await alertCronFailure(
        "auto-release-payments",
        `${results.errors.length} ödeme serbest bırakılamadı: ${results.errors.join("; ")}`
      );
    }

    return NextResponse.json({
      ...results,
      message: `${results.released} ödeme serbest bırakıldı, ${results.skipped} atlandı`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    await alertCronFailure("auto-release-payments", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
