"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, AlertCircle, Info, CheckCircle, ArrowRight, Heart, Stethoscope } from "lucide-react";

const ANIMAL_TYPES = [
  { value: "dog", label: "Köpek", emoji: "🐕", bg: "from-amber-50 to-orange-50", border: "border-amber-200", activeBg: "from-amber-100 to-orange-100", activeBorder: "border-amber-400" },
  { value: "cat", label: "Kedi", emoji: "🐈", bg: "from-purple-50 to-pink-50", border: "border-purple-200", activeBg: "from-purple-100 to-pink-100", activeBorder: "border-purple-400" },
  { value: "bird", label: "Kuş", emoji: "🦜", bg: "from-sky-50 to-teal-50", border: "border-sky-200", activeBg: "from-sky-100 to-teal-100", activeBorder: "border-sky-400" },
  { value: "rabbit", label: "Tavşan", emoji: "🐇", bg: "from-rose-50 to-pink-50", border: "border-rose-200", activeBg: "from-rose-100 to-pink-100", activeBorder: "border-rose-400" },
  { value: "other", label: "Diğer", emoji: "🐾", bg: "from-gray-50 to-slate-50", border: "border-gray-200", activeBg: "from-gray-100 to-slate-100", activeBorder: "border-gray-400" },
];

const SYMPTOMS = [
  { id: "lethargy", label: "Halsizlik / İştahsızlık", emoji: "😴", weight: 2, tag: "Genel" },
  { id: "vomiting", label: "Kusma", emoji: "🤢", weight: 3, tag: "Sindirim" },
  { id: "diarrhea", label: "İshal", emoji: "💧", weight: 3, tag: "Sindirim" },
  { id: "coughing", label: "Öksürük / Hapşırma", emoji: "🤧", weight: 2, tag: "Solunum" },
  { id: "limping", label: "Topallama", emoji: "🦴", weight: 2, tag: "Hareket" },
  { id: "eye_discharge", label: "Göz Akıntısı", emoji: "👁️", weight: 2, tag: "Göz" },
  { id: "scratching", label: "Kaşıntı / Deri Sorunu", emoji: "🔴", weight: 1, tag: "Deri" },
  { id: "breathing", label: "Nefes Darlığı", emoji: "🫁", weight: 5, tag: "Acil" },
  { id: "bleeding", label: "Kanama", emoji: "🩸", weight: 5, tag: "Acil" },
  { id: "seizure", label: "Nöbet / Titreme", emoji: "⚡", weight: 5, tag: "Acil" },
  { id: "swollen", label: "Şişlik", emoji: "🔵", weight: 3, tag: "Genel" },
  { id: "not_drinking", label: "Su İçmeme", emoji: "🚰", weight: 3, tag: "Genel" },
  { id: "pale_gums", label: "Soluk Diş Etleri", emoji: "🦷", weight: 4, tag: "Genel" },
  { id: "collapse", label: "Düşme / Bayılma", emoji: "🆘", weight: 5, tag: "Acil" },
];

type UrgencyLevel = "low" | "medium" | "high" | "emergency";

interface Result {
  level: UrgencyLevel;
  label: string;
  color: string;
  bg: string;
  border: string;
  iconBg: string;
  icon: typeof CheckCircle;
  message: string;
  action: string;
}

function getResult(selectedSymptoms: string[]): Result {
  const totalWeight = selectedSymptoms.reduce((sum, id) => {
    const s = SYMPTOMS.find((s) => s.id === id);
    return sum + (s?.weight || 0);
  }, 0);

  const emergency = selectedSymptoms.some((id) =>
    ["breathing", "bleeding", "seizure", "collapse"].includes(id)
  );

  if (emergency || totalWeight >= 10) {
    return {
      level: "emergency",
      label: "Acil Müdahale",
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
      iconBg: "bg-red-100",
      icon: AlertTriangle,
      message: "Hayvanınızın acil veteriner bakımına ihtiyacı olabilir. Lütfen en kısa sürede bir veterinere gidin.",
      action: "Hemen Veterineri Bul",
    };
  }
  if (totalWeight >= 6) {
    return {
      level: "high",
      label: "Bugün Kontrol",
      color: "text-orange-700",
      bg: "bg-orange-50",
      border: "border-orange-200",
      iconBg: "bg-orange-100",
      icon: AlertCircle,
      message: "Hayvanınızın bugün veteriner muayenesine alınması önerilir.",
      action: "Bugün Randevu Al",
    };
  }
  if (totalWeight >= 3) {
    return {
      level: "medium",
      label: "Takip Gerekli",
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      iconBg: "bg-amber-100",
      icon: Info,
      message: "Hayvanınızı yakından takip edin. Semptomlar 24 saat içinde düzelmezse veterinere götürün.",
      action: "Veterineri Bul",
    };
  }
  return {
    level: "low",
    label: "Düşük Risk",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    iconBg: "bg-emerald-100",
    icon: CheckCircle,
    message: "Belirti seviyesi düşük görünüyor. Hayvanınızı izlemeye devam edin ve gerekirse rutin kontrole götürün.",
    action: "Veterineri Bul",
  };
}

const LEVEL_STEPS = ["low", "medium", "high", "emergency"];
const LEVEL_COLORS = ["bg-emerald-400", "bg-amber-400", "bg-orange-400", "bg-red-500"];

export default function HayvanımHastaMıClient() {
  const [animal, setAnimal] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const calculate = () => {
    if (selected.length === 0) return;
    setResult(getResult(selected));
  };

  const reset = () => { setAnimal(null); setSelected([]); setResult(null); };

  const acilSymptoms = SYMPTOMS.filter(s => s.tag === "Acil");
  const otherSymptoms = SYMPTOMS.filter(s => s.tag !== "Acil");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0FDF4] to-[#F6F3EF]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[#D4E0D8] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-8 h-8 bg-[#166534] rounded-full flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 leading-tight">Hayvanım Hasta mı?</p>
              <p className="text-xs text-gray-500">Semptom değerlendirme</p>
            </div>
          </div>
          <span className="text-xs text-[#166534] bg-[#F0FDF4] border border-[#DCFCE7] px-2.5 py-1 rounded-full font-medium">Ücretsiz</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {!result ? (
          <>
            {/* Animal selector */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#DCFCE7]">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-[#166534]" />
                <h1 className="text-lg font-bold text-gray-900">Hayvanınızı Seçin</h1>
              </div>
              <p className="text-sm text-gray-500 mb-5">Hangi hayvanınız için kontrol yapıyorsunuz?</p>
              <div className="grid grid-cols-5 gap-2.5">
                {ANIMAL_TYPES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setAnimal(a.value)}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all duration-200 bg-gradient-to-b ${
                      animal === a.value
                        ? `${a.activeBg} ${a.activeBorder} shadow-md scale-105`
                        : `${a.bg} ${a.border} hover:scale-102 hover:shadow-sm`
                    }`}
                  >
                    <span className="text-3xl leading-none">{a.emoji}</span>
                    <span className="text-xs font-semibold text-gray-700">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Symptoms */}
            {animal && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#DCFCE7] animate-in slide-in-from-bottom-3 duration-300">
                <p className="text-sm font-bold text-gray-800 mb-1">Gözlemlediğiniz belirtiler</p>
                <p className="text-xs text-gray-400 mb-5">Birden fazla belirti seçebilirsiniz</p>

                {/* Acil belirtiler */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Acil Belirtiler</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {acilSymptoms.map((s) => (
                      <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                        selected.includes(s.id)
                          ? "border-red-400 bg-red-50 shadow-sm"
                          : "border-red-100 bg-red-50/30 hover:border-red-300"
                      }`}>
                        <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="sr-only" />
                        <span className="text-lg leading-none">{s.emoji}</span>
                        <span className="text-sm font-medium text-gray-800 flex-1">{s.label}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          selected.includes(s.id) ? "border-red-500 bg-red-500" : "border-gray-300"
                        }`}>
                          {selected.includes(s.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Diğer belirtiler */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#166534]" />
                    <p className="text-xs font-semibold text-[#166534] uppercase tracking-wide">Diğer Belirtiler</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {otherSymptoms.map((s) => (
                      <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                        selected.includes(s.id)
                          ? "border-[#166534] bg-[#F0FDF4] shadow-sm"
                          : "border-gray-100 hover:border-[#86EFAC] hover:bg-[#F0FDF4]/50"
                      }`}>
                        <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="sr-only" />
                        <span className="text-lg leading-none">{s.emoji}</span>
                        <span className="text-sm font-medium text-gray-800 flex-1">{s.label}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          selected.includes(s.id) ? "border-[#166534] bg-[#166534]" : "border-gray-300"
                        }`}>
                          {selected.includes(s.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {selected.length > 0 && (
                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5">
                    <span>{selected.length} belirti seçildi</span>
                    <button onClick={() => setSelected([])} className="text-[#166534] font-medium hover:underline">Temizle</button>
                  </div>
                )}

                <button
                  onClick={calculate}
                  disabled={selected.length === 0}
                  className="w-full mt-4 bg-[#166534] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3.5 rounded-xl transition-all hover:bg-[#14532D] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Değerlendir
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-bottom-3 duration-300">
            {/* Result card */}
            <div className={`rounded-2xl p-6 border-2 shadow-sm ${result.bg} ${result.border}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${result.iconBg}`}>
                  <result.icon className={`w-7 h-7 ${result.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Değerlendirme Sonucu</p>
                  <p className={`text-2xl font-black ${result.color}`}>{result.label}</p>
                </div>
              </div>

              {/* Risk bar */}
              <div className="flex gap-1 mb-4">
                {LEVEL_STEPS.map((lvl, i) => (
                  <div key={lvl} className={`h-2 flex-1 rounded-full transition-all ${
                    LEVEL_STEPS.indexOf(result.level) >= i ? LEVEL_COLORS[i] : "bg-gray-200"
                  }`} />
                ))}
              </div>

              <p className="text-gray-700 text-sm leading-relaxed">{result.message}</p>

              <div className="mt-4 flex items-start gap-2 bg-white/60 rounded-xl px-4 py-3">
                <span className="text-sm">⚠️</span>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Bu araç ön değerlendirme amaçlıdır, kesin tanı yerine geçmez. Tüm muayene ve tedaviler veteriner hekimin sorumluluğundadır.
                </p>
              </div>
            </div>

            {/* Selected symptoms summary */}
            {selected.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-[#DCFCE7] shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Seçilen Belirtiler</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((id) => {
                    const s = SYMPTOMS.find(s => s.id === id);
                    return s ? (
                      <span key={id} className="text-xs bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534] px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span>{s.emoji}</span>{s.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="bg-white rounded-2xl p-5 border border-[#DCFCE7] shadow-sm">
              <p className="text-sm text-gray-600 mb-4 font-medium">Yakınınızdaki veterineri hemen bulun:</p>
              <Link href="/auth/register">
                <button className="w-full bg-[#166534] hover:bg-[#14532D] active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md">
                  {result.action}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>

            <button onClick={reset} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors">
              ← Yeniden Başla
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
