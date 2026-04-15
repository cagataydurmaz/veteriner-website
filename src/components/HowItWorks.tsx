"use client";

import { useState } from "react";
import Link from "next/link";
import { Play, ArrowRight } from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const OWNER_STEPS = [
  {
    emoji: "🐾",
    title: "Hayvanının semptomlarını gir",
    desc: "AI asistanımıza hayvanının şikayetlerini anlat. Hangi uzmana gitmesi gerektiğini belirleyelim.",
  },
  {
    emoji: "🔍",
    title: "Sana uygun veterineri bul",
    desc: "Şehrine, uzmanlığa ve puana göre filtrelenmiş, diploma doğrulamalı veterinerleri gör.",
  },
  {
    emoji: "📅",
    title: "Randevunu al — ücretsiz",
    desc: "Uygun saati seç, randevunu onayla. Platform kullanımı tamamen ücretsiz, komisyon yok.",
  },
  {
    emoji: "✅",
    title: "Kliniğe git veya online görüş",
    desc: "Yüz yüze muayene için kliniğe git ya da evden video görüşme başlat.",
  },
];

const VET_STEPS = [
  {
    emoji: "📋",
    title: "Ücretsiz kayıt ol",
    desc: "Birkaç dakikada profilini oluştur. Kayıt ve platform kullanımı tamamen ücretsiz.",
  },
  {
    emoji: "✅",
    title: "Diploma yükle, onay al",
    desc: "TVHB üye numaranı ve diplomani yükle. Ekibimiz 1-2 iş günü içinde doğrular.",
  },
  {
    emoji: "📅",
    title: "Takvimini ayarla",
    desc: "Müsait günlerini ve saatlerini belirle. Yüz yüze, online veya nöbetçi hizmet seç.",
  },
  {
    emoji: "💰",
    title: "Yeni müşterilere ulaş",
    desc: "Randevular otomatik gelir. Komisyon sıfır — kazandığın her kuruş senindir.",
  },
];

// ── Step Card ─────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  visible,
}: {
  step: { emoji: string; title: string; desc: string };
  index: number;
  visible: boolean;
}) {
  return (
    <div
      className={`flex gap-4 transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      {/* Left: number + connector */}
      <div className="flex flex-col items-center shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-[#166534] text-white flex items-center justify-center font-black text-sm shadow-sm">
          {index + 1}
        </div>
        {index < 3 && <div className="w-px flex-1 bg-gradient-to-b from-[#166534]/30 to-transparent mt-1 min-h-[24px]" />}
      </div>

      {/* Right: content */}
      <div className="pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{step.emoji}</span>
          <p className="font-bold text-gray-900 text-sm">{step.title}</p>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

// YouTube video ID — update when ready
const YOUTUBE_VIDEO_ID = ""; // e.g. "dQw4w9WgXcQ"

export default function HowItWorks() {
  const [tab, setTab] = useState<"owner" | "vet">("owner");
  const [visible, setVisible] = useState(true);

  const switchTab = (t: "owner" | "vet") => {
    if (t === tab) return;
    setVisible(false);
    setTimeout(() => {
      setTab(t);
      setVisible(true);
    }, 150);
  };

  const steps = tab === "owner" ? OWNER_STEPS : VET_STEPS;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[#EEF5F2] border border-[#D4E0D8] text-[#3D6B5E] px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <span>⚡</span> Kolay Kullanım
          </div>
          <h2 className="text-3xl font-black text-[#2C3A32] mb-3">Nasıl Çalışır?</h2>
          <p className="text-[#7A8F85] max-w-md mx-auto text-sm">
            4 adımda başlayın — hesap açmak bile 2 dakika sürmez.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: Steps */}
          <div>
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
              <button
                onClick={() => switchTab("owner")}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
                  tab === "owner"
                    ? "bg-white shadow-sm text-[#166534]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                🐾 Pet Sahibi
              </button>
              <button
                onClick={() => switchTab("vet")}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
                  tab === "vet"
                    ? "bg-white shadow-sm text-[#166534]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                🩺 Veteriner
              </button>
            </div>

            {/* Steps list */}
            <div>
              {steps.map((step, i) => (
                <StepCard key={`${tab}-${i}`} step={step} index={i} visible={visible} />
              ))}
            </div>

            {/* CTA */}
            <div className={`mt-2 transition-all duration-500 delay-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              <Link
                href={tab === "owner" ? "/auth/register" : "/auth/vet-register"}
                className="inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#EA6A0A] text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors shadow-sm hover:shadow-md"
              >
                {tab === "owner" ? "Hemen Başla — Ücretsiz" : "Veteriner Olarak Katıl"}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Right: Video */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#2C4A3E] to-[#3D6B5E] aspect-video shadow-xl group">
              {YOUTUBE_VIDEO_ID ? (
                <iframe
                  src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0&modestbranding=1`}
                  title="Nasıl Çalışır"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              ) : (
                /* Placeholder */
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                  {/* Decorative blobs */}
                  <div className="absolute top-4 right-6 w-24 h-24 rounded-full bg-white/5" />
                  <div className="absolute bottom-6 left-4 w-16 h-16 rounded-full bg-white/5" />

                  {/* Play button */}
                  <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Play className="w-6 h-6 text-white fill-white ml-1" />
                  </div>

                  <p className="text-white font-black text-lg mb-2 leading-tight">
                    Nasıl çalıştığını izle
                  </p>
                  <p className="text-white/60 text-sm max-w-xs">
                    Platformun tüm özelliklerini 2 dakikalık tanıtım videosunda keşfet.
                  </p>

                  {/* Coming soon badge */}
                  <div className="mt-5 inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                    Video yakında yayında
                  </div>
                </div>
              )}
            </div>

            {/* Floating trust badge */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white border border-[#D4E0D8] rounded-2xl px-5 py-3 shadow-md flex items-center gap-3 whitespace-nowrap">
              <span className="text-xl">🏆</span>
              <div>
                <p className="text-xs font-bold text-[#2C3A32]">50.000+ Mutlu Randevu</p>
                <p className="text-[10px] text-gray-400">Türkiye genelinde</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
