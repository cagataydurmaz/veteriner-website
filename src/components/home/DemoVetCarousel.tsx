"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Star, ChevronLeft, ChevronRight, X } from "lucide-react";

export interface DemoVet {
  id: string;
  full_name: string;
  specialty: string;
  city: string;
  rating: number;
  appointment_count: number;
  bio: string;
  photo_url?: string;
  avatar_seed: string;
}

interface DemoVetCarouselProps {
  vets: DemoVet[];
}

const CARD_WIDTH = 280;
const CARD_GAP = 16;
const SCROLL_STEP = CARD_WIDTH + CARD_GAP;

const CITIES = [
  "İstanbul",
  "Ankara",
  "İzmir",
  "Bursa",
  "Antalya",
  "Adana",
  "Konya",
  "Gaziantep",
  "Kayseri",
  "Mersin",
  "Diyarbakır",
  "Eskişehir",
  "İzmit",
  "Diğer",
];

// ── Waitlist Modal ──────────────────────────────────────────────────────────

interface WaitlistModalProps {
  onClose: () => void;
}

function WaitlistModal({ onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Auto-close on success after 3s
    if (success) {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [success, onClose]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, city, source: "demo_card" }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-bold text-gray-800 mb-2">Teşekkürler!</p>
            <p className="text-sm text-gray-500">
              Veterinerler aktif olduğunda sizi haberdar edeceğiz.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-5">
              <div className="text-3xl mb-2">🎉</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Yakında Açılıyor!
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Bu demo bir profildir. Yakında gerçek veterinerlerimiz
                platformda aktif olacak!
              </p>
            </div>

            <p className="text-sm font-medium text-gray-700 mb-3 text-center">
              Sizi haberdar edelim mi?
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta adresiniz..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30 focus:border-[#1A6B4A]"
                required
              />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30 focus:border-[#1A6B4A] bg-white"
              >
                <option value="">Şehir seçin...</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1A6B4A] hover:bg-[#155a3e] text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Gönderiliyor..." : "Haber Ver"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Vet Card ─────────────────────────────────────────────────────────────────

interface VetCardProps {
  vet: DemoVet;
}

function VetCard({ vet }: VetCardProps) {
  const avatarSrc = `https://api.dicebear.com/7.x/personas/svg?seed=${vet.avatar_seed}&backgroundColor=e8f5ee`;

  return (
    <div
      className="relative flex-shrink-0 bg-white rounded-2xl border border-[#E5E7EB] overflow-visible transition-all duration-200 hover:scale-[1.02]"
      style={{
        width: CARD_WIDTH,
        minWidth: CARD_WIDTH,
        height: 380,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 4px 16px rgba(26,107,74,0.15)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 2px 8px rgba(0,0,0,0.08)";
      }}
    >
      {/* Demo badge */}
      <span className="absolute top-2 right-2 z-10 bg-[#F3F4F6] text-[#9CA3AF] text-[10px] px-2 py-0.5 rounded-full font-medium">
        Demo
      </span>

      {/* Banner */}
      <div
        className="w-full rounded-t-2xl relative"
        style={{ height: 70, backgroundColor: "#1A6B4A" }}
      >
        {/* Avatar overlapping banner */}
        <div
          className="absolute left-1/2 border-4 border-white rounded-full overflow-hidden bg-[#e8f5ee]"
          style={{
            width: 80,
            height: 80,
            transform: "translateX(-50%) translateY(50%)",
            bottom: 0,
          }}
        >
          <Image
            src={avatarSrc}
            alt={vet.full_name}
            width={80}
            height={80}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>
      </div>

      {/* Card body */}
      <div
        className="flex flex-col items-center px-4 pt-12 pb-4"
        style={{ height: "calc(380px - 70px)" }}
      >
        {/* Name */}
        <h3 className="font-bold text-[18px] text-[#1F2937] text-center leading-tight mt-1 mb-1.5">
          {vet.full_name}
        </h3>

        {/* Specialty badge */}
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#E8F5EE] text-[#1A6B4A] mb-2">
          {vet.specialty}
        </span>

        {/* City */}
        <div className="flex items-center gap-1 text-[#6B7280] text-sm mb-1.5">
          <MapPin className="w-3.5 h-3.5" />
          <span>{vet.city}</span>
        </div>

        {/* Rating & appointment count */}
        <div className="flex items-center gap-1.5 text-sm mb-3">
          <Star className="w-4 h-4 fill-[#F97316] text-[#F97316]" />
          <span className="font-bold text-[#1F2937]">{vet.rating.toFixed(1)}</span>
          <span className="text-[#6B7280]">· {vet.appointment_count} randevu</span>
        </div>

        {/* Divider */}
        <div className="w-full border-t border-[#E5E7EB] mb-3" />

        {/* Bio */}
        <p className="text-sm text-[#6B7280] text-center line-clamp-2 leading-relaxed flex-1">
          {vet.bio}
        </p>

        {/* CTA button */}
        <Link
          href={`/veteriner/${vet.id}`}
          className="w-full mt-3 block bg-[#1A6B4A] hover:bg-[#155a3e] text-white py-2.5 rounded-lg font-medium text-sm transition-colors text-center"
        >
          Randevu Al
        </Link>
      </div>
    </div>
  );
}

// ── Main Carousel ─────────────────────────────────────────────────────────────

export default function DemoVetCarousel({ vets }: DemoVetCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Drag state
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartLeft = useRef(0);

  const cardsPerView =
    typeof window !== "undefined"
      ? Math.floor((window.innerWidth - 64) / SCROLL_STEP)
      : 3;
  const dotCount = Math.ceil(vets.length / Math.max(cardsPerView, 1));

  const scrollBy = useCallback((amount: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    let next = el.scrollLeft + amount;
    if (next >= maxScroll) next = 0;
    else if (next < 0) next = maxScroll;
    el.scrollTo({ left: next, behavior: "smooth" });
  }, []);

  const startAutoScroll = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      scrollBy(SCROLL_STEP);
    }, 3000);
  }, [scrollBy]);

  const stopAutoScroll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoScroll();
    return () => stopAutoScroll();
  }, [startAutoScroll, stopAutoScroll]);

  // Update dot indicator
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const idx = Math.round(el.scrollLeft / SCROLL_STEP);
      setActiveIndex(Math.floor(idx / Math.max(cardsPerView, 1)));
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [cardsPerView]);

  // Mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    scrollStartLeft.current = scrollRef.current?.scrollLeft ?? 0;
    stopAutoScroll();
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = dragStartX.current - e.clientX;
    scrollRef.current.scrollLeft = scrollStartLeft.current + dx;
  };
  const handleMouseUp = () => {
    isDragging.current = false;
    startAutoScroll();
  };

  // Touch
  const touchStartX = useRef(0);
  const touchScrollLeft = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
    stopAutoScroll();
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    scrollRef.current.scrollLeft = touchScrollLeft.current + dx;
  };
  const handleTouchEnd = () => {
    startAutoScroll();
  };

  if (vets.length === 0) return null;

  return (
    <>
      {/* Coming soon banner */}
      <div className="bg-[#E8F5EE] text-[#1A6B4A] text-sm font-medium px-4 py-3 rounded-xl mb-4 flex items-center gap-1 flex-wrap">
        <span>🚀 Platform yakında açılıyor — Veteriner misiniz?</span>
        <Link
          href="/auth/vet-register"
          className="underline font-semibold hover:text-[#155a3e] transition-colors"
        >
          İlk katılanlar arasında yerinizi alın →
        </Link>
      </div>

      {/* Carousel wrapper */}
      <div
        className="relative"
        onMouseEnter={stopAutoScroll}
        onMouseLeave={startAutoScroll}
      >
        {/* Left arrow */}
        <button
          onClick={() => scrollBy(-SCROLL_STEP)}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 bg-white rounded-full shadow-md items-center justify-center border border-gray-100 hover:shadow-lg transition-shadow"
          aria-label="Önceki"
        >
          <ChevronLeft className="w-5 h-5 text-[#1A6B4A]" />
        </button>

        {/* Scrollable track */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 cursor-grab active:cursor-grabbing select-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {vets.map((vet) => (
            <VetCard key={vet.id} vet={vet} />
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scrollBy(SCROLL_STEP)}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 bg-white rounded-full shadow-md items-center justify-center border border-gray-100 hover:shadow-lg transition-shadow"
          aria-label="Sonraki"
        >
          <ChevronRight className="w-5 h-5 text-[#1A6B4A]" />
        </button>
      </div>

      {/* Dot indicators */}
      {dotCount > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: dotCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (!scrollRef.current) return;
                scrollRef.current.scrollTo({
                  left: i * cardsPerView * SCROLL_STEP,
                  behavior: "smooth",
                });
              }}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === activeIndex ? 24 : 8,
                backgroundColor: i === activeIndex ? "#1A6B4A" : "#E5E7EB",
              }}
              aria-label={`Grup ${i + 1}`}
            />
          ))}
        </div>
      )}

    </>
  );
}
