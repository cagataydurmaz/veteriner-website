import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000 });

const EXTRACT_PROMPT = `Sen sakin, güven verici bir veteriner yönlendirme asistanısın. Kullanıcının hayvanı hakkındaki Türkçe açıklamasından yapılandırılmış bilgi çıkar ve uygun veterinere yönlendir.

TEMEL KURALLAR:
- Teşhis, tanı veya hastalık adı KESİNLİKLE YAZMA.
- Sakin ve güven verici bir dil kullan. Panik yaratma, abartma.
- "Acil durum", "hemen", "derhal" gibi panik yaratan ifadeler kullanma.
- Summary kısa, net ve sakin olsun (maksimum 2 cümle).

Sadece JSON döndür, başka hiçbir şey yazma. Format:
{
  "animal": "köpek | kedi | kuş | tavşan | diğer | belirsiz",
  "symptoms": ["gözlemlenen durum 1", "gözlemlenen durum 2"],
  "urgency": "normal | bugün | acil",
  "specialty": "Genel Veterinerlik | Küçük Hayvan Pratiği | Egzotik Hayvanlar | Ortopedi ve Cerrahi | İç Hastalıklar | Kardiyoloji | Nöroloji | Onkoloji | Dermatoloji | Göz Hastalıkları (Oftalmoloji) | Diş Hekimliği ve Ağız Cerrahisi | Acil ve Yoğun Bakım | Üreme, Doğum ve Jinekoloji | Beslenme ve Diyet | Görüntüleme ve Radyoloji | Sindirim Sistemi (Gastroenteroloji) | Solunum Hastalıkları (Pulmonoloji)",
  "summary": "Sakin ve kısa özet. Örn: 'Belirttiğiniz durumun değerlendirilmesi için bir veteriner muayenesi önerilir.' veya 'Bu tür bulgular aynı gün bir veteriner tarafından kontrol edilmeli.'",
  "urgency_reason": "neden bu aciliyet seviyesi"
}

ACİL (urgency: "acil") — SADECE bunlar: aktif nefes durması, şiddetli travma (kaza/ezilme), kontrolsüz kanama, kasılma geçirme, şiddetli zehirlenme belirtisi (ilaç/kimyasal yutma).
BUGÜN (urgency: "bugün"): iştahsızlık, ateş, ishal, kusma, topallama, şişlik, bayılma, halsizlik, gözde akıntı, yaralanma.
NORMAL (urgency: "normal"): aşı sorusu, rutin kontrol, hafif sorunlar, beslenme, davranış soruları, tüy dökülmesi.`;

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 20 requests per IP per hour (public endpoint — no auth required)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const rlKey = `hero-analyze::${ip}`;
    const rlClient = await createServiceClient();
    const { data: rl } = await rlClient
      .from("rate_limit")
      .select("attempt_count, locked_until")
      .eq("key", rlKey)
      .maybeSingle();

    if (rl?.locked_until && new Date(rl.locked_until) > new Date()) {
      return NextResponse.json({ error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });
    }
    const newRlCount = (rl?.attempt_count ?? 0) + 1;
    const rlLocked = newRlCount >= 20 ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;
    void rlClient.from("rate_limit").upsert(
      { key: rlKey, attempt_count: newRlCount, locked_until: rlLocked, last_attempt_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    const { query, city } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return NextResponse.json({ error: "Lütfen durumu biraz daha açıklayın" }, { status: 400 });
    }

    // Extract intent with Claude
    const extraction = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: EXTRACT_PROMPT,
      messages: [{ role: "user", content: query.trim() }],
    });

    const rawText = extraction.content[0].type === "text" ? extraction.content[0].text : "{}";

    let analysis: {
      animal: string;
      symptoms: string[];
      urgency: "normal" | "bugün" | "acil";
      specialty: string;
      summary: string;
      urgency_reason: string;
    };

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      analysis = {
        animal: "belirsiz",
        symptoms: [],
        urgency: "normal",
        specialty: "Genel Veteriner",
        summary: "Durumu değerlendirmek için bir veteriner kontrolü önerilir.",
        urgency_reason: "",
      };
    }

    // Find matching vets from DB
    let vets: {
      id: string;
      specialty: string;
      consultation_fee: number;
      average_rating: number;
      total_reviews: number;
      city: string;
      user: { full_name: string } | null;
    }[] = [];

    try {
      const supabase = await createClient();
      let queryBuilder = supabase
        .from("veterinarians")
        .select("id, specialty, consultation_fee, average_rating, total_reviews, city, user:users!veterinarians_user_id_fkey(full_name)")
        .eq("is_verified", true)
        .order("average_rating", { ascending: false })
        .limit(3);

      // Filter by specialty if not general
      if (analysis.specialty && analysis.specialty !== "Genel Veteriner") {
        queryBuilder = queryBuilder.eq("specialty", analysis.specialty);
      }

      // Filter by city if provided
      if (city && city.trim()) {
        queryBuilder = queryBuilder.eq("city", city.trim());
      }

      const { data } = await queryBuilder;

      // If no specialty match, fallback to general vets
      if (!data || data.length === 0) {
        const { data: fallback } = await supabase
          .from("veterinarians")
          .select("id, specialty, consultation_fee, average_rating, total_reviews, city, user:users!veterinarians_user_id_fkey(full_name)")
          .eq("is_verified", true)
          .order("average_rating", { ascending: false })
          .limit(3);
        vets = (fallback || []).map((v) => ({ ...v, user: Array.isArray(v.user) ? v.user[0] : v.user }));
      } else {
        vets = data.map((v) => ({ ...v, user: Array.isArray(v.user) ? v.user[0] : v.user }));
      }
    } catch {
      // DB not configured — return analysis without vets
    }

    return NextResponse.json({ analysis, vets });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Hata oluştu";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
