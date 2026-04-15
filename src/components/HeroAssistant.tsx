"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Send, MapPin, Star, ShieldCheck, Clock, Calendar, Loader2, Sparkles, X, ChevronDown } from "lucide-react";
import { TURKISH_CITIES } from "@/lib/constants";

const EXAMPLES = [
  "Kedim 3 gündür hiç yemedi, uyuşuk duruyor",
  "Köpeğim arka bacağına basamıyor, inliyor",
];

interface Vet {
  id: string;
  specialty: string;
  consultation_fee: number;
  average_rating: number;
  total_reviews: number;
  city: string;
  user: { full_name: string } | null;
}

interface Analysis {
  animal: string;
  symptoms: string[];
  urgency: "normal" | "bugün" | "acil";
  specialty: string;
  summary: string;
  urgency_reason: string;
}

const URGENCY_CONFIG = {
  acil: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
    iconColor: "text-amber-500",
    label: "Bugün Veterinere Gidin",
  },
  bugün: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Clock,
    iconColor: "text-blue-500",
    label: "Yakın Zamanda Kontrol Ettirin",
  },
  normal: {
    bg: "bg-[#F0FDF4]",
    border: "border-[#DCFCE7]",
    badge: "bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]",
    icon: Calendar,
    iconColor: "text-[#166534]",
    label: "Randevu Alabilirsiniz",
  },
};

interface HeroAssistantProps {
  userCity?: string | null;
}

export default function HeroAssistant({ userCity }: HeroAssistantProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ analysis: Analysis; vets: Vet[] } | null>(null);
  const [error, setError] = useState("");
  const [city, setCity] = useState(userCity || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const analyze = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/hero-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, city: city || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analiz başarısız");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError("");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const urgencyCfg = result ? URGENCY_CONFIG[result.analysis.urgency] : null;
  const UrgencyIcon = urgencyCfg?.icon;

  return (
    <div className="bg-white rounded-2xl border border-[#DCFCE7] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#166534] to-[#14532D] px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white text-sm">Veterineri Bul Yapay Zeka Asistan</p>
          <p className="text-green-200 text-xs">Durumu anlat, sana en uygun veterineri bulalım</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
          <span className="text-green-200 text-xs">Çevrimiçi</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {!result && !loading && (
          <>
            {/* City selector */}
            <div className="relative mb-3">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent appearance-none bg-white transition cursor-pointer hover:border-[#166534]"
              >
                <option value="">Şehrinizi seçin (opsiyonel)</option>
                {TURKISH_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Input */}
            <div className="relative mb-4">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyze(query)}
                placeholder="Hayvanınızın durumunu yazın… (örn: köpeğim 2 gündür yemiyor)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent transition hover:border-gray-300"
              />
              <button
                onClick={() => analyze(query)}
                disabled={!query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#166534] disabled:bg-gray-200 rounded-lg flex items-center justify-center transition-all hover:bg-[#14532D] active:scale-95 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Examples */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 font-medium">Hızlı örnekler:</p>
              <div className="flex flex-col gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => { setQuery(ex); analyze(ex); }}
                    className="text-left text-xs text-[#166534] bg-[#F0FDF4] hover:bg-[#DCFCE7] active:bg-[#BBF7D0] px-3 py-2.5 rounded-lg transition-colors border border-[#DCFCE7] hover:border-[#86EFAC] line-clamp-1 min-h-[44px] flex items-center"
                  >
                    &ldquo;{ex}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#166534] animate-spin" />
            <p className="text-sm text-gray-500">Durumu analiz ediyorum…</p>
            <p className="text-xs text-gray-400 text-center max-w-[200px]">Semptomlara göre uzman eşleştiriliyor</p>
          </div>
        )}

        {/* Result */}
        {result && urgencyCfg && UrgencyIcon && (
          <div className="space-y-4">
            {/* Query badge */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-400 bg-gray-50 rounded-full px-3 py-1 border border-gray-100 flex-1 truncate">
                &ldquo;{query}&rdquo;
                {city && <span className="ml-1 text-gray-300">· {city}</span>}
              </p>
              <button
                onClick={reset}
                className="p-1.5 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>

            {/* Urgency card */}
            <div className={`rounded-xl border p-4 ${urgencyCfg.bg} ${urgencyCfg.border}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${result.analysis.urgency === "acil" ? "bg-amber-100" : result.analysis.urgency === "bugün" ? "bg-blue-100" : "bg-[#DCFCE7]"}`}>
                  <UrgencyIcon className={`w-4 h-4 ${urgencyCfg.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${urgencyCfg.badge}`}>
                      {urgencyCfg.label}
                    </span>
                    <span className="text-xs text-gray-500 bg-white border border-gray-100 px-2 py-0.5 rounded-full">
                      {result.analysis.specialty}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{result.analysis.summary}</p>
                </div>
              </div>
            </div>

            {/* Symptoms extracted */}
            {result.analysis.symptoms.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-gray-400">Tespit edilen:</span>
                {result.analysis.symptoms.map((s) => (
                  <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            )}

            {/* Matching vets — bigger cards */}
            {result.vets.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Önerilen Veterinerler{city ? ` · ${city}` : ""}
                </p>
                {result.vets.map((vet) => (
                  <Link key={vet.id} href={`/veteriner/${vet.id}`}>
                    <div className="flex items-center gap-3.5 bg-white rounded-xl border border-gray-200 p-4 hover:border-[#3D6B5E] hover:bg-[#F0FDF4] hover:shadow-md active:scale-[0.99] transition-all cursor-pointer group">
                      <div className="w-12 h-12 bg-[#EEF5F2] rounded-full flex items-center justify-center shrink-0 group-hover:bg-[#DCFCE7] transition-colors">
                        <span className="text-[#166534] font-bold text-base">
                          {vet.user?.full_name?.charAt(0) || "V"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">Vet. Hek. {vet.user?.full_name}</p>
                          <ShieldCheck className="w-3.5 h-3.5 text-[#166534] shrink-0" />
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{vet.specialty}</p>
                        <div className="flex items-center gap-3">
                          {vet.city && (
                            <span className="flex items-center gap-0.5 text-xs text-gray-400">
                              <MapPin className="w-3 h-3" />{vet.city}
                            </span>
                          )}
                          {vet.average_rating > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-gray-500">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              {vet.average_rating.toFixed(1)}
                              <span className="text-gray-400">({vet.total_reviews})</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-800">₺{vet.consultation_fee}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">muayene</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                {city ? `${city}'de kayıtlı veteriner bulunamadı.` : "Şu an uygun veteriner bulunamadı."}{" "}
                <Link href="/veterinerler" className="text-[#166534] font-medium hover:underline">
                  Tümünü gör →
                </Link>
              </div>
            )}

            {/* CTA */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link href="/auth/register">
                <button className="w-full bg-[#F97316] hover:bg-[#EA6A0A] active:bg-[#C2570B] text-white text-xs font-semibold py-3 px-3 rounded-xl transition-all hover:shadow-md active:scale-95">
                  Randevu Al
                </button>
              </Link>
              <Link href="/ai-asistan">
                <button className="w-full bg-[#166534] hover:bg-[#14532D] active:bg-[#0F3D20] text-white text-xs font-semibold py-3 px-3 rounded-xl transition-all hover:shadow-md active:scale-95">
                  Detaylı Konuş
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
