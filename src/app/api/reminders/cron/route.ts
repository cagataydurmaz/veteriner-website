import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { withClaudeTimeout } from "@/lib/fetchWithTimeout";
import { sendSMS } from "@/lib/sms";
import { sendAppointmentReminderEmail } from "@/lib/email";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Feature flag: set MEDICATION_REMINDERS_ENABLED=true in env to enable
// vaccine & follow-up reminders. Appointment reminders always run.
const MEDICATION_REMINDERS_ENABLED = process.env.MEDICATION_REMINDERS_ENABLED === "true";

// This route is called by a cron job (Vercel Cron or external)
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const supabase = await createClient();
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (MEDICATION_REMINDERS_ENABLED) {
    // 1. Find upcoming vaccine due dates (within 7 days)
    const { data: upcomingVaccines } = await supabase
      .from("vaccines")
      .select(`
        *,
        pet:pets(name, species, owner_id, owner:users(full_name, phone))
      `)
      .gte("next_due_date", now.toISOString().split("T")[0])
      .lte("next_due_date", in7Days.toISOString().split("T")[0]);

    // 2. Find upcoming follow-up appointments from medical records
    const { data: followUps } = await supabase
      .from("medical_records")
      .select(`
        *,
        appointment:appointments(
          pet_id, owner_id,
          pet:pets(name, species, owner:users(full_name, phone))
        )
      `)
      .gte("follow_up_date", now.toISOString().split("T")[0])
      .lte("follow_up_date", in7Days.toISOString().split("T")[0]);

    // Suppress unused variable warning until follow-up processing is implemented
    void followUps;

    // Process vaccines
    for (const vaccine of upcomingVaccines || []) {
      const pet = vaccine.pet;
      const owner = pet?.owner;

      if (!owner?.phone) continue;

      // Check if already reminded
      const { data: existing } = await supabase
        .from("reminders")
        .select("id")
        .eq("owner_id", pet.owner_id)
        .eq("pet_id", vaccine.pet_id)
        .eq("type", "vaccine")
        .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Generate personalized message with Claude
      let message: string;
      try {
        const response = await withClaudeTimeout(
          (signal) =>
            anthropic.messages.create(
              {
                model: "claude-sonnet-4-5",
                max_tokens: 300,
                system: "Sen bir veteriner kliniği asistanısın. Kısa, samimi ve Türkçe WhatsApp mesajları yazıyorsun. Asla teşhis yapma. 3-4 cümle yaz.",
                messages: [
                  {
                    role: "user",
                    content: `${owner.full_name} adlı hayvan sahibinin ${pet.name} adlı ${pet.species}i için ${vaccine.name} aşısının tarihi ${vaccine.next_due_date} tarihinde. Hatırlatma mesajı yaz.`,
                  },
                ],
              },
              { signal }
            ),
          30_000 // 30 second timeout
        );

        const content = response.content[0];
        message = content.type === "text" ? content.text : `🐾 Merhaba ${owner.full_name}, ${pet.name}'in ${vaccine.name} aşı tarihi yaklaşıyor (${vaccine.next_due_date}). Lütfen randevu alınız.`;

        await supabase.from("api_usage_logs").insert({
          api_type: "claude",
          tokens_used: response.usage.input_tokens + response.usage.output_tokens,
          cost_estimate: (response.usage.input_tokens * 0.003 + response.usage.output_tokens * 0.015) / 1000,
          metadata: { operation: "reminder_generation" },
        });
      } catch {
        message = `🐾 Merhaba ${owner.full_name}, ${pet.name}'in ${vaccine.name} aşı tarihi (${vaccine.next_due_date}) yaklaşıyor. Lütfen veterinerinizle randevu alınız. Veterineri Bul 🐾`;
      }

      // SMS bildirimi
      sendSMS(owner.phone, message).catch((err) => console.error("[reminders/cron] sms failed:", err));

      await supabase.from("reminders").insert({
        owner_id: pet.owner_id,
        pet_id: vaccine.pet_id,
        type: "vaccine",
        scheduled_at: new Date().toISOString(),
        sent_at: null,
        message_content: message,
        delivery_status: "pending",
      });

      results.sent++;
    }

    } // end MEDICATION_REMINDERS_ENABLED

    // 3. Send 24h appointment reminders
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStart = tomorrow.toISOString().split("T")[0] + "T00:00:00";
    const tomorrowEnd = tomorrow.toISOString().split("T")[0] + "T23:59:59";

    const { data: tomorrowApts } = await supabase
      .from("appointments")
      .select(`
        *,
        pet:pets(name),
        owner:users(full_name, phone, email),
        vet:veterinarians(user:users(full_name))
      `)
      .gte("datetime", tomorrowStart)
      .lte("datetime", tomorrowEnd)
      .in("status", ["pending", "confirmed"]);

    for (const apt of tomorrowApts || []) {
      const owner = apt.owner as { full_name?: string; phone?: string; email?: string } | null;
      const vetUser = (apt.vet as { user?: { full_name?: string } } | null)?.user;

      if (!owner?.phone && !owner?.email) continue;

      const aptDate = new Date(apt.datetime);
      const dateStr = aptDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
      const timeStr = aptDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

      // Email (birincil kanal)
      if (owner?.email) {
        sendAppointmentReminderEmail({
          to: owner.email,
          name: owner.full_name || "Kullanıcı",
          vetName: vetUser?.full_name ? `Dr. ${vetUser.full_name}` : "Veteriner",
          date: dateStr,
          time: timeStr,
          appointmentId: apt.id,
        }).catch((err) => console.error("[reminders/cron] email failed:", err));
      }

      // SMS (yedek kanal)
      if (owner?.phone) {
        const message = `⏰ Veterineri Bul Hatırlatıcı

Merhaba ${owner.full_name}, yarın randevunuz var!

🐾 ${apt.pet?.name} için Dr. ${vetUser?.full_name} ile ${timeStr} randevunuz bulunmakta.

İptal etmek için uygulamayı açınız.`;

        sendSMS(owner.phone, message).catch((err) => console.error("[reminders/cron] sms failed:", err));
      }

      results.sent++;
    }

    // ── 4. Process pre-scheduled smart reminders (delivery_status = 'pending') ──
    const { data: pendingReminders } = await supabase
      .from("reminders")
      .select(`
        id, message_content, owner_id,
        owner:users!owner_id(phone)
      `)
      .eq("delivery_status", "pending")
      .lte("scheduled_at", now.toISOString())
      .limit(200);

    for (const reminder of pendingReminders || []) {
      const phone = (reminder.owner as { phone?: string })?.phone;

      if (!phone) {
        await supabase
          .from("reminders")
          .update({ delivery_status: "failed", sent_at: now.toISOString() })
          .eq("id", reminder.id);
        continue;
      }

      // SMS bildirimi
      sendSMS(phone, reminder.message_content).catch((err) => console.error("[reminders/cron] sms failed:", err));
      await supabase
        .from("reminders")
        .update({ delivery_status: "pending", sent_at: now.toISOString() })
        .eq("id", reminder.id);
      results.sent++;
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `${results.sent} hatırlatıcı gönderildi, ${results.failed} başarısız`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Hata oluştu";
    // Alert admin on cron failure
    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    if (adminEmail) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      resend.emails.send({
        from: "Veterineri Bul <bildirim@veterineribul.com>",
        to: adminEmail,
        subject: "⚠️ Cron Hatası: reminders/cron",
        html: `<p>Cron job başarısız oldu.</p><p><b>Hata:</b> ${msg}</p><p><b>Zaman:</b> ${new Date().toISOString()}</p>`,
      }).catch(() => null);
    }
    console.error("[cron:reminders]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
