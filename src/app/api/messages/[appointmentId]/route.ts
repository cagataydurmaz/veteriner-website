import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const { appointmentId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    // Verify participant
    const { data: apt } = await supabase
      .from("appointments")
      .select("id, owner_id, vet:veterinarians(user_id)")
      .eq("id", appointmentId)
      .single();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });

    const vetUserId = Array.isArray(apt.vet) ? apt.vet[0]?.user_id : (apt.vet as { user_id: string } | null)?.user_id;
    const isParticipant = user.id === apt.owner_id || user.id === vetUserId;
    if (!isParticipant) return NextResponse.json({ error: "Erişim izniniz yok" }, { status: 403 });

    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, is_read, created_at")
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: true });

    // Mark unread messages as read
    const unreadIds = (messages || [])
      .filter(m => m.receiver_id === user.id && !m.is_read)
      .map(m => m.id);

    if (unreadIds.length > 0) {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .in("id", unreadIds);
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("messages fetch error:", msg);
    return NextResponse.json({ error: "Mesajlar alınamadı" }, { status: 500 });
  }
}
