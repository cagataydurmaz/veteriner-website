import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/support/threads/[id]   — load thread + all messages
 *                                   also marks last_seen_by_user_at / last_seen_by_admin_at
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const service = createServiceClient();

    const { data: me } = await service
      .from("users").select("role").eq("id", user.id).maybeSingle();

    const { data: thread, error } = await service
      .from("support_threads")
      .select(`
        id, subject, status, last_message_at, last_seen_by_user_at,
        last_seen_by_admin_at, admin_notification_pending,
        resolution_feedback_sent, created_at,
        user:users!user_id(id, full_name, email, avatar_url),
        messages:support_messages(
          id, sender_type, sender_id, content, metadata, created_at,
          sender:users!sender_id(full_name, avatar_url)
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (!thread) return NextResponse.json({ error: "Thread bulunamadı" }, { status: 404 });

    // Access control: owner can only see their own thread
    const threadUser = Array.isArray(thread.user) ? thread.user[0] : thread.user;
    if (me?.role !== "admin" && (threadUser as { id: string } | null)?.id !== user.id) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }

    // Update seen timestamps (fire-and-forget)
    if (me?.role === "admin") {
      service.from("support_threads")
        .update({ last_seen_by_admin_at: new Date().toISOString() })
        .eq("id", id).then(() => null);
    } else {
      service.from("support_threads")
        .update({
          last_seen_by_user_at: new Date().toISOString(),
          admin_notification_pending: false,
        })
        .eq("id", id).then(() => null);
    }

    // Sort messages by created_at ascending
    const messages = (thread.messages as { created_at: string }[] ?? [])
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return NextResponse.json({ thread: { ...thread, messages } });
  } catch (err) {
    console.error("support/threads/[id] GET:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
