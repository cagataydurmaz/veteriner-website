import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET  /api/support/threads        — list caller's threads (owner/vet)
 *                                    or ALL threads if admin
 * POST /api/support/threads        — open a new thread
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const service = createServiceClient();

    // Determine caller role
    const { data: me } = await service
      .from("users").select("role").eq("id", user.id).maybeSingle();

    let query = service
      .from("support_threads")
      .select(`
        id, subject, status, last_message_at, last_seen_by_user_at,
        admin_notification_pending, created_at,
        user:users!user_id(id, full_name, email, avatar_url),
        messages:support_messages(id)
      `)
      .order("last_message_at", { ascending: false });

    if (me?.role !== "admin") {
      query = query.eq("user_id", user.id);
    }

    const { data: threads, error } = await query;
    if (error) throw error;

    return NextResponse.json({ threads });
  } catch (err) {
    console.error("support/threads GET:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const subject: string = body.subject?.trim() || "Destek Talebi";

    const service = createServiceClient();

    // Check for existing open thread to prevent duplicates
    const { data: existing } = await service
      .from("support_threads")
      .select("id, status")
      .eq("user_id", user.id)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ thread: existing, reused: true });
    }

    const { data: thread, error } = await service
      .from("support_threads")
      .insert({ user_id: user.id, subject, status: "ai_handling" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ thread, reused: false }, { status: 201 });
  } catch (err) {
    console.error("support/threads POST:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
