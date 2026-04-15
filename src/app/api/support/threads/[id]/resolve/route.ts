import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSupportResolvedEmail } from "@/lib/email";

/**
 * POST /api/support/threads/[id]/resolve
 *
 * Admin-only: marks thread as resolved, sends satisfaction survey email to user.
 */

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const service = createServiceClient();

    const { data: me } = await service
      .from("users").select("role").eq("id", user.id).maybeSingle();
    if (me?.role !== "admin")
      return NextResponse.json({ error: "Sadece adminler kapatabilir" }, { status: 403 });

    const { data: thread } = await service
      .from("support_threads")
      .select("id, status, subject, resolution_feedback_sent, user:users!user_id(full_name, email)")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread) return NextResponse.json({ error: "Thread bulunamadı" }, { status: 404 });
    if (thread.status === "resolved")
      return NextResponse.json({ error: "Zaten kapatılmış" }, { status: 400 });

    // Add system message
    await service.from("support_messages").insert({
      thread_id:   threadId,
      sender_type: "admin",
      sender_id:   user.id,
      content:     "✅ Bu destek talebi çözüme kavuşturuldu ve kapatıldı. Desteğimizden memnun kaldıysanız değerlendirmenizi paylaşabilirsiniz.",
      metadata:    { system: true, type: "resolved" },
    });

    // Update thread
    await service
      .from("support_threads")
      .update({
        status:                  "resolved",
        resolved_at:             new Date().toISOString(),
        resolution_feedback_sent: true,
        admin_notification_pending: false,
      })
      .eq("id", threadId);

    // Send satisfaction email to user (fire-and-forget)
    const threadUser = Array.isArray(thread.user) ? thread.user[0] : thread.user;
    const userData = threadUser as { full_name?: string; email?: string } | null;
    if (userData?.email && !thread.resolution_feedback_sent) {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com";
      sendSupportResolvedEmail({
        to:        userData.email,
        name:      userData.full_name ?? "Kullanıcı",
        subject:   (thread.subject as string | null) ?? "Destek Talebi",
        threadUrl: `${APP_URL}/owner/dashboard?support=open`,
      }).catch((err) => console.error("[support/threads/resolve] email failed:", err));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("support/resolve POST:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
