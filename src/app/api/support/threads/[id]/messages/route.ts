import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  sendSupportHumanRequiredEmail,
  sendSupportReplyNotificationEmail,
} from "@/lib/email";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "veterineribul@gmail.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com";

/**
 * POST /api/support/threads/[id]/messages
 *
 * Sends a message in a support thread.
 * - sender_type=user  → normal user message (triggers AI if status=ai_handling)
 * - sender_type=admin → admin reply; sets admin_notification_pending=true via DB trigger
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const service = createServiceClient();

    const { data: me } = await service
      .from("users").select("role, full_name, email").eq("id", user.id).maybeSingle();

    const body = await req.json().catch(() => ({}));
    const content: string = (body.content ?? "").trim();
    if (!content) return NextResponse.json({ error: "Mesaj boş olamaz" }, { status: 400 });

    // Load thread + verify access
    const { data: thread } = await service
      .from("support_threads")
      .select("id, status, user_id, subject, user:users!user_id(full_name, email)")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread) return NextResponse.json({ error: "Thread bulunamadı" }, { status: 404 });
    if (thread.status === "resolved")
      return NextResponse.json({ error: "Bu destek talebi kapatılmıştır" }, { status: 400 });

    const isAdmin = me?.role === "admin";
    const threadUser = Array.isArray(thread.user) ? thread.user[0] : thread.user;

    // Non-admin can only message their own threads
    if (!isAdmin && thread.user_id !== user.id) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }

    const senderType = isAdmin ? "admin" : "user";

    // Insert message — DB trigger handles admin_notification_pending
    const { data: msg, error: msgErr } = await service
      .from("support_messages")
      .insert({
        thread_id:   threadId,
        sender_type: senderType,
        sender_id:   user.id,
        content,
      })
      .select()
      .single();

    if (msgErr) throw msgErr;

    // Admin reply → immediate email fallback is handled by cron/support-notify (2-min delay)
    // But also: if thread was ai_handling, switch to human_required when admin first replies
    if (isAdmin && thread.status === "ai_handling") {
      await service
        .from("support_threads")
        .update({ status: "human_required" })
        .eq("id", threadId);
    }

    // User message on human_required thread → notify admin via email (fire-and-forget)
    if (!isAdmin && thread.status === "human_required") {
      const threadUserData = threadUser as { full_name?: string; email?: string } | null;
      sendSupportHumanRequiredEmail({
        to:           ADMIN_EMAIL,
        userName:     threadUserData?.full_name ?? "Kullanıcı",
        userEmail:    threadUserData?.email ?? "",
        threadId,
        subject:      (thread.subject as string | null) ?? "Destek Talebi",
        message:      content,
        threadUrl:    `${APP_URL}/admin/support/${threadId}`,
      }).catch((err) => console.error("[support/threads/messages] email failed:", err));
    }

    return NextResponse.json({ message: msg });
  } catch (err) {
    console.error("support messages POST:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
