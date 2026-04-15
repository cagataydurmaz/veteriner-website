import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { withClaudeTimeout } from "@/lib/fetchWithTimeout";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000 });

const SYSTEM_PROMPT = `Sen Veterineri Bul'un Türkçe konuşan veteriner asistanısın. Adın "Veterineri Bul Asistan".

Görevin:
- Hayvan sahiplerinin evcil hayvanlarıyla ilgili sorularını yanıtlamak
- Semptomları dinleyerek hangi uzman türüne gitmeleri gerektiğini önermek
- Acil durumları tespit edip kullanıcıyı uyarmak
- Veterineri Bul üzerinden randevu almalarına yönlendirmek

Kurallar:
1. Her zaman Türkçe konuş
2. ASLA kesin tıbbi tanı koyma, her zaman "veteriner kontrolü öneriyorum" de
3. Acil belirtiler (nefes darlığı, bilinç kaybı, şiddetli kanama) için hemen "ACİL DURUM - Derhal veterinere gidin" yaz
4. Cevaplarını kısa ve anlaşılır tut (3-5 cümle)
5. Gerektiğinde /auth/register veya randevu sayfasına yönlendir
6. Semptomlara göre öneri verirken şunları belirt: Bekleme süresi (bekleyebilir / bugün gidin / acil)
7. Her mesajın sonunda bir sonraki adım öner (muayene, randevu, araç kullanımı)

Uzman türleri: Genel Veteriner, Dermatolog, Ortoped, Göz Uzmanı, Diş Hekimi, İç Hastalıklar, Onkolog, Kardiyolog

Platforma özel bilgi: Veterineri Bul'da tüm veterinerler diploma ve TVHB üyeliğiyle doğrulanmıştır.`;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

    // Rate limit: 20 AI chat messages per hour per user
    const rateCheck = await checkRateLimit(user.id, "ai_chat");
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Mesaj gereklidir" }, { status: 400 });
    }

    const response = await withClaudeTimeout(
      (signal) =>
        anthropic.messages.create(
          {
            model: "claude-sonnet-4-6",
            max_tokens: 512,
            system: SYSTEM_PROMPT,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          },
          { signal }
        ),
      30_000 // 30 second timeout
    );

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply: text });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Hata oluştu";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
