import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/support/threads/[id]/seen
 *
 * Marks the thread as seen by the current user.
 * Clears admin_notification_pending if caller is not admin.
 */

export async function POST(
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

    if (me?.role === "admin") {
      await service
        .from("support_threads")
        .update({ last_seen_by_admin_at: new Date().toISOString() })
        .eq("id", id);
    } else {
      await service
        .from("support_threads")
        .update({
          last_seen_by_user_at:       new Date().toISOString(),
          admin_notification_pending: false,
        })
        .eq("id", id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("support/seen POST:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
