import { alertCronFailure } from "@/lib/cron-alert";
/**
 * /api/cron/video-reminder — sends a 10-minute warning email to both
 * owner and vet before a confirmed video appointment.
 *
 * Runs every 10 minutes via Vercel Cron.
 * Uses reminder_sent flag to guarantee at-most-once delivery per appointment.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendAppointmentReminderEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();
    const now = new Date();
    const tenMinFromNow = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    // Appointments starting within the next 10 minutes that haven't been notified yet
    const { data: appointments, error: fetchError } = await supabase
      .from("appointments")
      .select(`
        id,
        datetime,
        owner:users!owner_id(full_name, email),
        vet:veterinarians!vet_id(
          user:users(full_name, email)
        )
      `)
      .eq("type", "video")
      .eq("status", "confirmed")
      .eq("reminder_sent", false)
      .gte("datetime", now.toISOString())
      .lte("datetime", tenMinFromNow);

    if (fetchError) throw fetchError;
    if (!appointments?.length) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    let sent = 0;
    for (const apt of appointments) {
      const owner   = apt.owner as { full_name?: string; email?: string } | null;
      const vetUser = (apt.vet as { user?: { full_name?: string; email?: string } } | null)?.user;

      const dt     = new Date(apt.datetime);
      const date   = dt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
      const time   = dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

      // Email — hayvan sahibi
      if (owner?.email) {
        sendAppointmentReminderEmail({
          to:            owner.email,
          name:          owner.full_name ?? "Kullanıcı",
          vetName:       `Vet. Hek. ${vetUser?.full_name ?? ""}`,
          date,
          time,
          appointmentId: apt.id,
        }).catch((err) => console.error("[cron/video-reminder] owner email failed:", err));
      }

      // Email — veteriner
      if (vetUser?.email) {
        sendAppointmentReminderEmail({
          to:            vetUser.email,
          name:          `Vet. Hek. ${vetUser.full_name ?? ""}`,
          vetName:       owner?.full_name ?? "Hasta",
          date,
          time,
          appointmentId: apt.id,
        }).catch((err) => console.error("[cron/video-reminder] vet email failed:", err));
      }

      // Mark as sent so cron doesn't fire again for this appointment
      await supabase
        .from("appointments")
        .update({ reminder_sent: true })
        .eq("id", apt.id);

      sent++;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    console.error("[video-reminder] error:", msg);
    await alertCronFailure("video-reminder", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
