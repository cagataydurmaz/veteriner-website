import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

/**
 * POST /api/video/create-room
 *
 * Ensures a stable Agora channel name exists for a video appointment.
 * Idempotent: returns the existing channel name if already set.
 *
 * Body: { appointmentId: string }
 * Returns: { roomId: string, roomUrl: string }
 *
 * roomId  = Agora channel name (UUID stored in appointments.video_room_id)
 * roomUrl = full URL the client should navigate to
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await request.json();
    const { appointmentId } = body as { appointmentId: string };

    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId gerekli" }, { status: 400 });
    }

    // Fetch appointment and verify caller is owner or vet
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select(
        "id, owner_id, type, video_room_id, video_room_url, vet:veterinarians(user_id)"
      )
      .eq("id", appointmentId)
      .maybeSingle();

    if (fetchError || !appointment) {
      return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    }

    const vetRaw = appointment.vet as unknown as { user_id: string } | { user_id: string }[] | null;
    const vetUserId = (Array.isArray(vetRaw) ? vetRaw[0] : vetRaw)?.user_id;
    const isOwner = appointment.owner_id === user.id;
    const isVet = vetUserId === user.id;

    if (!isOwner && !isVet) {
      return NextResponse.json({ error: "Bu randevuya erişim yetkiniz yok" }, { status: 403 });
    }

    if (appointment.type !== "video") {
      return NextResponse.json(
        { error: "Bu randevu video görüşme türünde değil" },
        { status: 400 }
      );
    }

    // If a channel already exists, return it
    if (appointment.video_room_id) {
      return NextResponse.json({
        roomId: appointment.video_room_id,
        roomUrl: appointment.video_room_url,
      });
    }

    // Generate a new Agora channel name (UUID)
    const channelName = randomUUID();
    const roomUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com"}/video/${channelName}?appointment=${appointmentId}`;

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        video_room_id: channelName,
        video_room_url: roomUrl,
      })
      .eq("id", appointmentId);

    if (updateError) {
      console.error("video_room_id kayıt hatası:", updateError);
      return NextResponse.json({ error: "Oda oluşturulamadı" }, { status: 500 });
    }

    return NextResponse.json({ roomId: channelName, roomUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Beklenmeyen hata";
    console.error("create-room hatası:", msg);
    return NextResponse.json({ error: "Video odası oluşturulamadı" }, { status: 500 });
  }
}
