import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users").select("role").eq("id", user.id).maybeSingle();
    if (userData?.role !== "admin") return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

    const { data } = await supabase
      .from("data_breach_notifications")
      .select("*, reporter:reported_by(full_name)")
      .order("created_at", { ascending: false });

    return NextResponse.json({ breaches: data || [] });
  } catch {
    return NextResponse.json({ error: "Hata" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users").select("role").eq("id", user.id).maybeSingle();
    if (userData?.role !== "admin") return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

    const { description, severity, affected_users_count } = await req.json();
    if (!description || !severity) {
      return NextResponse.json({ error: "Açıklama ve önem derecesi zorunludur" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("data_breach_notifications")
      .insert({ description, severity, affected_users_count, reported_by: user.id })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ breach: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users").select("role").eq("id", user.id).maybeSingle();
    if (userData?.role !== "admin") return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

    const { id, status, resolution_notes } = await req.json();
    if (!id || !status) return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });

    const updates: Record<string, unknown> = { status, resolution_notes };
    if (status === "resolved" || status === "notified") {
      updates.resolved_at = new Date().toISOString();
    }

    await supabase
      .from("data_breach_notifications")
      .update(updates)
      .eq("id", id);

    return NextResponse.json({ updated: true });
  } catch {
    return NextResponse.json({ error: "Hata" }, { status: 500 });
  }
}
