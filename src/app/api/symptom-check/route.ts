import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { withClaudeTimeout } from "@/lib/fetchWithTimeout";

/**
 * POST /api/symptom-check
 *
 * EDUCATIONAL USE ONLY — not a diagnostic or triage tool.
 * Generates informational guidance about pet health topics.
 * No urgency levels, no triage decisions, no medical recommendations.
 * Every response includes a mandatory disclaimer directing the owner to a vet.
 */

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 30_000,
});

const SYSTEM_PROMPT = `Sen bir evcil hayvan sağlığı asistanısın. Amacın hayvan sahiplerine GEÇMİŞ veteriner ziyaretlerini ve genel bilgileri hatırlatmak, evcil hayvanları hakkında merak ettikleri konularda GENEL EĞİTİM içeriği sunmaktır.

ZORUNLU KURALLAR:
1. ASLA "teşhis", "tanı", "hastalık", "acil" gibi tıbbi yargı içeren kelimeler KULLANMA
2. ASLA "hemen git", "bu gün git", "acil" gibi yönlendirme YAPMA — bu kararı sadece sahibi verir
3. ASLA ilaç adı veya doz önerme
4. Her yanıtın sonunda "Bu bilgiler yalnızca genel eğitim amaçlıdır. Evcil hayvanınızla ilgili tüm kararlar için lütfen bir veterinere danışın." uyarısını ekle
5. Yalnızca Türkçe yaz

Verilen semptomlara ve fotoğraflara göre aşağıdaki JSON formatında yanıt ver:
{
  "topic_summary": "Sahip tarafından bahsedilen konunun özeti (1-2 cümle, yargısız)",
  "general_info": "Bu konu hakkında genel eğitim bilgisi (3-4 cümle, Wikipedia tarzı faktüel bilgi)",
  "common_causes": ["Bilinebilecek genel neden 1", "Genel neden 2"],
  "care_notes": ["Genel bakım notu 1", "Genel bakım notu 2", "Genel bakım notu 3"],
  "questions_to_ask_vet": ["Veterinere sorulabilecek soru 1", "Soru 2", "Soru 3"],
  "disclaimer": "Bu bilgiler yalnızca genel eğitim amaçlıdır. Evcil hayvanınızla ilgili tüm kararlar için lütfen bir veterinere danışın."
}`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

    // Rate limit: 10 checks per day
    const rateCheck = await checkRateLimit(user.id, "symptom_check");
    if (!rateCheck.allowed) return NextResponse.json({ error: rateCheck.message }, { status: 429 });

    const formData = await request.formData();
    const petId    = formData.get("petId") as string;
    const symptoms = formData.get("symptoms") as string;

    if (!symptoms?.trim())
      return NextResponse.json({ error: "Lütfen konuyu açıklayın" }, { status: 400 });

    // Collect up to 3 photos
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const photoFiles: File[] = [];
    for (let i = 0; i < 3; i++) {
      const f = formData.get(`photo${i}`) as File | null;
      if (f && ALLOWED.includes(f.type) && f.size <= 5 * 1024 * 1024) photoFiles.push(f);
    }

    // Optional pet context (name/species only — no medical history to avoid feeding triage)
    let petContext = "";
    if (petId) {
      const { data: pet } = await supabase
        .from("pets")
        .select("name, species, breed")
        .eq("id", petId)
        .maybeSingle();
      if (pet) petContext = `\n\nEvcil hayvan: ${pet.name} (${pet.species}${pet.breed ? `, ${pet.breed}` : ""})`;
    }

    // Build Claude messages
    const parts: Anthropic.ContentBlockParam[] = [];
    for (const photo of photoFiles) {
      const bytes = await photo.arrayBuffer();
      parts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: photo.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: Buffer.from(bytes).toString("base64"),
        },
      });
    }
    parts.push({
      type: "text",
      text: `Hayvan sahibinin sorusu: "${symptoms}"${petContext}\n\nLütfen genel eğitim bilgisi sun. JSON formatında yanıt ver.`,
    });

    const response = await withClaudeTimeout(
      (signal) => anthropic.messages.create(
        { model: "claude-haiku-4-5", max_tokens: 1000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: parts }] },
        { signal }
      ),
      30_000
    );

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Beklenmeyen yanıt");

    let result: Record<string, unknown>;
    try {
      const match = content.text.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : {};
    } catch {
      throw new Error("AI yanıtı işlenemedi");
    }

    // Enforce disclaimer is always present
    result.disclaimer = "Bu bilgiler yalnızca genel eğitim amaçlıdır. Evcil hayvanınızla ilgili tüm kararlar için lütfen bir veterinere danışın.";

    // Persist (no urgency_level stored)
    await supabase.from("symptom_checks").insert({
      owner_id:      user.id,
      pet_id:        petId || null,
      symptoms_text: symptoms,
      photo_url:     null,
      ai_response:   result,
      urgency_level: null, // intentionally null — we do not perform triage
    });

    await supabase.from("api_usage_logs").insert({
      api_type:       "claude",
      tokens_used:    response.usage.input_tokens + response.usage.output_tokens,
      cost_estimate:  (response.usage.input_tokens * 0.0008 + response.usage.output_tokens * 0.004) / 1000,
      context:        `symptom_info | photos:${photoFiles.length}`,
    });

    return NextResponse.json({ result });
  } catch (err) {
    console.error("symptom-check error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Bir hata oluştu, lütfen tekrar deneyin" }, { status: 500 });
  }
}
