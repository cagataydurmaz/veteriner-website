/**
 * Cron job failure alerting.
 * Call this in the catch block of any cron route.
 * Sends an alert email to ADMIN_ALERT_EMAIL and always logs to console.
 */
export async function alertCronFailure(cronName: string, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[cron:${cronName}]`, msg);

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Veterineri Bul <bildirim@veterineribul.com>",
      to: adminEmail,
      subject: `⚠️ Cron Hatası: ${cronName}`,
      html: `
        <p style="font-family:sans-serif;">
          <strong>Cron:</strong> ${cronName}<br>
          <strong>Hata:</strong> ${msg}<br>
          <strong>Zaman:</strong> ${new Date().toISOString()}
        </p>
      `,
    });
  } catch {
    // alert itself failed — at least we logged above
  }
}
