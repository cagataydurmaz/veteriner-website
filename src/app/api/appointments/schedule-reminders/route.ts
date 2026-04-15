import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Determines smart reminder schedule based on:
// - User's no-show history → extra 48h reminder
// - First appointment → include prep tips
// - Video appointment → add camera/internet check
// Called right after appointment is successfully created.

export async function POST(req: NextRequest) {
  try {
    // Auth check — caller must be a logged-in user
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { appointmentId } = await req.json();
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId zorunludur" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Fetch appointment with owner and pet info
    const { data: apt, error: aptError } = await supabase
      .from("appointments")
      .select(`
        id, datetime, type, owner_id, pet_id,
        owner:users!owner_id(full_name, warning_count),
        pet:pets(name),
        vet:veterinarians(user:users(full_name))
      `)
      .eq("id", appointmentId)
      .maybeSingle();

    if (aptError || !apt) {
      return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    }

    const aptDatetime = new Date(apt.datetime as string);
    const now = new Date();
    const isVideo = apt.type === "video";
    const ownerName = (apt.owner as { full_name?: string })?.full_name ?? "Pet Sahibi";
    const petName   = (apt.pet   as { name?: string })?.name ?? "hayvanınız";
    const vetName   = ((apt.vet  as { user?: { full_name?: string } })?.user)?.full_name ?? "veterineriniz";

    // Check no-show history
    const noShowCount = (apt.owner as { warning_count?: number })?.warning_count ?? 0;
    const hasNoShows = noShowCount > 0;

    // Check if this is their first appointment ever
    const { count: totalApts } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", apt.owner_id)
      .neq("id", appointmentId);
    const isFirstAppointment = (totalApts ?? 0) === 0;

    // Build reminder schedule
    // hoursBeforeApt can be a fraction — 0.25 = 15 minutes
    type ReminderEntry = { hoursBeforeApt: number; includePrep: boolean; includeVideoCheck: boolean };
    const schedule: ReminderEntry[] = [];

    if (hasNoShows) {
      // Stricter: 48h + 24h + 2h + 15 min
      schedule.push(
        { hoursBeforeApt: 48,   includePrep: false, includeVideoCheck: false },
        { hoursBeforeApt: 24,   includePrep: false, includeVideoCheck: false },
        { hoursBeforeApt: 2,    includePrep: false, includeVideoCheck: isVideo },
        { hoursBeforeApt: 0.25, includePrep: false, includeVideoCheck: isVideo }, // 15 min
      );
    } else {
      // Standard: 24h + 2h + 15 min
      schedule.push(
        { hoursBeforeApt: 24,   includePrep: isFirstAppointment, includeVideoCheck: false },
        { hoursBeforeApt: 2,    includePrep: false,              includeVideoCheck: isVideo },
        { hoursBeforeApt: 0.25, includePrep: false,              includeVideoCheck: isVideo }, // 15 min
      );
    }

    const remindersToInsert = [];

    for (const entry of schedule) {
      const scheduledAt = new Date(aptDatetime.getTime() - entry.hoursBeforeApt * 60 * 60 * 1000);

      // Skip if the scheduled time is already in the past
      if (scheduledAt <= now) continue;

      // ── Build message text ─────────────────────────────────────────────────
      const is15Min = entry.hoursBeforeApt === 0.25;
      const timeLabel =
        entry.hoursBeforeApt === 48   ? "2 gün" :
        entry.hoursBeforeApt === 24   ? "Yarın"  :
        entry.hoursBeforeApt === 2    ? "2 saat" :
        "15 dakika";

      let message = is15Min
        ? `🚨 Veterineri Bul — Son Hatırlatma\n\n` +
          `Merhaba ${ownerName},\n\n` +
          `Randevunuza 15 dakika kaldı!\n\n` +
          `🐾 ${petName} için Dr. ${vetName} ile ` +
          `${aptDatetime.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} ` +
          `randevunuz var.\n`
        : `⏰ Veterineri Bul Hatırlatıcı\n\n` +
          `Merhaba ${ownerName},\n\n` +
          `${timeLabel} sonra randevunuz var!\n\n` +
          `🐾 ${petName} için Dr. ${vetName} ile ` +
          `${aptDatetime.toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} ` +
          `randevunuz bulunmakta.\n`;

      if (!is15Min && entry.includePrep) {
        message +=
          `\n📋 Hazırlık ipuçları:\n` +
          `• Aşı karnesini ve varsa önceki tedavi belgelerini getirin\n` +
          `• Hayvanınızın son 24 saatlik yeme-içme durumunu not edin\n` +
          `• Alerjileri veya ilaçlarını veterinere bildirin\n`;
      }

      if (entry.includeVideoCheck) {
        message += is15Min
          ? `\n📹 Kameranızı ve internet bağlantınızı şimdi kontrol edin.\n`
          : `\n📹 Video görüşme hazırlığı:\n` +
            `• İnternet bağlantınızı ve kameranızı kontrol edin\n` +
            `• Uygulamayı güncel tutun\n` +
            `• Hayvanınızı sakin ve aydınlık bir ortamda tutun\n`;
      }

      if (!is15Min && hasNoShows && entry.hoursBeforeApt === 2) {
        message += `\n⚠️ Randevuya katılamayacaksanız lütfen önceden iptal edin.\n`;
      }

      message += `\nVeterineri Bul 🐾`;

      const title =
        entry.hoursBeforeApt === 48   ? "Randevunuz 2 gün sonra" :
        entry.hoursBeforeApt === 24   ? "Randevunuz yarın" :
        entry.hoursBeforeApt === 2    ? "Randevunuz 2 saat sonra" :
        "Randevunuz 15 dakika sonra";

      remindersToInsert.push({
        pet_id:          apt.pet_id,
        owner_id:        apt.owner_id,
        type:            "appointment" as const,
        title,
        scheduled_at:    scheduledAt.toISOString(),
        message_content: message,
        delivery_status: "pending" as const,
      });
    }

    if (remindersToInsert.length > 0) {
      const { error: insertError } = await supabase.from("reminders").insert(remindersToInsert);
      if (insertError) {
        console.error("schedule-reminders insert error:", insertError.message);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      remindersScheduled: remindersToInsert.length,
      hasNoShows,
      isFirstAppointment,
      isVideo,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    console.error("schedule-reminders error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
