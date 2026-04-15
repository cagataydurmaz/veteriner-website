import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSupportReplyNotificationEmail } from "@/lib/email";

/**
 * POST /api/cron/support-notify
 *
 * Called every 2 minutes (Vercel Cron / pg_cron / manual).
 * Finds support threads where:
 *   - admin sent a message 2+ minutes ago
 *   - user has NOT seen the message (last_seen_by_user_at < admin_message_sent_at)
 *   - email hasn't been sent yet (admin_notification_sent_at is NULL)
 *
 * Then sends "Destek Yanıtı Bekliyor" email to the user with a deep-link.
 *
 * Secured via CRON_SECRET env var.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com";

export async function POST(req: NextRequest) {
  // Auth: accept requests from Vercel Cron, pg_net webhook, or internal caller
  const secret = req.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  try {
    const service = createServiceClient();
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 min ago

    // Find pending notifications
    const { data: threads, error } = await service
      .from("support_threads")
      .select(`
        id, subject, admin_message_sent_at,
        last_seen_by_user_at,
        user:users!user_id(full_name, email)
      `)
      .eq("admin_notification_pending", true)
      .is("admin_notification_sent_at", null)
      .lt("admin_message_sent_at", cutoff)
      .neq("status", "resolved");

    if (error) throw error;
    if (!threads || threads.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let sent = 0;

    for (const thread of threads) {
      const user = (Array.isArray(thread.user) ? thread.user[0] : thread.user) as {
        full_name?: string;
        email?: string;
      } | null;

      // Skip if user has already seen the message
      const seenAt = thread.last_seen_by_user_at
        ? new Date(thread.last_seen_by_user_at as string).getTime()
        : 0;
      const adminMsgAt = thread.admin_message_sent_at
        ? new Date(thread.admin_message_sent_at as string).getTime()
        : 0;

      if (seenAt > adminMsgAt) {
        // User already read it — clear the pending flag, no email needed
        await service
          .from("support_threads")
          .update({ admin_notification_pending: false })
          .eq("id", thread.id);
        continue;
      }

      if (!user?.email) continue;

      const threadUrl = `${APP_URL}/owner/dashboard?support=open&thread=${thread.id}`;

      await sendSupportReplyNotificationEmail({
        to:        user.email,
        name:      user.full_name ?? "Kullanıcı",
        subject:   (thread.subject as string | null) ?? "Destek Talebi",
        threadUrl,
      });

      // Mark notification sent
      await service
        .from("support_threads")
        .update({ admin_notification_sent_at: new Date().toISOString() })
        .eq("id", thread.id);

      sent++;
    }

    return NextResponse.json({ processed: threads.length, sent });
  } catch (err) {
    console.error("cron/support-notify:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Vercel Cron config — runs every 2 minutes
export const config = {
  runtime: "nodejs",
};
