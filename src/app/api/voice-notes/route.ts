import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/voice-notes
 *
 * Structures a vet's typed consultation text into SOAP format using Claude.
 * Whisper (OpenAI audio transcription) has been REMOVED from this endpoint.
 * Vets enter notes as plain text; Claude restructures into SOAP.
 *
 * Body: { appointmentId: string, text: string }
 * Returns: { soap_notes: SoapNotes }
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, timeout: 30_000 });

const SOAP_PROMPT = `Sen bir veteriner klinik yazı asistanısın. Veterinerin yazdığı notları standart SOAP klinik formatına dönüştür.

SOAP Formatı:
- Subjektif (S): Hayvan sahibinin şikayetleri, semptom başlangıcı, gözlemleri
- Objektif (O): Muayene bulguları, vital değerler, fiziksel gözlemler
- Değerlendirme (D): Klinik değerlendirme, ayırıcı bulgular
- Plan (P): Tedavi planı, ilaçlar, takip talimatları

JSON formatında döndür:
{
  "subjective":  "...",
  "objective":   "...",
  "assessment":  "...",
  "plan":        "...",
  "medications": [{ "name": "...", "dosage": "...", "duration": "...", "instructions": "..." }],
  "follow_up_days": null
}

Tüm alanları Türkçe doldur. İlaç yoksa medications dizisini boş bırak.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

    // Verify caller is a vet
    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });

    const { appointmentId, text } = await request.json() as { appointmentId: string; text: string };

    if (!text?.trim())
      return NextResponse.json({ error: "Lütfen notlarınızı girin" }, { status: 400 });

    if (text.length > 4000)
      return NextResponse.json({ error: "Not çok uzun (max 4000 karakter)" }, { status: 400 });

    // Verify appointment belongs to this vet
    if (appointmentId) {
      const { data: apt } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", appointmentId)
        .eq("vet_id", vet.id)
        .maybeSingle();

      if (!apt)
        return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    }

    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 1500,
      system:     SOAP_PROMPT,
      messages:   [{ role: "user", content: `Veteriner notu:\n\n"${text}"\n\nLütfen SOAP formatına dönüştür.` }],
    });

    const raw = response.content[0];
    if (raw.type !== "text") throw new Error("Beklenmeyen yanıt");

    let soap: Record<string, unknown>;
    try {
      const match = raw.text.match(/\{[\s\S]*\}/);
      soap = match ? JSON.parse(match[0]) : {};
    } catch {
      throw new Error("SOAP notu ayrıştırılamadı");
    }

    // Log usage (Haiku is cheap — ~$0.0008 input / $0.004 output per 1K tokens)
    await supabase.from("api_usage_logs").insert({
      api_type:      "claude",
      tokens_used:   response.usage.input_tokens + response.usage.output_tokens,
      cost_estimate: (response.usage.input_tokens * 0.0008 + response.usage.output_tokens * 0.004) / 1000,
      context:       `soap_structure | chars:${text.length}`,
    });

    return NextResponse.json({ soap_notes: soap });
  } catch (err) {
    console.error("voice-notes error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Not yapılandırılamadı, lütfen tekrar deneyin" }, { status: 500 });
  }
}
