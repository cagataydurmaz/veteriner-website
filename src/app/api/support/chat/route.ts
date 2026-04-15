import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { sendSupportHumanRequiredEmail } from "@/lib/email";

/**
 * POST /api/support/chat
 *
 * AI first-responder for support threads.
 * - Answers common platform questions automatically.
 * - If AI cannot help → status → human_required → urgent email to admin.
 *
 * Body: { threadId: string, message: string }
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "veterineribul@gmail.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://veterineribul.com";

const SYSTEM_PROMPT = `Sen Veterineri Bul platformunun yapay zeka destek asistanısın. Kullanıcılara kibarca ve Türkçe yardım ediyorsun.

Platform hakkında bilmen gerekenler:
- Kullanıcılar (pet sahipleri) veteriner arayabilir, online/klinik/acil randevu alabilir
- Online ve acil randevularda ödeme Iyzico üzerinden kredi kartıyla alınır ve escrow'da tutulur
- Randevu >24 saat öncesi iptal edilirse tam iade yapılır; 24 saat içinde iptal iade yoktur (6502 sayılı kanun)
- Veterinerler siteye başvurarak kayıt olabilir; admin onayından sonra aktif olurlar
- Tüm veterinerler is_verified=true olmadan görünmez (güvenlik)
- Profil > randevular menüsünden tüm randevular görüntülenebilir
- Video görüşmeler Agora altyapısıyla çalışır; tarayıcı kamera/mikrofon izni gerekir
- Şikayet ve iade talepleri /owner/appointments sayfasından açılabilir
- Destek saatleri: 09:00-18:00 hafta içi (canlı destek); diğer saatlerde AI destek aktif

Önemli kurallar:
1. ASLA onaylanmamış (is_verified=false) veteriner önermiyorsun
2. Kesin tıbbi teşhis veya ilaç önerisi yapmıyorsun; veterinere yönlendiriyorsun
3. Ödeme bilgisi (kart numarası vb.) istemiyorsun
4. Eğer soruyu yanıtlayamazsan veya konu hassas/karmaşıksa MUTLAKA şu JSON ile yanıt ver:
   {"escalate": true, "reason": "<kısa neden>", "message": "<kullanıcıya nazik mesaj>"}
5. Normal yanıtlar düz metin olarak ver, JSON kullanma

Escalate etmen gereken durumlar:
- Ödeme/iade anlaşmazlıkları
- Hesap banlı/askıya alındı şikayetleri
- Kişisel veri silme talepleri
- Teknik hatalar (kullanıcı platforma giremiyorsa vs.)
- Veteriner hakkında ciddi şikayet
- Saldırgan veya acil tıbbi durum
- 3'ten fazla mesaj sonrası sorun hâlâ çözülmediyse`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { threadId, message } = body as { threadId?: string; message?: string };

    if (!threadId || !message?.trim())
      return NextResponse.json({ error: "threadId ve message zorunludur" }, { status: 400 });

    const service = createServiceClient();

    // Load thread
    const { data: thread } = await service
      .from("support_threads")
      .select("id, status, user_id, subject, user:users!user_id(full_name, email)")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread) return NextResponse.json({ error: "Thread bulunamadı" }, { status: 404 });
    if (thread.user_id !== user.id)
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    if (thread.status === "resolved")
      return NextResponse.json({ error: "Kapatılmış talep" }, { status: 400 });
    if (thread.status === "human_required")
      return NextResponse.json({
        ai_reply: null,
        escalated: false,
        human_required: true,
        message: "Talebiniz ekibimize iletilmiştir. Yakında yanıt alacaksınız.",
      });

    // Load message history for context (last 10)
    const { data: history } = await service
      .from("support_messages")
      .select("sender_type, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(10);

    const historyMessages = (history ?? [])
      .reverse()
      .map((m: { sender_type: string; content: string }) => ({
        role: m.sender_type === "user" ? "user" as const : "assistant" as const,
        content: m.content,
      }));

    // Count total user messages to trigger escalation after 3+ unresolved exchanges
    const userMsgCount = historyMessages.filter(m => m.role === "user").length;

    // Save user message first
    await service.from("support_messages").insert({
      thread_id:   threadId,
      sender_type: "user",
      sender_id:   user.id,
      content:     message.trim(),
    });

    // Call Anthropic
    const aiResponse = await anthropic.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 600,
      system:     SYSTEM_PROMPT,
      messages: [
        ...historyMessages,
        { role: "user", content: message.trim() },
      ],
    });

    const rawText = aiResponse.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    // Check for escalation JSON
    let escalated = false;
    let aiReplyText = rawText;

    const jsonMatch = rawText.match(/\{[\s\S]*"escalate"\s*:\s*true[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as {
          escalate: boolean;
          reason?: string;
          message?: string;
        };
        if (parsed.escalate) {
          escalated = true;
          aiReplyText = parsed.message ?? "Talebiniz ekibimize iletildi. Çok yakında dönüş yapacağız.";
        }
      } catch { /* malformed JSON, treat as normal text */ }
    }

    // Auto-escalate after 3+ user messages with no resolution
    if (!escalated && userMsgCount >= 3) {
      escalated = true;
      aiReplyText = "Talebiniz için özür dilerim. Sizi daha iyi destekleyebilmek için ekibimize aktarıyorum. En kısa sürede dönüş yapacağız.";
    }

    // Save AI reply
    await service.from("support_messages").insert({
      thread_id:   threadId,
      sender_type: "ai",
      content:     aiReplyText,
      metadata:    { escalated },
    });

    if (escalated) {
      // Upgrade thread status
      await service
        .from("support_threads")
        .update({ status: "human_required" })
        .eq("id", threadId);

      // Urgent email to admin (fire-and-forget)
      const threadUser = Array.isArray(thread.user) ? thread.user[0] : thread.user;
      const userData = threadUser as { full_name?: string; email?: string } | null;
      sendSupportHumanRequiredEmail({
        to:        ADMIN_EMAIL,
        userName:  userData?.full_name ?? "Kullanıcı",
        userEmail: userData?.email ?? "",
        threadId,
        subject:   (thread.subject as string | null) ?? "Destek Talebi",
        message:   message.trim(),
        threadUrl: `${APP_URL}/admin/support/${threadId}`,
      }).catch((err) => console.error("[support/chat] email failed:", err));
    }

    return NextResponse.json({
      ai_reply:       aiReplyText,
      escalated,
      human_required: escalated,
    });
  } catch (err) {
    console.error("support/chat POST:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
