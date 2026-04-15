import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/vet/blocked-slots?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns the calling vet's blocked_slots in the given date range.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  let query = supabase
    .from("blocked_slots")
    .select("id, blocked_date, start_time, end_time, reason")
    .eq("vet_id", vet.id)
    .order("blocked_date")
    .order("start_time");

  if (from) query = query.gte("blocked_date", from);
  if (to)   query = query.lte("blocked_date", to);

  const { data, error } = await query;

  if (error) {
    console.error("[vet/blocked-slots GET]", error);
    return NextResponse.json({ error: "Bloke günler yüklenemedi" }, { status: 500 });
  }

  return NextResponse.json({ blocked: data ?? [] });
}

/**
 * POST /api/vet/blocked-slots
 * Adds a blocked slot.
 * Body: { blocked_date: "YYYY-MM-DD", start_time?: "HH:MM", end_time?: "HH:MM", reason?: string }
 * If start_time/end_time are omitted → full-day block.
 */
export async function POST(req: NextRequest) {
  const supabase        = await createClient();
  const serviceSupabase = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });

  let body: {
    blocked_date: string;
    start_time?:  string;
    end_time?:    string;
    reason?:      string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }

  const { blocked_date, start_time, end_time, reason } = body;

  if (!blocked_date || !/^\d{4}-\d{2}-\d{2}$/.test(blocked_date))
    return NextResponse.json({ error: "blocked_date YYYY-MM-DD formatında olmalı" }, { status: 400 });

  if (start_time && end_time && start_time >= end_time)
    return NextResponse.json({ error: "start_time, end_time'dan önce olmalı" }, { status: 400 });

  // ── Retroactive conflict check ───────────────────────────────────────────
  // Reject the block if there are already CONFIRMED or PENDING appointments
  // that fall inside the requested window. The vet must cancel those first.
  // All comparisons use explicit Istanbul offset (+03:00) so the timestamptz
  // query aligns with local time regardless of the server's UTC clock.
  const blockStart = start_time
    ? `${blocked_date}T${start_time}+03:00`
    : `${blocked_date}T00:00:00+03:00`;
  const blockEnd = end_time
    ? `${blocked_date}T${end_time}+03:00`
    : `${blocked_date}T23:59:59+03:00`;

  const { count: conflictCount, error: conflictErr } = await serviceSupabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("vet_id", vet.id)
    .in("status", ["pending", "confirmed"])
    .gte("datetime", blockStart)
    .lt("datetime", blockEnd);

  if (conflictErr) {
    console.error("[vet/blocked-slots POST] conflict check failed:", conflictErr);
    // Fail open — don't block the vet on a check error, but log it
  } else if (conflictCount && conflictCount > 0) {
    return NextResponse.json(
      {
        error: `Bu saatte zaten ${conflictCount} hastanız var — önce ilgili randevuları iptal edin.`,
        conflictCount,
      },
      { status: 409 }
    );
  }

  const { data, error } = await serviceSupabase
    .from("blocked_slots")
    .insert({
      vet_id:       vet.id,
      blocked_date,
      start_time:   start_time ?? null,
      end_time:     end_time   ?? null,
      reason:       reason     ?? null,
    })
    .select("id, blocked_date, start_time, end_time, reason")
    .single();

  if (error) {
    console.error("[vet/blocked-slots POST]", error);
    return NextResponse.json({ error: "Bloke gün eklenemedi" }, { status: 500 });
  }

  return NextResponse.json({ blocked: data });
}

/**
 * DELETE /api/vet/blocked-slots?id=<uuid>
 */
export async function DELETE(req: NextRequest) {
  const supabase        = await createClient();
  const serviceSupabase = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id parametresi zorunludur" }, { status: 400 });

  const { error } = await serviceSupabase
    .from("blocked_slots")
    .delete()
    .eq("id", id)
    .eq("vet_id", vet.id); // safety: can only delete own rows

  if (error) {
    console.error("[vet/blocked-slots DELETE]", error);
    return NextResponse.json({ error: "Bloke gün silinemedi" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
