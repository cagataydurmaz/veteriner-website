import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type ServiceType = "clinic" | "video" | "both";

export interface SlotTemplate {
  id?:                    string;
  day_of_week:            number;   // 0=Sun … 6=Sat
  start_time:             string;   // "09:00"
  end_time:               string;   // "17:00"
  service_type:           ServiceType;
  slot_duration_minutes:  number;
  is_active:              boolean;
}

/**
 * GET /api/vet/schedule
 * Returns the calling vet's availability_slots (weekly template).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });

  const { data, error } = await supabase
    .from("availability_slots")
    .select("id, day_of_week, start_time, end_time, service_type, slot_duration_minutes, is_active")
    .eq("vet_id", vet.id)
    .order("day_of_week")
    .order("start_time");

  if (error) {
    console.error("[vet/schedule GET]", error);
    return NextResponse.json({ error: "Takvim yüklenemedi" }, { status: 500 });
  }

  return NextResponse.json({ slots: data ?? [] });
}

/**
 * POST /api/vet/schedule
 * Replaces the vet's entire weekly schedule.
 * Body: { slots: SlotTemplate[], slotDurationMinutes: number }
 *
 * Deletes ALL existing availability_slots for this vet, then bulk-inserts
 * the new ones. Atomic via transaction-like sequential ops.
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

  let body: { slots: SlotTemplate[]; slotDurationMinutes?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }

  const { slots, slotDurationMinutes = 30 } = body;

  if (!Array.isArray(slots))
    return NextResponse.json({ error: "slots dizisi zorunludur" }, { status: 400 });

  // Validate each slot
  for (const s of slots) {
    if (s.day_of_week < 0 || s.day_of_week > 6)
      return NextResponse.json({ error: `Geçersiz day_of_week: ${s.day_of_week}` }, { status: 400 });
    if (!["clinic", "video", "both"].includes(s.service_type))
      return NextResponse.json({ error: `Geçersiz service_type: ${s.service_type}` }, { status: 400 });
    if (s.start_time >= s.end_time)
      return NextResponse.json({ error: "start_time, end_time'dan önce olmalı" }, { status: 400 });
  }

  // ── 1. Delete all existing slots ────────────────────────────────────────────
  const { error: delErr } = await serviceSupabase
    .from("availability_slots")
    .delete()
    .eq("vet_id", vet.id);

  if (delErr) {
    console.error("[vet/schedule POST] delete error:", delErr);
    return NextResponse.json({ error: "Takvim güncellenemedi" }, { status: 500 });
  }

  // ── 2. Bulk-insert new slots ─────────────────────────────────────────────────
  if (slots.length > 0) {
    const rows = slots.map((s) => ({
      vet_id:                 vet.id,
      day_of_week:            s.day_of_week,
      start_time:             s.start_time,
      end_time:               s.end_time,
      service_type:           s.service_type,
      slot_duration_minutes:  slotDurationMinutes,
      is_active:              true,
    }));

    const { error: insertErr } = await serviceSupabase
      .from("availability_slots")
      .insert(rows);

    if (insertErr) {
      console.error("[vet/schedule POST] insert error:", insertErr);
      return NextResponse.json({ error: "Takvim kaydedilemedi" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, saved: slots.length });
}
