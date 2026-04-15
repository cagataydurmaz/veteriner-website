import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendVetEscalationEmail } from "@/lib/email";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "veterineribul@gmail.com";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com";

/**
 * POST /api/support/threads/[id]/escalate
 *
 * Vet clicks "Canlı Desteğe Bağlan":
 *  1. Sets thread status → human_required
 *  2. Inserts a system message
 *  3. Sends urgent email to admin: "⚠️ VETERİNER DESTEK BEKLİYOR: [Vet Name]"
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

    // Verify thread belongs to this vet
    const { data: thread } = await service
      .from("support_threads")
      .select("id, status, user_id, subject, user:users!user_id(full_name, email)")
      .eq("id", threadId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!thread) return NextResponse.json({ error: "Thread bulunamadı" }, { status: 404 });
    if (thread.status === "resolved")
      return NextResponse.json({ error: "Kapalı talep" }, { status: 400 });
    if (thread.status === "human_required")
      return NextResponse.json({ ok: true, already_escalated: true });

    // Update status
    await service
      .from("support_threads")
      .update({ status: "human_required" })
      .eq("id", threadId);

    // Insert handover system message
    await service.from("support_messages").insert({
      thread_id:   threadId,
      sender_type: "ai",
      content:     "🔄 Canlı destek ekibine bağlanıyorsunuz. Ekibimiz en kısa sürede yanıt verecektir. Mesajlarınız iletildi.",
      metadata:    { system: true, type: "escalated" },
    });

    // Urgent email to admin
    const threadUser = Array.isArray(thread.user) ? thread.user[0] : thread.user;
    const vetData = threadUser as { full_name?: string; email?: string } | null;

    sendVetEscalationEmail({
      to:        ADMIN_EMAIL,
      vetName:   vetData?.full_name ?? "Veteriner",
      vetEmail:  vetData?.email ?? "",
      threadId,
      subject:   (thread.subject as string | null) ?? "Teknik Destek",
      threadUrl: `${APP_URL}/admin/support/${threadId}`,
    }).catch((err) => console.error("[support/threads/escalate] email failed:", err));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("support/escalate POST:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
