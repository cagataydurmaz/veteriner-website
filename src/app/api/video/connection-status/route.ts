import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST  — record connect / disconnect event
// GET   — query current connection state for an appointment
export async function POST(req: NextRequest) {
  try {
    const supabase        = await createClient();
    const serviceSupabase = await createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { appointmentId, status } = await req.json() as {
      appointmentId: string;
      status: "connected" | "disconnected";
    };

    if (!appointmentId || !["connected", "disconnected"].includes(status)) {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    // Determine role (vet or owner)
    const { data: apt } = await serviceSupabase
      .from("appointments")
      .select(`
        id, owner_id, vet_id, datetime, type,
        vet:veterinarians!vet_id(user_id)
      `)
      .eq("id", appointmentId)
      .maybeSingle();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });

    type VetRef = { user_id: string };
    const vetUserId = Array.isArray(apt.vet)
      ? (apt.vet[0] as VetRef)?.user_id
      : (apt.vet as VetRef | null)?.user_id;

    const role: "vet" | "owner" = user.id === vetUserId ? "vet" : "owner";

    if (user.id !== apt.owner_id && user.id !== vetUserId) {
      return NextResponse.json({ error: "Bu randevuya erişim izniniz yok" }, { status: 403 });
    }

    if (status === "connected") {
      // Upsert connection record (one active per user per appointment)
      await serviceSupabase
        .from("video_connections")
        .upsert(
          {
            appointment_id:  appointmentId,
            user_id:         user.id,
            role,
            connected_at:    new Date().toISOString(),
            disconnected_at: null,
          },
          { onConflict: "appointment_id,user_id" }
        );
    } else {
      // Mark disconnected
      await serviceSupabase
        .from("video_connections")
        .update({ disconnected_at: new Date().toISOString() })
        .eq("appointment_id", appointmentId)
        .eq("user_id", user.id)
        .is("disconnected_at", null);
    }

    // ── 5-min vet no-show check ────────────────────────────────────────────
    if (status === "connected" && role === "owner") {
      const aptTime     = new Date(apt.datetime as string);
      const now         = new Date();
      const minutesSinceStart = (now.getTime() - aptTime.getTime()) / 60000;

      if (minutesSinceStart >= 5 && minutesSinceStart < 15) {
        // Check if vet connected
        const { data: vetConn } = await serviceSupabase
          .from("video_connections")
          .select("id, notified_no_connect")
          .eq("appointment_id", appointmentId)
          .eq("role", "vet")
          .is("disconnected_at", null)
          .maybeSingle();

        if (!vetConn) {
          // Notify owner that vet hasn't connected yet
          const { data: ownerData } = await serviceSupabase
            .from("users")
            .select("phone, full_name")
            .eq("id", apt.owner_id)
            .maybeSingle();

          const alreadyNotified = await serviceSupabase
            .from("video_connections")
            .select("id")
            .eq("appointment_id", appointmentId)
            .eq("notified_no_connect", true)
            .limit(1);

          if (ownerData?.phone && !alreadyNotified.data?.length) {
            const message =
              `🐾 Veterineri Bul — Video Görüşme\n\n` +
              `Merhaba ${ownerData.full_name},\n\n` +
              `Veterineriniz henüz video görüşmeye bağlanmadı. ` +
              `Lütfen birkaç dakika daha bekleyin. ` +
              `Bağlanamazsa randevunuz yeniden planlanacaktır.\n\nVeterineri Bul 🐾`;

            const { fetchWithTimeout } = await import("@/lib/fetchWithTimeout");
            await fetchWithTimeout(
              `${process.env.ILETI_MERKEZI_API_URL}/message/send`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.ILETI_MERKEZI_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ to: ownerData.phone, channel: "whatsapp", message }),
              },
              10_000 // 10 second timeout
            ).catch(() => {});

            // Mark as notified (use a placeholder row)
            await serviceSupabase
              .from("video_connections")
              .insert({
                appointment_id:      appointmentId,
                user_id:             apt.owner_id,
                role:                "owner",
                connected_at:        new Date().toISOString(),
                notified_no_connect: true,
              })
              .select()
              .maybeSingle();
          }
        }
      }

      // ── 10-min no-vet → offer reschedule/refund ──────────────────────────
      if (minutesSinceStart >= 10) {
        const { data: vetConn10 } = await serviceSupabase
          .from("video_connections")
          .select("id")
          .eq("appointment_id", appointmentId)
          .eq("role", "vet")
          .is("disconnected_at", null)
          .maybeSingle();

        if (!vetConn10) {
          return NextResponse.json({
            connected: true,
            vetConnected: false,
            offerReschedule: true,
            message: "Veterineriniz 10 dakikadır bağlanmadı. Randevunuzu yeniden planlamak veya iade almak ister misiniz?",
          });
        }
      }
    }

    return NextResponse.json({ success: true, role });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("video connection-status error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase        = await createClient();
    const serviceSupabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const appointmentId = searchParams.get("appointmentId");

    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId gerekli" }, { status: 400 });
    }

    // Verify the requesting user is a participant in this appointment
    const { data: aptCheck } = await serviceSupabase
      .from("appointments")
      .select("owner_id, vet:veterinarians!vet_id(user_id)")
      .eq("id", appointmentId)
      .maybeSingle();

    if (!aptCheck) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });

    type VetRef = { user_id: string };
    const vetUserId = Array.isArray(aptCheck.vet)
      ? (aptCheck.vet[0] as VetRef)?.user_id
      : (aptCheck.vet as VetRef | null)?.user_id;

    if (user.id !== aptCheck.owner_id && user.id !== vetUserId) {
      return NextResponse.json({ error: "Bu randevuya erişim izniniz yok" }, { status: 403 });
    }

    const { data: connections } = await serviceSupabase
      .from("video_connections")
      .select("role, connected_at, disconnected_at")
      .eq("appointment_id", appointmentId)
      .is("disconnected_at", null);

    const vetConnected   = (connections || []).some((c) => c.role === "vet");
    const ownerConnected = (connections || []).some((c) => c.role === "owner");

    const { data: apt } = await serviceSupabase
      .from("appointments")
      .select("datetime")
      .eq("id", appointmentId)
      .maybeSingle();

    const minutesSinceStart = apt?.datetime
      ? (Date.now() - new Date(apt.datetime).getTime()) / 60000
      : 0;

    return NextResponse.json({
      vetConnected,
      ownerConnected,
      minutesSinceStart: Math.max(0, minutesSinceStart),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
