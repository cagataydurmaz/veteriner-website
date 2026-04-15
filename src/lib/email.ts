/**
 * Resend e-posta yardımcısı — birincil bildirim kanalı.
 *
 * Kullanım:
 *   import { sendAppointmentConfirmationEmail } from "@/lib/email";
 *   sendAppointmentConfirmationEmail({ ... }).catch(() => null);
 *
 * Tüm fonksiyonlar hata fırlatmaz; arayan taraf çökmemeli.
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Veterineri Bul <bildirim@veterineribul.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com";

// ── Güvenli gönderici — hataları loglar, hiçbir zaman fırlatmaz ──────────────
async function send(
  subject: string,
  to: string,
  html: string
): Promise<void> {
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    if (result.error) {
      console.error(`[email] gönderim hatası — to:${to} subject:"${subject}"`, result.error);
    }
  } catch (err) {
    console.error(`[email] beklenmedik hata — to:${to} subject:"${subject}"`, err);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ── HTML yardımcıları ────────────────────────────────────────────────────────

function template(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:600px;width:100%;"><tr><td style="background:#1A6B4A;padding:24px 40px;"><table cellpadding="0" cellspacing="0"><tr><td style="color:#ffffff;font-size:20px;font-weight:800;">🐾 Veterineri Bul</td><td style="padding-left:8px;"><span style="background:rgba(255,255,255,0.2);color:#ffffff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:20px;">AI</span></td></tr></table></td></tr><tr><td style="padding:40px;">${body}</td></tr><tr><td style="background:#f3f4f6;padding:20px 40px;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Bu e-posta Veterineri Bul platformu tarafından gönderilmiştir.<br>Sorularınız için: <a href="mailto:destek@veterineribul.com" style="color:#1A6B4A;">destek@veterineribul.com</a></p></td></tr></table></td></tr></table></body></html>`;
}

function btn(url: string, text: string): string {
  return `<a href="${url}" style="display:inline-block;background:#1A6B4A;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-top:20px;">${text}</a>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">${text}</p>`;
}

// ── 1. Randevu onayı ────────────────────────────────────────────────────────

export async function sendAppointmentConfirmationEmail(opts: {
  to: string;
  name: string;
  vetName: string;
  date: string;
  time: string;
  type: string;
  appointmentId: string;
}) {
  const body =
    h1("Randevunuz Onaylandı ✓") +
    p(`Merhaba ${opts.name},`) +
    p(`<strong>${opts.vetName}</strong> ile randevunuz onaylandı.`) +
    `<table style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">📅 Tarih</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.date}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">🕐 Saat</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.time}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">📋 Tür</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.type}</td></tr>
    </table>` +
    btn(`${APP_URL}/owner/appointments/${opts.appointmentId}`, "Randevuyu Görüntüle");

  return send("Randevunuz Onaylandı – Veterineri Bul", opts.to, template(body));
}

// ── 2. Randevu hatırlatıcısı ─────────────────────────────────────────────────

export async function sendAppointmentReminderEmail(opts: {
  to: string;
  name: string;
  vetName: string;
  date: string;
  time: string;
  appointmentId: string;
}) {
  const body =
    h1("Randevu Hatırlatıcısı 🔔") +
    p(`Merhaba ${opts.name},`) +
    p(`<strong>${opts.vetName}</strong> ile yarınki randevunuzu hatırlatmak istedik.`) +
    `<table style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">📅 Tarih</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.date}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">🕐 Saat</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.time}</td></tr>
    </table>` +
    btn(`${APP_URL}/owner/appointments/${opts.appointmentId}`, "Randevuyu Görüntüle");

  return send("Yarın Randevunuz Var – Veterineri Bul", opts.to, template(body));
}

// ── 3. Şikayet çözüldü ──────────────────────────────────────────────────────

export async function sendComplaintResolvedEmail(opts: {
  to: string;
  name: string;
  resolution: string;
  appointmentId: string;
}) {
  const resolutionMap: Record<string, string> = {
    owner_wins: "Kullanıcı haklı bulundu — tam iade yapıldı",
    vet_wins: "Veteriner haklı bulundu — iade yapılmadı",
    split: "Ortak karar — %50 iade yapıldı",
    dismissed: "Şikayet reddedildi",
  };
  const resolutionText = resolutionMap[opts.resolution] ?? opts.resolution;

  const body =
    h1("Şikayetiniz Çözüme Kavuştu") +
    p(`Merhaba ${opts.name},`) +
    p("Platforma ilettiğiniz şikayet incelendi ve karara bağlandı.") +
    `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#166534;">Sonuç: ${resolutionText}</p>
    </div>` +
    btn(`${APP_URL}/owner/appointments/${opts.appointmentId}`, "Detayları Görüntüle");

  return send("Şikayetiniz Çözüme Kavuştu – Veterineri Bul", opts.to, template(body));
}

// ── 4. Hesap durumu değişikliği ──────────────────────────────────────────────

export async function sendAccountStatusEmail(opts: {
  to: string;
  name: string;
  status: string;
  reason?: string | null;
  suspendedUntil?: string | null;
}) {
  const statusConfig: Record<
    string,
    { subject: string; title: string; color: string; bgColor: string }
  > = {
    under_review: {
      subject: "Hesabınız İncelemeye Alındı",
      title: "Hesabınız İnceleniyor 🔍",
      color: "#92400e",
      bgColor: "#fffbeb",
    },
    suspended: {
      subject: "Hesabınız Askıya Alındı",
      title: "Hesabınız Askıya Alındı ⏸",
      color: "#9a3412",
      bgColor: "#fff7ed",
    },
    banned: {
      subject: "Hesabınız Kapatıldı",
      title: "Hesabınız Kapatıldı 🚫",
      color: "#991b1b",
      bgColor: "#fef2f2",
    },
    active: {
      subject: "Hesabınız Yeniden Aktif",
      title: "Hesabınız Aktif Edildi ✓",
      color: "#166534",
      bgColor: "#f0fdf4",
    },
  };

  const cfg = statusConfig[opts.status] ?? statusConfig.active;
  const until = opts.suspendedUntil
    ? new Date(opts.suspendedUntil).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  let bodyContent = h1(cfg.title) + p(`Merhaba ${opts.name},`);

  if (opts.status === "under_review") {
    bodyContent += p(
      "Hesabınız inceleme altına alınmıştır. En kısa sürede bilgilendirileceksiniz."
    );
  } else if (opts.status === "suspended") {
    bodyContent += p(
      `Hesabınız${until ? ` <strong>${until}</strong> tarihine kadar` : " geçici olarak"} askıya alınmıştır.`
    );
    if (opts.reason) {
      bodyContent += `<div style="background:${cfg.bgColor};border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0;color:${cfg.color};font-size:14px;"><strong>Sebep:</strong> ${opts.reason}</p></div>`;
    }
  } else if (opts.status === "banned") {
    bodyContent += p("Hesabınız kalıcı olarak kapatılmıştır.");
    if (opts.reason) {
      bodyContent += `<div style="background:${cfg.bgColor};border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0;color:${cfg.color};font-size:14px;"><strong>Sebep:</strong> ${opts.reason}</p></div>`;
    }
    bodyContent += p(
      'İtiraz için: <a href="mailto:destek@veterineribul.com" style="color:#1A6B4A;">destek@veterineribul.com</a>'
    );
  } else if (opts.status === "active") {
    bodyContent += p(
      "Hesabınız yeniden aktif edilmiştir. Platforma giriş yapabilirsiniz."
    );
    bodyContent += btn(`${APP_URL}/auth/login`, "Giriş Yap");
  }

  return send(`${cfg.subject} – Veterineri Bul`, opts.to, template(bodyContent));
}

// ── 5. Veteriner onay/red ────────────────────────────────────────────────────

export async function sendVetApprovalEmail(opts: {
  to: string;
  name: string;
  approved: boolean;
  reason?: string | null;
}) {
  const body = opts.approved
    ? h1("Profiliniz Onaylandı 🎉") +
      p(`Merhaba Dr. ${opts.name},`) +
      p(
        "Profiliniz onaylandı. Artık Veterineri Bul platformunda görünüyorsunuz ve randevu almaya başlayabilirsiniz."
      ) +
      btn(`${APP_URL}/vet/dashboard`, "Panele Git")
    : h1("Profiliniz Reddedildi") +
      p(`Merhaba Dr. ${opts.name},`) +
      p("Profiliniz incelendi ancak onaylanmadı.") +
      (opts.reason
        ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0;color:#991b1b;font-size:14px;"><strong>Sebep:</strong> ${opts.reason}</p></div>`
        : "") +
      p(
        'Eksikliklerinizi düzelterek tekrar başvurabilirsiniz. Sorularınız için: <a href="mailto:destek@veterineribul.com" style="color:#1A6B4A;">destek@veterineribul.com</a>'
      );

  return send(
    opts.approved ? "Profiliniz Onaylandı – Veterineri Bul" : "Profil Başvurunuz Hakkında – Veterineri Bul",
    opts.to,
    template(body)
  );
}

// ── 6. Randevu iptali (sahibine) ────────────────────────────────────────────

export async function sendAppointmentCancelledEmail(opts: {
  to: string; name: string; vetName: string; date: string; time: string; reason?: string | null;
}) {
  const body = h1("Randevunuz İptal Edildi") +
    p(`Merhaba ${opts.name},`) +
    p(`<strong>${opts.vetName}</strong> ile olan randevunuz iptal edildi.`) +
    `<table style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">📅 Tarih</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.date}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">🕐 Saat</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.time}</td></tr>
    </table>` +
    (opts.reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0;color:#991b1b;font-size:14px;"><strong>Sebep:</strong> ${opts.reason}</p></div>` : "") +
    p('Yeni randevu almak için platforma giriş yapabilirsiniz.') +
    btn(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com"}/veteriner-bul`, "Yeni Randevu Al");

  return send("Randevunuz İptal Edildi – Veterineri Bul", opts.to, template(body));
}

// ── 7. Yeni randevu bildirimi (veterinere) ───────────────────────────────────

export async function sendNewBookingEmail(opts: {
  to: string; vetName: string; ownerName: string; petName: string; date: string; time: string; type: string; appointmentId: string;
}) {
  const body = h1("Yeni Randevu Talebi 📋") +
    p(`Merhaba Dr. ${opts.vetName},`) +
    p(`<strong>${opts.ownerName}</strong> adlı kullanıcı randevu talebi oluşturdu.`) +
    `<table style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">🐾 Hayvan</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.petName}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">📅 Tarih</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.date}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">🕐 Saat</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.time}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">📋 Tür</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.type}</td></tr>
    </table>` +
    btn(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com"}/vet/appointments/${opts.appointmentId}`, "Randevuyu İncele");

  return send("Yeni Randevu Talebi – Veterineri Bul", opts.to, template(body));
}

// ── 8. Admin'e yeni şikayet bildirimi ────────────────────────────────────────

export async function sendNewComplaintAdminEmail(opts: {
  to: string; reporterType: string; reason: string; appointmentId: string; complaintId: string;
}) {
  const body = h1("Yeni Şikayet Alındı ⚠️") +
    p(`Platform üzerinden yeni bir şikayet iletildi.`) +
    `<table style="background:#fffbeb;border-radius:8px;padding:16px;margin:16px 0;width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">👤 Şikayet Eden</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.reporterType === "owner" ? "Hayvan Sahibi" : "Veteriner"}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">📋 Sebep</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.reason}</td></tr>
    </table>` +
    btn(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com"}/admin/disputes`, "Şikayeti İncele");

  return send("Yeni Şikayet – Veterineri Bul Admin", opts.to, template(body));
}

// ── 9. Değerlendirme onay/red bildirimi (veterinere) ─────────────────────────

export async function sendReviewActionEmail(opts: {
  to: string; vetName: string; approved: boolean; reviewerName?: string;
}) {
  const body = opts.approved
    ? h1("Değerlendirmeniz Yayınlandı ✓") +
      p(`Merhaba Dr. ${opts.vetName},`) +
      p(`${opts.reviewerName ? `<strong>${opts.reviewerName}</strong> tarafından` : "Size"} yapılan değerlendirme onaylandı ve profilinizde yayınlandı.`) +
      btn(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com"}/vet/profile`, "Profili Görüntüle")
    : h1("Değerlendirme Kaldırıldı") +
      p(`Merhaba Dr. ${opts.vetName},`) +
      p("Profilinize yapılan bir değerlendirme platform kurallarına aykırı bulunarak kaldırıldı.");

  return send(
    opts.approved ? "Yeni Değerlendirme Yayınlandı – Veterineri Bul" : "Değerlendirme Kaldırıldı – Veterineri Bul",
    opts.to,
    template(body)
  );
}

// ── 10. Duyuru ───────────────────────────────────────────────────────────────

export async function sendAnnouncementEmail(opts: {
  to: string;
  name: string;
  title: string;
  message: string;
}) {
  const body =
    h1(`📢 ${opts.title}`) +
    p(`Merhaba ${opts.name},`) +
    `<div style="background:#f9fafb;border-left:4px solid #1A6B4A;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
      <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">${opts.message}</p>
    </div>` +
    btn(`${APP_URL}`, "Platforma Git");

  return send(`${opts.title} – Veterineri Bul`, opts.to, template(body));
}

// ── Support: vet clicked "Canlı Desteğe Bağlan" → urgent email to admin ──────

export async function sendVetEscalationEmail(opts: {
  to: string;
  vetName: string;
  vetEmail: string;
  threadId: string;
  subject: string;
  threadUrl: string;
}) {
  const body =
    h1("⚠️ Veteriner Destek Bekliyor") +
    `<div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:18px;font-weight:800;color:#991b1b;">
        🩺 Dr. ${opts.vetName}
      </p>
      <p style="margin:4px 0 0;font-size:14px;color:#7f1d1d;">${opts.vetEmail}</p>
    </div>` +
    `<table style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:100px;">Konu</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.subject}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Thread ID</td><td style="padding:6px 0;font-family:monospace;font-size:13px;color:#374151;">${opts.threadId}</td></tr>
    </table>` +
    `<p style="margin:16px 0 0;font-size:14px;color:#374151;">Veteriner canlı destek talep etti. Lütfen en kısa sürede yanıt verin.</p>` +
    btn(opts.threadUrl, "Hemen Yanıtla →");

  return send(
    `⚠️ VETERİNER DESTEK BEKLİYOR: ${opts.vetName}`,
    opts.to,
    template(body)
  );
}

// ── Support: admin replied, user hasn't seen it (2-min fallback) ─────────────

export async function sendSupportReplyNotificationEmail(opts: {
  to: string;
  name: string;
  subject: string;
  threadUrl: string;
}) {
  const body =
    h1("Destek Yanıtı Bekliyor 💬") +
    p(`Merhaba ${opts.name},`) +
    p(`Destek ekibimiz <strong>"${opts.subject}"</strong> konulu talebinize yanıt verdi.`) +
    `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#1e40af;">💬 Mesajı görüntülemek ve yanıtlamak için aşağıdaki butona tıklayın.</p>
    </div>` +
    btn(opts.threadUrl, "Yanıtı Görüntüle");

  return send("Destek Yanıtı Bekliyor – Veterineri Bul", opts.to, template(body));
}

// ── Support: AI escalated → urgent admin alert ───────────────────────────────

export async function sendSupportHumanRequiredEmail(opts: {
  to: string;
  userName: string;
  userEmail: string;
  threadId: string;
  subject: string;
  message: string;
  threadUrl: string;
}) {
  const body =
    h1("🚨 Canlı Destek Talebi") +
    p(`<strong>${opts.userName}</strong> (${opts.userEmail}) canlı destek bekliyor.`) +
    `<table style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:120px;">Konu</td><td style="padding:6px 0;font-weight:600;color:#111827;">${opts.subject}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;vertical-align:top;">Son Mesaj</td><td style="padding:6px 0;color:#374151;">${opts.message.substring(0, 200)}${opts.message.length > 200 ? "…" : ""}</td></tr>
    </table>` +
    btn(opts.threadUrl, "Talebi Yanıtla");

  return send("🚨 Yeni Canlı Destek Talebi – Veterineri Bul", opts.to, template(body));
}

// ── Support: thread resolved + satisfaction survey ───────────────────────────

export async function sendSupportResolvedEmail(opts: {
  to: string;
  name: string;
  subject: string;
  threadUrl: string;
}) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com";
  const body =
    h1("Destek Talebiniz Çözüldü ✅") +
    p(`Merhaba ${opts.name},`) +
    p(`<strong>"${opts.subject}"</strong> konulu destek talebiniz ekibimiz tarafından çözüme kavuşturuldu.`) +
    `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 12px;font-weight:700;color:#166534;">Desteğimizi nasıl buldunuz?</p>
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0 6px 0 0;">
            <a href="${APP_URL}/support/feedback?thread=${opts.threadUrl}&rating=5" style="display:inline-block;background:#1A6B4A;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:14px;font-weight:600;">😊 Memnunum</a>
          </td>
          <td style="padding:0 6px;">
            <a href="${APP_URL}/support/feedback?thread=${opts.threadUrl}&rating=3" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:14px;font-weight:600;">😐 İdare Eder</a>
          </td>
          <td style="padding:0 0 0 6px;">
            <a href="${APP_URL}/support/feedback?thread=${opts.threadUrl}&rating=1" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:14px;font-weight:600;">😞 Memnun Değilim</a>
          </td>
        </tr>
      </table>
    </div>` +
    p('Yeni bir sorunuz olursa destek ekibimize ulaşabilirsiniz.') +
    btn(APP_URL, "Platforma Dön");

  return send("Destek Talebiniz Çözüldü – Veterineri Bul", opts.to, template(body));
}

// ── Account deletion confirmation ────────────────────────────────────────────

export async function sendAccountDeletionEmail(opts: {
  to: string;
  name: string;
}) {
  const body =
    h1("Hesabınız Silindi") +
    p(`Merhaba ${opts.name},`) +
    p("Hesabınız talebiniz doğrultusunda başarıyla silindi. Tüm kişisel verileriniz KVKK kapsamında anonimleştirildi.") +
    `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:700;color:#991b1b;">Silinenlerin özeti:</p>
      <ul style="margin:0;padding-left:20px;color:#7f1d1d;font-size:14px;line-height:1.8;">
        <li>Profil bilgileriniz anonimleştirildi</li>
        <li>Gelecekteki randevularınız iptal edildi</li>
        <li>Randevu geçmişi yasal zorunluluk gereği saklanmaktadır</li>
      </ul>
    </div>` +
    p("Bu işlem <strong>geri alınamaz</strong>. Hesabınıza bir daha erişim sağlanamaz.") +
    p('Herhangi bir sorunuz için <a href="mailto:destek@veterineribul.com" style="color:#1A6B4A;">destek@veterineribul.com</a> adresine yazabilirsiniz.');

  return send("Hesabınız silindi – Veterineri Bul", opts.to, template(body));
}

// ── 11. Görüşme / Muayene Özeti ─────────────────────────────────────────────

export async function sendConsultationSummaryEmail(opts: {
  to: string;
  ownerName: string;
  vetName: string;
  petName: string;
  petSpecies: string;
  appointmentId: string;
  appointmentType: "video" | "in_person";
  notes: {
    genel_durum:   string;
    bulgular:      string | null;
    oneri:         string | null;
    ilac_notu:     string | null;
    follow_up_date: string | null;
  } | null;
}) {
  const typeLabel = opts.appointmentType === "video" ? "📹 Video Görüşme" : "🏥 Klinikte Muayene";

  const statusMap: Record<string, { emoji: string; color: string; bg: string }> = {
    "iyi":    { emoji: "✅", color: "#166534", bg: "#f0fdf4" },
    "orta":   { emoji: "⚠️", color: "#92400e", bg: "#fffbeb" },
    "dikkat": { emoji: "🔴", color: "#991b1b", bg: "#fef2f2" },
  };
  const statusInfo = statusMap[opts.notes?.genel_durum ?? ""] ?? { emoji: "📋", color: "#374151", bg: "#f9fafb" };

  const infoRow = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:130px;">${label}</td><td style="padding:6px 0;font-weight:600;color:#111827;font-size:14px;">${value}</td></tr>`;

  const noteSection = (title: string, content: string | null, color = "#1f2937") =>
    content ? `
      <div style="margin-bottom:12px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${title}</p>
        <p style="margin:0;font-size:14px;color:${color};line-height:1.6;background:#f9fafb;padding:10px 14px;border-radius:8px;border-left:3px solid ${color};">${content}</p>
      </div>
    ` : "";

  const notesBlock = opts.notes ? `
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;">
      <div style="background:${statusInfo.bg};border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:20px;">${statusInfo.emoji}</span>
        <div>
          <p style="margin:0;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Genel Durum</p>
          <p style="margin:0;font-size:16px;font-weight:800;color:${statusInfo.color};">${opts.notes.genel_durum === "iyi" ? "İyi" : opts.notes.genel_durum === "orta" ? "Orta" : opts.notes.genel_durum === "dikkat" ? "Dikkat Gerektiriyor" : opts.notes.genel_durum}</p>
        </div>
      </div>
      ${noteSection("Bulgular", opts.notes.bulgular, "#1e40af")}
      ${noteSection("Öneri & Tedavi", opts.notes.oneri, "#166534")}
      ${noteSection("İlaç Önerisi", opts.notes.ilac_notu, "#7c3aed")}
      ${opts.notes.follow_up_date ? `
        <div style="background:#eff6ff;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:8px;margin-top:8px;">
          <span style="font-size:18px;">📅</span>
          <div>
            <p style="margin:0;font-size:12px;color:#6b7280;font-weight:600;">Takip Randevusu Önerisi</p>
            <p style="margin:0;font-size:14px;font-weight:700;color:#1d4ed8;">${new Date(opts.notes.follow_up_date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
      ` : ""}
    </div>
  ` : `<p style="margin:16px 0;font-size:14px;color:#6b7280;font-style:italic;">Bu görüşme için detaylı özet girilmedi.</p>`;

  const body =
    h1(`${opts.petName} Muayene Özeti`) +
    p(`Merhaba ${opts.ownerName},`) +
    p(`<strong>${opts.vetName}</strong> tarafından gerçekleştirilen muayene tamamlanmıştır.`) +
    `<table style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;width:100%;border-collapse:collapse;">
      ${infoRow("Hayvan", `${opts.petName}`)}
      ${infoRow("Görüşme Tipi", typeLabel)}
      ${infoRow("Tarih", new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }))}
      ${infoRow("Veteriner", opts.vetName)}
    </table>` +
    notesBlock +
    `<div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:14px;margin:16px 0;">
      <p style="margin:0;font-size:12px;color:#713f12;line-height:1.6;">
        ⚠️ <strong>Bilgilendirme:</strong> Bu özet bilgi amaçlıdır ve tıbbi belge niteliği taşımaz.
        İlaç kullanımı için yetkili veteriner hekiminizin fiziksel reçetesini alınız.
      </p>
    </div>` +
    btn(`${APP_URL}/owner/appointments`, "Randevularımı Görüntüle");

  return send(`${opts.petName} Muayene Özeti – ${opts.vetName}`, opts.to, template(body));
}
