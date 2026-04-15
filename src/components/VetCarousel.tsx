"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Star, MapPin, ShieldCheck, Calendar } from "lucide-react";

interface Vet {
  id: string;
  specialty: string;
  consultation_fee: number;
  average_rating: number;
  total_reviews: number;
  city: string;
  offers_in_person?: boolean | null;
  offers_video?: boolean | null;
  offers_nobetci?: boolean | null;
  user: { full_name: string } | null;
}

const FALLBACK_VETS: Vet[] = [
  { id: "1", specialty: "Genel Veteriner", consultation_fee: 350, average_rating: 4.9, total_reviews: 124, city: "İstanbul", user: { full_name: "Ayşe Kaya" } },
  { id: "2", specialty: "Dermatolog", consultation_fee: 450, average_rating: 4.8, total_reviews: 89, city: "Ankara", user: { full_name: "Mehmet Arslan" } },
  { id: "3", specialty: "Ortoped", consultation_fee: 500, average_rating: 4.7, total_reviews: 67, city: "İzmir", user: { full_name: "Zeynep Demir" } },
  { id: "4", specialty: "İç Hastalıklar", consultation_fee: 400, average_rating: 4.9, total_reviews: 203, city: "Bursa", user: { full_name: "Ali Yıldız" } },
  { id: "5", specialty: "Göz Uzmanı", consultation_fee: 420, average_rating: 4.6, total_reviews: 55, city: "Antalya", user: { full_name: "Fatma Şahin" } },
  { id: "6", specialty: "Kardiyolog", consultation_fee: 550, average_rating: 4.8, total_reviews: 41, city: "İstanbul", user: { full_name: "Emre Çelik" } },
  { id: "7", specialty: "Onkolog", consultation_fee: 600, average_rating: 4.7, total_reviews: 33, city: "Ankara", user: { full_name: "Selin Koç" } },
  { id: "8", specialty: "Diş Hekimi", consultation_fee: 380, average_rating: 4.5, total_reviews: 78, city: "İzmir", user: { full_name: "Burak Öztürk" } },
];

const AVATAR_GRADIENTS = [
  "from-[#166534] to-[#15803D]",
  "from-[#1e40af] to-[#2563eb]",
  "from-[#7c3aed] to-[#9333ea]",
  "from-[#b45309] to-[#d97706]",
  "from-[#0f766e] to-[#0d9488]",
  "from-[#be123c] to-[#e11d48]",
  "from-[#0369a1] to-[#0284c7]",
  "from-[#4d7c0f] to-[#65a30d]",
];

const SPECIALTY_COLORS: Record<string, string> = {
  "Genel Veterinerlik": "bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]",
  "Küçük Hayvan Pratiği": "bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]",
  "Egzotik Hayvanlar": "bg-teal-50 text-teal-700 border-teal-100",
  "Ortopedi ve Cerrahi": "bg-blue-50 text-blue-700 border-blue-100",
  "İç Hastalıklar": "bg-indigo-50 text-indigo-700 border-indigo-100",
  "Kardiyoloji": "bg-red-50 text-red-700 border-red-100",
  "Nöroloji": "bg-violet-50 text-violet-700 border-violet-100",
  "Onkoloji": "bg-orange-50 text-orange-700 border-orange-100",
  "Dermatoloji": "bg-purple-50 text-purple-700 border-purple-100",
  "Göz Hastalıkları (Oftalmoloji)": "bg-cyan-50 text-cyan-700 border-cyan-100",
  "Diş Hekimliği ve Ağız Cerrahisi": "bg-yellow-50 text-yellow-700 border-yellow-100",
  "Acil ve Yoğun Bakım": "bg-red-50 text-red-700 border-red-100",
  "Üreme, Doğum ve Jinekoloji": "bg-pink-50 text-pink-700 border-pink-100",
  "Beslenme ve Diyet": "bg-lime-50 text-lime-700 border-lime-100",
  "Sindirim Sistemi (Gastroenteroloji)": "bg-amber-50 text-amber-700 border-amber-100",
  "Solunum Hastalıkları (Pulmonoloji)": "bg-sky-50 text-sky-700 border-sky-100",
};

function VetCard({ vet, index, isDragging }: { vet: Vet; index: number; isDragging: boolean }) {
  const initials = vet.user?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "VH";
  const colorClass = SPECIALTY_COLORS[vet.specialty] || "bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]";
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];

  return (
    <Link
      href={`/veteriner/${vet.id}`}
      onClick={e => isDragging && e.preventDefault()}
      draggable={false}
    >
      <div className="w-48 sm:w-52 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-[#DCFCE7] hover:-translate-y-1 transition-all duration-200 cursor-pointer shrink-0 select-none overflow-hidden group">
        {/* Top gradient area */}
        <div className={`h-24 sm:h-28 bg-gradient-to-br ${gradient} relative flex items-center justify-center`}>
          <div className="absolute top-2 right-2 w-14 h-14 rounded-full bg-white/10" />
          <div className="absolute bottom-0 left-0 w-10 h-10 rounded-full bg-white/10" />
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 border-2 border-white/50 flex items-center justify-center z-10">
            <span className="text-white font-black text-lg sm:text-xl">{initials}</span>
          </div>
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
            <ShieldCheck className="w-3 h-3 text-white" />
            <span className="text-white text-[10px] font-semibold">Doğrulanmış</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          <p className="font-bold text-sm text-gray-900 truncate mb-0.5">
            Vet. Hek. {vet.user?.full_name}
          </p>
          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorClass} mb-2`}>
            {vet.specialty}
          </span>

          {(vet.offers_in_person || vet.offers_video || vet.offers_nobetci) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {vet.offers_in_person && <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-100 font-medium">🏥 Yüz Yüze</span>}
              {vet.offers_video && <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 font-medium">📱 Online</span>}
              {vet.offers_nobetci && <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded-full border border-red-100 font-medium">🚨 Nöbetçi</span>}
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{vet.city}</span>
            </div>
            {vet.average_rating > 0 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-bold text-gray-700">{vet.average_rating.toFixed(1)}</span>
                <span className="text-[10px] text-gray-400">({vet.total_reviews})</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-base font-black text-gray-800">₺{vet.consultation_fee}</p>
              <p className="text-[10px] text-gray-400 -mt-0.5">muayene</p>
            </div>
            <button className="flex items-center gap-1.5 bg-[#F97316] hover:bg-[#EA6A0A] group-hover:shadow-md text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-all active:scale-95 min-h-[44px]">
              <Calendar className="w-3 h-3" />
              Randevu Al
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

const SPEED = 0.6; // px per frame — tweak for faster/slower

export default function VetCarousel({ vets }: { vets?: Vet[] }) {
  const items = vets && vets.length > 0 ? vets : FALLBACK_VETS;
  const doubled = [...items, ...items];

  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const halfWidthRef = useRef(0);

  // Drag state
  const dragRef = useRef({ active: false, startX: 0, startPos: 0, moved: false });
  const [isDragging, setIsDragging] = useState(false);

  // Measure half-width after mount
  useEffect(() => {
    const measure = () => {
      if (trackRef.current) {
        halfWidthRef.current = trackRef.current.scrollWidth / 2;
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [items.length]);

  // Auto-scroll loop
  useEffect(() => {
    const tick = () => {
      if (!pausedRef.current && !dragRef.current.active && trackRef.current) {
        posRef.current += SPEED;
        const half = halfWidthRef.current;
        if (half > 0 && posRef.current >= half) {
          posRef.current -= half;
        }
        trackRef.current.style.transform = `translateX(-${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Pause on hover (desktop)
  const handleMouseEnter = useCallback(() => { pausedRef.current = true; }, []);
  const handleMouseLeave = useCallback(() => {
    if (!dragRef.current.active) pausedRef.current = false;
  }, []);

  // ── Mouse drag ───────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { active: true, startX: e.clientX, startPos: posRef.current, moved: false };
    pausedRef.current = true;
    setIsDragging(false);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 4) dragRef.current.moved = true;
    if (dragRef.current.moved) setIsDragging(true);
    let next = dragRef.current.startPos - dx;
    const half = halfWidthRef.current;
    if (half > 0) {
      if (next < 0) next += half;
      if (next >= half) next -= half;
    }
    posRef.current = next;
    if (trackRef.current) trackRef.current.style.transform = `translateX(-${next}px)`;
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current.active = false;
    pausedRef.current = false;
    setTimeout(() => setIsDragging(false), 50);
  }, []);

  // ── Touch drag ───────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragRef.current = { active: true, startX: e.touches[0].clientX, startPos: posRef.current, moved: false };
    pausedRef.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.touches[0].clientX - dragRef.current.startX;
    if (Math.abs(dx) > 4) dragRef.current.moved = true;
    let next = dragRef.current.startPos - dx;
    const half = halfWidthRef.current;
    if (half > 0) {
      if (next < 0) next += half;
      if (next >= half) next -= half;
    }
    posRef.current = next;
    if (trackRef.current) trackRef.current.style.transform = `translateX(-${next}px)`;
  }, []);

  const onTouchEnd = useCallback(() => {
    dragRef.current.active = false;
    pausedRef.current = false;
    setIsDragging(false);
  }, []);

  return (
    <div
      className="relative overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-r from-[#FAFCFA] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-l from-[#FAFCFA] to-transparent z-10 pointer-events-none" />

      <div
        ref={trackRef}
        className="flex gap-3 sm:gap-4 py-3 px-4 will-change-transform"
        style={{ width: "max-content" }}
      >
        {doubled.map((vet, i) => (
          <VetCard key={`${vet.id}-${i}`} vet={vet} index={i % items.length} isDragging={isDragging} />
        ))}
      </div>
    </div>
  );
}
