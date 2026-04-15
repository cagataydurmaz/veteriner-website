import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { filterMessage, BLOCK_REASON_LABELS } from "@/lib/content-filter";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { appointmentId, content } = await req.json();
    if (!appointmentId || !content?.trim()) {
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
    }

    // Rate limit: 50 messages per day per user
    const rateCheck = await checkRateLimit(user.id, "message");
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    // Verify user is a participant in this appointment
    const { data: apt } = await supabase
      .from("appointments")
      .select("id, owner_id, vet_id, vet:veterinarians(user_id)")
      .eq("id", appointmentId)
      .maybeSingle();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });

    const vetUserId = Array.isArray(apt.vet) ? apt.vet[0]?.user_id : (apt.vet as { user_id: string } | null)?.user_id;
    const isOwner = user.id === apt.owner_id;
    const isVet = user.id === vetUserId;

    if (!isOwner && !isVet) {
      return NextResponse.json({ error: "Bu randevuya erişim izniniz yok" }, { status: 403 });
    }

    const receiverId = isOwner ? vetUserId : apt.owner_id;
    if (!receiverId) {
      return NextResponse.json({ error: "Alıcı bulunamadı" }, { status: 400 });
    }

    // Run content filter
    const filterResult = filterMessage(content);
    if (filterResult.blocked) {
      // Log the attempt
      await supabase.from("blocked_messages").insert({
        appointment_id: appointmentId,
        sender_id: user.id,
        content: content,
        block_reason: filterResult.reason,
      });

      return NextResponse.json(
        {
          blocked: true,
          error: `İletişim bilgileri platform dışında paylaşılamaz. Lütfen platform üzerinden iletişim kurun.`,
          reason: BLOCK_REASON_LABELS[filterResult.reason] || filterResult.reason,
        },
        { status: 422 }
      );
    }

    // Insert message
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        appointment_id: appointmentId,
        sender_id: user.id,
        receiver_id: receiverId,
        content: content.trim(),
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ message });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("message send error:", msg);
    return NextResponse.json({ error: "Mesaj gönderilemedi" }, { status: 500 });
  }
}
