"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search, MapPin, Star, ShieldCheck, X, Video,
  ChevronRight, Clock, SlidersHorizontal, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VETERINARY_SPECIALTIES } from "@/lib/constants";

const PAGE_SIZE = 24;

// ── Types ─────────────────────────────────────────────────────────────────────
export type Vet = {
  id: string;
  specialty: string;
  city: string;
  district: string | null;
  average_rating: number | null;
  total_reviews: number | null;
  bio: string | null;
  offers_in_person: boolean | null;
  offers_video: boolean | null;
  offers_nobetci: boolean | null;
  is_verified: boolean | null;
  is_available_today: boolean | null;
  education: string | null;
  video_consultation_fee: number | null;
  consultation_fee: number | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  working_days: string[] | string | null;
  user: { full_name: string; avatar_url: string | null } | null;
};

interface Props {
  vets: Vet[];
  cityMap: Record<string, number>;
  topCities: [string, number][];
  initialCity: string;
  initialSpecialty: string;
  initialQuery: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSpecialties(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [raw];
  } catch {
    return [raw];
  }
}

const DAY_MAP: Record<string, number> = {
  pzt: 1, sal: 2, car: 3, per: 4, cum: 5, cmt: 6, paz: 0,
};
const DAY_LABEL: Record<number, string> = {
  0: "Paz", 1: "Pzt", 2: "Sal", 3: "Çar", 4: "Per", 5: "Cum", 6: "Cmt",
};

function getNextAvailableDay(vet: Vet): string | null {
  const days: string[] = (() => {
    if (!vet.working_days) return [];
    if (Array.isArray(vet.working_days)) return vet.working_days as string[];
    try { const p = JSON.parse(vet.working_days as string); return Array.isArray(p) ? p : []; } catch { return []; }
  })();
  if (days.length === 0) return null;
  const today = new Date().getDay(); // 0=Sun
  // Find the nearest upcoming day (within 7 days)
  for (let offset = 0; offset <= 7; offset++) {
    const d = (today + offset) % 7;
    const key = Object.entries(DAY_MAP).find(([, v]) => v === d)?.[0];
    if (key && days.includes(key)) {
      if (offset === 0) return "Bugün";
      if (offset === 1) return "Yarın";
      return DAY_LABEL[d];
    }
  }
  return null;
}

// ── GPS + Haversine ───────────────────────────────────────────────────────────
type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "done"; lat: number; lng: number };

const CITY_COORDS: Record<string, [number, number]> = {
  "Adana":[37.0,35.3213],"Adıyaman":[37.7648,38.2786],"Afyonkarahisar":[38.7507,30.5567],
  "Ağrı":[39.7191,43.0503],"Amasya":[40.6499,35.8353],"Ankara":[39.9334,32.8597],
  "Antalya":[36.8969,30.7133],"Artvin":[41.1828,41.8183],"Aydın":[37.856,27.8416],
  "Balıkesir":[39.6484,27.8826],"Bilecik":[40.1506,29.9792],"Bingöl":[38.8854,40.4982],
  "Bitlis":[38.3938,42.1232],"Bolu":[40.7359,31.6061],"Burdur":[37.7266,30.2914],
  "Bursa":[40.1885,29.061],"Çanakkale":[40.1553,26.4142],"Çankırı":[40.6013,33.6134],
  "Çorum":[40.5506,34.9556],"Denizli":[37.7765,29.0864],"Diyarbakır":[37.9144,40.2306],
  "Düzce":[40.844,31.1565],"Edirne":[41.6818,26.5623],"Elazığ":[38.681,39.2264],
  "Erzincan":[39.75,39.5],"Erzurum":[39.9208,41.2671],"Eskişehir":[39.7767,30.5206],
  "Gaziantep":[37.0662,37.3833],"Giresun":[40.9128,38.3895],"Gümüşhane":[40.4386,39.4814],
  "Hakkari":[37.5744,43.7408],"Hatay":[36.4018,36.3498],"Iğdır":[39.9237,44.0453],
  "Isparta":[37.7648,30.5566],"İstanbul":[41.0082,28.9784],"İzmir":[38.4192,27.1287],
  "Kahramanmaraş":[37.5858,36.9371],"Karabük":[41.2061,32.6204],"Karaman":[37.1759,33.2287],
  "Kars":[40.6013,43.0975],"Kastamonu":[41.3887,33.7827],"Kayseri":[38.7312,35.4787],
  "Kilis":[36.7184,37.1212],"Kırıkkale":[39.8468,33.5153],"Kırklareli":[41.735,27.2253],
  "Kırşehir":[39.1425,34.1709],"Kocaeli":[40.8533,29.8815],"Konya":[37.8746,32.4932],
  "Kütahya":[39.4167,29.9833],"Malatya":[38.3552,38.3095],"Manisa":[38.6191,27.4289],
  "Mardin":[37.3212,40.7245],"Mersin":[36.8121,34.6415],"Muğla":[37.2153,28.3636],
  "Muş":[38.7458,41.5064],"Nevşehir":[38.6939,34.6857],"Niğde":[39.9667,34.6833],
  "Ordu":[40.9862,37.8797],"Osmaniye":[37.0742,36.2468],"Rize":[41.0201,40.5234],
  "Sakarya":[40.694,30.4358],"Samsun":[41.2867,36.33],"Siirt":[37.9333,41.95],
  "Sinop":[42.0231,35.1531],"Sivas":[39.7477,37.0179],"Şanlıurfa":[37.1591,38.7969],
  "Şırnak":[37.4187,42.4918],"Tekirdağ":[40.9781,27.5117],"Tokat":[40.3167,36.55],
  "Trabzon":[41.0015,39.7178],"Tunceli":[39.1079,39.5401],"Uşak":[38.6823,29.4082],
  "Van":[38.4891,43.4089],"Yalova":[40.65,29.2667],"Yozgat":[39.82,34.8147],
  "Zonguldak":[41.4564,31.7987],"Aksaray":[38.3687,34.037],"Bartın":[41.6344,32.3375],
  "Batman":[37.8812,41.1351],"Bayburt":[40.2552,40.2249],
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Fiyat aralığı ─────────────────────────────────────────────────────────────
type FeeRange = "all" | "0-300" | "300-600" | "600-1000" | "1000+";
const FEE_RANGES: { value: FeeRange; label: string; min: number; max: number }[] = [
  { value: "all",      label: "Tüm Fiyatlar",  min: 0,    max: Infinity },
  { value: "0-300",    label: "₺300 ve altı",   min: 0,    max: 300 },
  { value: "300-600",  label: "₺300 – ₺600",    min: 300,  max: 600 },
  { value: "600-1000", label: "₺600 – ₺1000",   min: 600,  max: 1000 },
  { value: "1000+",    label: "₺1000 ve üzeri", min: 1000, max: Infinity },
];

type SortOption = "rating" | "available" | "fee_asc" | "proximity";
type ServiceFilter = "in_person" | "video" | "nobetci";

// ── Component ─────────────────────────────────────────────────────────────────
export default function VetCityFilterClient({
  vets, cityMap, topCities, initialCity, initialSpecialty, initialQuery,
}: Props) {
  const [city,          setCity]          = useState(initialCity);
  const [district,      setDistrict]      = useState("");
  const [specialty,     setSpecialty]     = useState(initialSpecialty);
  const [query,         setQuery]         = useState(initialQuery);
  const [services,      setServices]      = useState<ServiceFilter[]>([]);
  const [availToday,    setAvailToday]    = useState(false);
  const [sort,          setSort]          = useState<SortOption>("rating");
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE);
  const [showFilters,   setShowFilters]   = useState(false);
  const [geo,           setGeo]           = useState<GeoState>({ status: "idle" });
  const [feeRange,      setFeeRange]      = useState<FeeRange>("all");

  // Reset pagination when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [city, district, specialty, query, services, availToday, sort, feeRange, geo]);
  // Reset district when city changes
  useEffect(() => { setDistrict(""); }, [city]);

  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeo({ status: "unsupported" }); return; }
    setGeo({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeo({ status: "done", lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSort("proximity");
      },
      () => setGeo({ status: "denied" }),
      { timeout: 8000 }
    );
  }, []);

  // Unique districts for selected city
  const districts = useMemo(() => {
    const set = new Set<string>();
    vets.filter(v => !city || v.city === city).forEach(v => { if (v.district) set.add(v.district); });
    return Array.from(set).sort();
  }, [vets, city]);

  // Pre-compute distances (only when GPS resolved)
  const vetDistances = useMemo<Map<string, number>>(() => {
    if (geo.status !== "done") return new Map();
    const map = new Map<string, number>();
    vets.forEach(v => {
      const coords = CITY_COORDS[v.city];
      if (coords) map.set(v.id, haversineKm(geo.lat, geo.lng, coords[0], coords[1]));
    });
    return map;
  }, [vets, geo]);

  // Filter + sort
  const feeRangeConfig = FEE_RANGES.find(r => r.value === feeRange)!;
  const filtered = useMemo(() => {
    let list = vets.filter(v => {
      if (city && v.city !== city) return false;
      if (district && v.district !== district) return false;
      if (specialty && !getSpecialties(v.specialty).includes(specialty)) return false;
      if (services.includes("in_person") && !v.offers_in_person) return false;
      if (services.includes("video")     && !v.offers_video)     return false;
      if (services.includes("nobetci")   && !v.offers_nobetci)   return false;
      if (availToday && !v.is_available_today) return false;
      if (feeRange !== "all") {
        const fee = v.consultation_fee ?? v.video_consultation_fee ?? 0;
        if (fee < feeRangeConfig.min || fee > feeRangeConfig.max) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        const name = (Array.isArray(v.user) ? v.user[0] : v.user)?.full_name?.toLowerCase() || "";
        if (!name.includes(q) && !v.city?.toLowerCase().includes(q) &&
            !getSpecialties(v.specialty).some(s => s.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    if (sort === "rating")    list = [...list].sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
    if (sort === "available") list = [...list].sort((a, b) => (b.is_available_today ? 1 : 0) - (a.is_available_today ? 1 : 0));
    if (sort === "fee_asc")   list = [...list].sort((a, b) => (a.video_consultation_fee || a.consultation_fee || 999) - (b.video_consultation_fee || b.consultation_fee || 999));
    if (sort === "proximity") list = [...list].sort((a, b) => (vetDistances.get(a.id) ?? Infinity) - (vetDistances.get(b.id) ?? Infinity));
    return list;
  }, [vets, city, district, specialty, query, services, availToday, sort, feeRange, feeRangeConfig, vetDistances]);

  const toggleService = (s: ServiceFilter) =>
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const clearAll = () => {
    setCity(""); setDistrict(""); setSpecialty(""); setQuery("");
    setServices([]); setAvailToday(false); setSort("rating");
    setFeeRange("all"); setGeo({ status: "idle" });
  };
  const hasFilters = city || district || specialty || query || services.length > 0 || availToday || feeRange !== "all" || geo.status === "done";
  const activeFilterCount = [city, district, specialty, query, availToday, feeRange !== "all", geo.status === "done"].filter(Boolean).length + services.length;

  return (
    <div className="space-y-5">

      {/* ── Search + filter bar ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">

        {/* Row 1: search + mobile filter toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Veteriner adı, şehir veya uzmanlık…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
            />
          </div>
          <button
            data-testid="expand-filters-btn"
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0
                ? "bg-[#166534] text-white border-[#166534]"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtrele
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-[#166534] text-[11px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: always-visible quick filters */}
        <div className="flex flex-wrap gap-2">
          {/* City */}
          <select
            value={city}
            onChange={e => setCity(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 bg-white min-w-[130px]"
          >
            <option value="">Tüm Şehirler</option>
            {topCities.map(([c, count]) => (
              <option key={c} value={c}>{c} ({count})</option>
            ))}
          </select>

          {/* District — only when city selected and districts exist */}
          {city && districts.length > 1 && (
            <select
              value={district}
              onChange={e => setDistrict(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 bg-white min-w-[130px]"
            >
              <option value="">Tüm İlçeler</option>
              {districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          {/* Service type pills */}
          {(
            [
              { key: "in_person" as ServiceFilter, label: "🏥 Yüz Yüze" },
              { key: "video"     as ServiceFilter, label: "📱 Online"    },
              { key: "nobetci"   as ServiceFilter, label: "🚨 Nöbetçi"  },
            ]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleService(key)}
              className={`px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                services.includes(key)
                  ? "bg-[#166534] text-white border-[#166534]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}

          {/* Today available toggle */}
          <button
            onClick={() => setAvailToday(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
              availToday
                ? "bg-[#166534] text-white border-[#166534]"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="text-[10px]">{availToday ? "🟢" : "⚫"}</span>
            Bugün Müsait
          </button>

          {/* GPS proximity button */}
          {geo.status === "idle" && (
            <button
              data-testid="gps-btn"
              onClick={handleDetectLocation}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium border-gray-200 text-gray-600 hover:border-gray-300 bg-white transition-colors"
            >
              <MapPin className="w-4 h-4" /> Yakınımdakiler
            </button>
          )}
          {geo.status === "loading" && (
            <button disabled className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium border-gray-200 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Konum alınıyor…
            </button>
          )}
          {geo.status === "unsupported" && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm border-gray-200 text-gray-400">
              <MapPin className="w-4 h-4" /> Desteklenmiyor
            </span>
          )}
          {geo.status === "denied" && (
            <button
              onClick={handleDetectLocation}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium border-orange-200 bg-orange-50 text-orange-600 hover:border-orange-300 transition-colors"
            >
              <MapPin className="w-4 h-4" /> Konum izni gerekli
            </button>
          )}
          {geo.status === "done" && (
            <button
              onClick={() => { setGeo({ status: "idle" }); if (sort === "proximity") setSort("rating"); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium bg-[#166534] text-white border-[#166534] transition-colors"
            >
              <MapPin className="w-4 h-4" /> Yakına Göre <X className="w-3.5 h-3.5 ml-0.5" />
            </button>
          )}
        </div>

        {/* Row 3: expanded filters */}
        {showFilters && (
          <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-3">
            {/* Specialty */}
            <select
              value={specialty}
              onChange={e => setSpecialty(e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 bg-white"
            >
              <option value="">Tüm Uzmanlıklar</option>
              {VETERINARY_SPECIALTIES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Fee range */}
            <select
              data-testid="fee-range-select"
              value={feeRange}
              onChange={e => setFeeRange(e.target.value as FeeRange)}
              className="flex-1 min-w-[180px] px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 bg-white"
            >
              {FEE_RANGES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortOption)}
              className="flex-1 min-w-[180px] px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 bg-white"
            >
              <option value="rating">Sırala: En Yüksek Puan</option>
              <option value="available">Sırala: Bugün Müsait Önce</option>
              <option value="fee_asc">Sırala: En Düşük Ücret</option>
              {geo.status === "done" && (
                <option value="proximity">Sırala: Yakınımdakiler</option>
              )}
            </select>
          </div>
        )}
      </div>

      {/* ── City quick-select pills (only when no city selected) ─────────── */}
      {!city && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Popüler Şehirler</p>
          <div className="flex flex-wrap gap-2">
            {topCities.slice(0, 12).map(([c, count]) => (
              <button
                key={c}
                onClick={() => setCity(c)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm hover:border-[#166534] hover:text-[#166534] transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                {c}
                <span className="text-xs text-gray-400">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Active filter summary ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {city && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-[#F0FDF4] text-[#166534] border border-[#166534]/20 rounded-full text-xs font-medium">
              <MapPin className="w-3 h-3" />
              {city}
              {district && ` · ${district}`}
              <button onClick={() => { setCity(""); setDistrict(""); }} className="ml-1 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {services.map(s => (
            <span key={s} className="flex items-center gap-1 px-2.5 py-1 bg-[#F0FDF4] text-[#166534] border border-[#166534]/20 rounded-full text-xs font-medium">
              {s === "in_person" ? "🏥 Yüz Yüze" : s === "video" ? "📱 Online" : "🚨 Nöbetçi"}
              <button onClick={() => toggleService(s)} className="ml-1 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {availToday && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-[#F0FDF4] text-[#166534] border border-[#166534]/20 rounded-full text-xs font-medium">
              🟢 Bugün Müsait
              <button onClick={() => setAvailToday(false)} className="ml-1 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500" data-testid="result-count">
            <strong className="text-gray-900">{filtered.length}</strong> veteriner
          </p>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearAll} className="text-gray-500 h-7 text-xs">
              <X className="w-3 h-3 mr-1" /> Temizle
            </Button>
          )}
        </div>
      </div>

      {/* ── Vet grid ─────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Kriterlere uygun veteriner bulunamadı</p>
          <p className="text-xs text-gray-400 mt-1">Filtreleri değiştirerek tekrar deneyin</p>
          <button onClick={clearAll} className="mt-3 text-sm text-[#166534] hover:underline font-medium">
            Tüm filtreleri temizle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.slice(0, visibleCount).map(vet => (
            <VetCard key={vet.id} vet={vet} distanceKm={vetDistances.get(vet.id)} />
          ))}
        </div>
      )}

      {/* ── Load more ────────────────────────────────────────────────────── */}
      {filtered.length > visibleCount && (
        <div className="text-center pt-2">
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            className="px-6 py-2.5 rounded-xl border border-[#166534] text-[#166534] text-sm font-semibold hover:bg-[#166534] hover:text-white transition-colors"
          >
            Daha Fazla Yükle ({filtered.length - visibleCount} kaldı)
          </button>
        </div>
      )}
    </div>
  );
}

// ── VetCard ───────────────────────────────────────────────────────────────────
function VetCard({ vet, distanceKm }: { vet: Vet; distanceKm?: number }) {
  const user         = Array.isArray(vet.user) ? vet.user[0] : vet.user;
  const initials     = user?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "V";
  const specs        = getSpecialties(vet.specialty);
  const nextAvail    = getNextAvailableDay(vet);
  const isToday      = vet.is_available_today;
  const minFee       = vet.video_consultation_fee || vet.consultation_fee;

  return (
    <Link
      href={`/veteriner/${vet.id}`}
      className="group flex flex-col bg-white rounded-2xl border border-gray-200 hover:border-[#166534] hover:shadow-lg transition-all duration-200 overflow-hidden"
    >
      {/* Availability banner */}
      {isToday && (
        <div className="bg-[#166534] text-white text-[11px] font-bold px-4 py-1.5 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          Bugün Müsait — Hemen Randevu Al
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 bg-[#DCFCE7] rounded-2xl flex items-center justify-center text-xl font-black text-[#166534] shrink-0 overflow-hidden border-2 border-[#DCFCE7] group-hover:border-[#166534]/30 transition-colors">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
            ) : initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <p className="font-bold text-gray-900 text-sm leading-tight">Vet. Hek. {user?.full_name}</p>
              {vet.is_verified && <ShieldCheck className="w-4 h-4 text-[#166534] shrink-0" />}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
              {specs.slice(0, 2).join(" · ") || vet.specialty}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500">
                {[vet.district, vet.city].filter(Boolean).join(", ")}
              </span>
              {distanceKm !== undefined && (
                <span className="text-xs text-[#166534] font-semibold ml-1">
                  · {distanceKm < 1 ? "<1 km" : `~${Math.round(distanceKm)} km`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rating */}
        {vet.average_rating && vet.average_rating > 0 ? (
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(s => (
              <Star
                key={s}
                className={`w-3.5 h-3.5 ${s <= Math.round(vet.average_rating!) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`}
              />
            ))}
            <span className="text-xs text-gray-600 ml-1">
              {vet.average_rating.toFixed(1)}
              <span className="text-gray-400"> ({vet.total_reviews})</span>
            </span>
          </div>
        ) : null}

        {/* Bio */}
        {vet.bio && (
          <p className="text-xs text-gray-500 line-clamp-2 flex-1">{vet.bio}</p>
        )}

        {/* Service + fee row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {vet.offers_in_person && (
            <span className="text-[11px] px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full font-medium">
              🏥 Yüz Yüze
            </span>
          )}
          {vet.offers_video && (
            <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium flex items-center gap-1">
              <Video className="w-2.5 h-2.5" /> Online
            </span>
          )}
          {vet.offers_nobetci && (
            <span className="text-[11px] px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full font-medium">
              🚨 Nöbetçi
            </span>
          )}
          {minFee && (
            <span className="ml-auto text-xs font-bold text-[#166534]">₺{minFee}+</span>
          )}
        </div>

        {/* Working hours + next availability */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            {vet.working_hours_start && vet.working_hours_end ? (
              <>
                <Clock className="w-3 h-3" />
                {vet.working_hours_start} – {vet.working_hours_end}
              </>
            ) : nextAvail ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-[#166534]" />
                <span className="text-[#166534] font-medium">{nextAvail} müsait</span>
              </>
            ) : null}
          </div>
          <span className="text-xs text-[#166534] font-semibold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
            Randevu Al <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
