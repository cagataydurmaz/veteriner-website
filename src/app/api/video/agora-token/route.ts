import { NextRequest, NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-access-token";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    // Auth check — only logged-in users may request an Agora token
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { channelName, uid } = await req.json();

    if (!channelName) {
      return NextResponse.json({ error: "Kanal adı zorunludur" }, { status: 400 });
    }

    // Validate user is part of this appointment via video_room_id
    // channelName = video_room_id (UUID), NOT appointment.id
    const service = createServiceClient();
    const { data: apt } = await service
      .from("appointments")
      .select("id, owner_id, status, datetime, vet:veterinarians!appointments_vet_id_fkey(id, user_id)")
      .eq("video_room_id", channelName)
      .maybeSingle();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });

    // Only allow joining if appointment is confirmed
    if (apt.status !== "confirmed") {
      return NextResponse.json({ error: "Randevu henüz onaylanmamış" }, { status: 403 });
    }

    // Time-window check: allow 30 min early, up to 2 hours after start
    const aptTime = new Date(apt.datetime as string);
    const now = new Date();
    const minsUntil = (aptTime.getTime() - now.getTime()) / 60000;
    const minsSince = -minsUntil;
    if (minsUntil > 30) {
      return NextResponse.json({ error: "Randevuya henüz erken. En fazla 30 dakika önceden katılabilirsiniz." }, { status: 403 });
    }
    if (minsSince > 120) {
      return NextResponse.json({ error: "Randevu süresi dolmuş." }, { status: 403 });
    }

    const vetData = Array.isArray(apt.vet) ? apt.vet[0] : apt.vet;
    const isOwner = apt.owner_id === user.id;
    const isVet   = vetData?.user_id === user.id;
    if (!isOwner && !isVet) return NextResponse.json({ error: "Bu randevuya erişim yetkiniz yok" }, { status: 403 });

    // Layer 3 mutex: mark vet as busy the moment they join the video room.
    // This removes them from the "Online Now" listing for the duration of the call.
    // is_busy is reset to false by /api/appointments/complete when the vet ends the call.
    // If complete is never called, the recompute-buffer-locks cron self-heals within 5 min
    // once the appointment window passes.
    if (isVet && vetData?.id) {
      void service
        .from("veterinarians")
        .update({ is_busy: true })
        .eq("id", vetData.id)
        .then(({ error: busyErr }) => {
          if (busyErr) console.error("[agora-token] is_busy=true set failed for vet", vetData.id, busyErr);
        });
    }

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return NextResponse.json({ error: "Agora yapılandırılmamış" }, { status: 500 });
    }

    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid || 0,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    return NextResponse.json({ token, appId, role: isVet ? "vet" : "owner" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Token oluşturulamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
