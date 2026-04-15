import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendAnnouncementEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Admin yetkisi gerekli" }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // Service client for all writes — admin actions must never be blocked by RLS
    const service = createServiceClient();

    // ── CREATE ──────────────────────────────────────────────────
    if (action === "create") {
      const { title, body: content, target_role, send_now } = body;

      if (!title?.trim() || !content?.trim()) {
        return NextResponse.json({ error: "Başlık ve içerik zorunludur" }, { status: 400 });
      }

      if (!["all", "owner", "vet"].includes(target_role)) {
        return NextResponse.json({ error: "Geçersiz hedef kitle" }, { status: 400 });
      }

      const now = new Date().toISOString();

      const { data: announcement, error } = await service
        .from("announcements")
        .insert({
          title,
          body: content,
          target_role,
          sent_at: send_now ? now : null,
          created_by: user.id,
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      // If sending immediately, also fan out to notifications table
      if (send_now) {
        await fanOutNotifications(service, announcement.id, title, content, target_role);
      }

      return NextResponse.json({ announcement, message: send_now ? "Duyuru gönderildi" : "Taslak kaydedildi" });
    }

    // ── SEND (existing draft) ────────────────────────────────────
    if (action === "send") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 });

      const { data: ann, error: fetchError } = await supabase
        .from("announcements")
        .select("id, title, body, target_role, sent_at")
        .eq("id", id)
        .maybeSingle();

      if (fetchError || !ann) return NextResponse.json({ error: "Duyuru bulunamadı" }, { status: 404 });
      if (ann.sent_at) return NextResponse.json({ error: "Bu duyuru zaten gönderildi" }, { status: 409 });

      const now = new Date().toISOString();
      const { error } = await service
        .from("announcements")
        .update({ sent_at: now })
        .eq("id", id);

      if (error) throw error;

      await fanOutNotifications(service, id, ann.title, ann.body, ann.target_role);

      return NextResponse.json({ message: "Duyuru gönderildi" });
    }

    // ── DELETE ───────────────────────────────────────────────────
    if (action === "delete") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 });

      const { error } = await service.from("announcements").delete().eq("id", id);
      if (error) throw error;

      return NextResponse.json({ message: "Duyuru silindi" });
    }

    return NextResponse.json({ error: "Bilinmeyen işlem" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("announcement error:", msg);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}

// Fan out announcement to users as in-app notifications + email
async function fanOutNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  announcementId: string,
  title: string,
  content: string,
  targetRole: string
) {
  try {
    let query = supabase.from("users").select("id, email, full_name");
    if (targetRole !== "all") {
      query = query.eq("role", targetRole);
    }

    const { data: users } = await query;
    if (!users || users.length === 0) return;

    const notifications = users.map((u: { id: string }) => ({
      user_id: u.id,
      type: "announcement",
      title,
      message: content.length > 160 ? content.slice(0, 157) + "…" : content,
      link: "/announcements/" + announcementId,
      is_read: false,
    }));

    // Insert in batches of 100 to avoid payload limits
    for (let i = 0; i < notifications.length; i += 100) {
      await supabase.from("notifications").insert(notifications.slice(i, i + 100));
    }

    // Email fan-out (best-effort, fire-and-forget)
    for (const u of users as { id: string; email?: string; full_name?: string }[]) {
      if (u.email) {
        sendAnnouncementEmail({
          to: u.email,
          name: u.full_name || "Kullanıcı",
          title,
          message: content,
        }).catch((err) => console.error("[admin/announcement] email failed:", err));
      }
    }
  } catch (e) {
    console.error("fanOut error:", e);
    // Non-fatal — announcement was saved, just notifications failed
  }
}
