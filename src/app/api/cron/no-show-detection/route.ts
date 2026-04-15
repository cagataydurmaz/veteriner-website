import { alertCronFailure } from "@/lib/cron-alert";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const NO_SHOW_THRESHOLD = 3; // flag user after this many no-shows

// Runs every hour — detects appointments still 'confirmed' 2+ hours after datetime
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const results = { detected: 0, flagged: 0, errors: [] as string[] };

  try {
    // Find all 'confirmed' appointments whose datetime passed 2 hours ago
    const { data: overdue, error: fetchError } = await supabase
      .from("appointments")
      .select(`
        id, owner_id, vet_id, datetime, pet_id,
        owner:users!owner_id(warning_count)
      `)
      .eq("status", "confirmed")
      .lt("datetime", twoHoursAgo.toISOString());

    if (fetchError) throw fetchError;
    if (!overdue || overdue.length === 0) {
      return NextResponse.json({ success: true, ...results, message: "Tespit edilecek no-show yok" });
    }

    for (const apt of overdue) {
      try {
        // 1. Mark appointment as no_show
        await supabase
          .from("appointments")
          .update({ status: "no_show" })
          .eq("id", apt.id);

        // 2. Log to system_errors
        await supabase.from("system_errors").insert({
          severity: "low",
          message: `No-show tespit edildi: Randevu #${apt.id}`,
          context: {
            appointment_id: apt.id,
            owner_id: apt.owner_id,
            vet_id: apt.vet_id,
            datetime: apt.datetime,
          },
        });

        // 5. Increment owner warning_count and flag if threshold reached
        const currentWarnings = ((apt.owner as { warning_count?: number })?.warning_count ?? 0);
        const newCount = currentWarnings + 1;

        await supabase
          .from("users")
          .update({
            warning_count: newCount,
            is_flagged: newCount >= NO_SHOW_THRESHOLD,
          })
          .eq("id", apt.owner_id);

        if (newCount >= NO_SHOW_THRESHOLD) {
          results.flagged++;
          // Log critical error when user is flagged
          await supabase.from("system_errors").insert({
            severity: "high",
            message: `Kullanıcı ${NO_SHOW_THRESHOLD}+ no-show nedeniyle işaretlendi`,
            context: { owner_id: apt.owner_id, warning_count: newCount },
          });
        }

        // ── Reset is_busy for the vet ─────────────────────────────────────
        // A no-show ends the appointment. If the vet had is_busy=true
        // (e.g. was waiting or the video room opened), clear it so they
        // don't stay permanently locked. Non-fatal if this fails — the
        // recompute-buffer-locks cron self-heals buffer_lock separately.
        await supabase
          .from("veterinarians")
          .update({ is_busy: false })
          .eq("id", apt.vet_id)
          .eq("is_busy", true); // only write if currently busy (avoids noisy updates)

        results.detected++;
      } catch (aptError) {
        const msg = aptError instanceof Error ? aptError.message : "Bilinmeyen hata";
        results.errors.push(`Randevu ${apt.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `${results.detected} no-show işaretlendi, ${results.flagged} kullanıcı bayraklandı`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Hata";
    console.error("No-show detection error:", msg);
    await alertCronFailure("no-show-detection", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
