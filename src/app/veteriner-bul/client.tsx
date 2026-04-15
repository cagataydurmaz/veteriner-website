"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { MapPin, Star, ShieldCheck, X, Video, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VETERINARY_SPECIALTIES } from "@/lib/constants";

export type Vet = {
  id: string;
  specialty: string;
  city: string;
  district?: string | null;
  average_rating: number | null;
  total_reviews: number | null;
  bio: string | null;
  consultation_fee: number | null;
  video_consultation_fee: number | null;
  offers_in_person: boolean | null;
  offers_video: boolean | null;
  offers_nobetci: boolean | null;
  is_available_today?: boolean | null;
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

// ── Geo state machine ─────────────────────────────────────────────────────────
type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "done"; city: string; district: string; lat: number; lng: number };

// ── City centroid coordinates (WGS-84) for proximity sort ─────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  "Adana": [37.0, 35.3213], "Adıyaman": [37.7648, 38.2786],
  "Afyonkarahisar": [38.7507, 30.5567], "Ağrı": [39.7191, 43.0503],
  "Amasya": [40.6499, 35.8353], "Ankara": [39.9334, 32.8597],
  "Antalya": [36.8969, 30.7133], "Artvin": [41.1828, 41.8183],
  "Aydın": [37.856, 27.8416], "Balıkesir": [39.6484, 27.8826],
  "Bilecik": [40.1506, 29.9792], "Bingöl": [38.8854, 40.4982],
  "Bitlis": [38.3938, 42.1232], "Bolu": [40.7359, 31.6061],
  "Burdur": [37.7266, 30.2914], "Bursa": [40.1885, 29.061],
  "Çanakkale": [40.1553, 26.4142], "Çankırı": [40.6013, 33.6134],
  "Çorum": [40.5506, 34.9556], "Denizli": [37.7765, 29.0864],
  "Diyarbakır": [37.9144, 40.2306], "Düzce": [40.844, 31.1565],
  "Edirne": [41.6818, 26.5623], "Elazığ": [38.6810, 39.2264],
  "Erzincan": [39.75, 39.5], "Erzurum": [39.9208, 41.2671],
  "Eskişehir": [39.7767, 30.5206], "Gaziantep": [37.0662, 37.3833],
  "Giresun": [40.9128, 38.3895], "Gümüşhane": [40.4386, 39.4814],
  "Hakkari": [37.5744, 43.7408], "Hatay": [36.4018, 36.3498],
  "Iğdır": [39.9237, 44.0453], "Isparta": [37.7648, 30.5566],
  "İstanbul": [41.0082, 28.9784], "İzmir": [38.4192, 27.1287],
  "Kahramanmaraş": [37.5858, 36.9371], "Karabük": [41.2061, 32.6204],
  "Karaman": [37.1759, 33.2287], "Kars": [40.6013, 43.0975],
  "Kastamonu": [41.3887, 33.7827], "Kayseri": [38.7312, 35.4787],
  "Kilis": [36.7184, 37.1212], "Kırıkkale": [39.8468, 33.5153],
  "Kırklareli": [41.735, 27.2253], "Kırşehir": [39.1425, 34.1709],
  "Kocaeli": [40.8533, 29.8815], "Konya": [37.8746, 32.4932],
  "Kütahya": [39.4167, 29.9833], "Malatya": [38.3552, 38.3095],
  "Manisa": [38.6191, 27.4289], "Mardin": [37.3212, 40.7245],
  "Mersin": [36.8121, 34.6415], "Muğla": [37.2153, 28.3636],
  "Muş": [38.7458, 41.5064], "Nevşehir": [38.6939, 34.6857],
  "Niğde": [37.9667, 34.6833], "Ordu": [40.9862, 37.8797],
  "Osmaniye": [37.0742, 36.2468], "Rize": [41.0201, 40.5234],
  "Sakarya": [40.6940, 30.4358], "Samsun": [41.2867, 36.33],
  "Siirt": [37.9333, 41.9500], "Sinop": [42.0231, 35.1531],
  "Sivas": [39.7477, 37.0179], "Şanlıurfa": [37.1591, 38.7969],
  "Şırnak": [37.4187, 42.4918], "Tekirdağ": [40.9781, 27.5117],
  "Tokat": [40.3167, 36.55], "Trabzon": [41.0015, 39.7178],
  "Tunceli": [39.1079, 39.5401], "Uşak": [38.6823, 29.4082],
  "Van": [38.4891, 43.4089], "Yalova": [40.6500, 29.2667],
  "Yozgat": [39.82, 34.8147], "Zonguldak": [41.4564, 31.7987],
  "Aksaray": [38.3687, 34.0370], "Bartın": [41.6344, 32.3375],
  "Batman": [37.8812, 41.1351], "Bayburt": [40.2552, 40.2249],
};

/** Haversine distance in km between two WGS-84 coordinates */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── City / district data ──────────────────────────────────────────────────────
const POPULAR_CITIES = [
  "İstanbul", "Ankara", "İzmir", "Bursa",
  "Antalya", "Adana", "Kocaeli", "Gaziantep",
];

const CITY_DISTRICTS: Record<string, string[]> = {
  "İstanbul": ["Adalar","Arnavutköy","Ataşehir","Avcılar","Bağcılar","Bahçelievler","Bakırköy","Başakşehir","Beşiktaş","Beykoz","Beylikdüzü","Beyoğlu","Çekmeköy","Esenler","Esenyurt","Eyüpsultan","Fatih","Gaziosmanpaşa","Güngören","Kadıköy","Kağıthane","Kartal","Küçükçekmece","Maltepe","Pendik","Sancaktepe","Sarıyer","Şişli","Sultanbeyli","Tuzla","Ümraniye","Üsküdar","Zeytinburnu"],
  "Ankara": ["Çankaya","Keçiören","Mamak","Etimesgut","Yenimahalle","Sincan","Altındağ","Pursaklar","Gölbaşı","Kahramankazan","Çubuk","Elmadağ","Polatlı","Haymana"],
  "İzmir": ["Konak","Bornova","Buca","Karşıyaka","Çiğli","Gaziemir","Bayraklı","Balçova","Karabağlar","Güzelbahçe","Narlıdere","Menemen","Torbalı","Kemalpaşa","Bergama","Selçuk","Çeşme","Urla","Aliağa","Tire"],
  "Bursa": ["Osmangazi","Nilüfer","Yıldırım","Gemlik","İnegöl","Mudanya","Mustafakemalpaşa","Gürsu","Kestel","Orhangazi","İznik","Karacabey","Yenişehir"],
  "Antalya": ["Muratpaşa","Kepez","Konyaaltı","Alanya","Manavgat","Serik","Döşemealtı","Aksu","Kemer","Kaş","Finike","Kumluca"],
  "Adana": ["Seyhan","Çukurova","Yüreğir","Sarıçam","Ceyhan","Kozan","Karataş","Pozantı","İmamoğlu"],
  "Kocaeli": ["İzmit","Gebze","Körfez","Darıca","Başiskele","Çayırova","Gölcük","Kartepe","Derince","Dilovası","Kandıra","Karamürsel"],
  "Gaziantep": ["Şahinbey","Şehitkamil","Nizip","İslahiye","Nurdağı","Oğuzeli","Karkamış","Araban"],
  "Konya": ["Selçuklu","Karatay","Meram","Ereğli","Akşehir","Beyşehir","Çumra","Kulu","Seydişehir","Ilgın"],
  "Mersin": ["Yenişehir","Mezitli","Toroslar","Akdeniz","Tarsus","Erdemli","Silifke","Anamur","Mut"],
};

const ALL_CITIES = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin",
  "Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur",
  "Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan",
  "Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul",
  "İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kilis","Kırıkkale","Kırklareli",
  "Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş",
  "Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas",
  "Şanlıurfa","Şırnak","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak",
];

const SELECT_CLASS = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30 appearance-none cursor-pointer min-h-[44px]";

// ── Nominatim helpers ─────────────────────────────────────────────────────────
function extractNominatimCity(addr: Record<string, string>): string {
  const raw =
    addr.province || addr.state || addr.city ||
    addr.county   || addr.town  || addr.village || "";
  // Strip common suffixes like "Province", "İli", "Şehri"
  return raw.replace(/\s*(Province|İli|Şehri|İlçesi)\s*/gi, "").trim();
}

function extractNominatimDistrict(addr: Record<string, string>): string {
  // Nominatim TR: county = ilçe, suburb = mahalle
  const raw = addr.county || addr.municipality || addr.suburb || "";
  return raw.replace(/\s*(İlçesi|District)\s*/gi, "").trim();
}

function matchCity(raw: string): string {
  return ALL_CITIES.find(c => c.toLowerCase() === raw.toLowerCase()) ?? "";
}

function matchDistrict(city: string, raw: string): string {
  const list = CITY_DISTRICTS[city] ?? [];
  return list.find(d => d.toLowerCase() === raw.toLowerCase()) ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────

export default function VetListClient({
  vets, initialCity, initialSpecialty, initialQuery
}: Props) {
  const PAGE_SIZE_VET = 24;
  const [city, setCity]           = useState(initialCity);
  const [district, setDistrict]   = useState("");
  const [specialty, setSpecialty] = useState(initialSpecialty);
  const [availableToday, setAvailableToday] = useState(false);
  const [geo, setGeo]             = useState<GeoState>({ status: "idle" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE_VET);

  // Mark as unsupported on mount if API missing
  useEffect(() => {
    if (typeof window !== "undefined" && !("geolocation" in navigator)) {
      setGeo({ status: "unsupported" });
    }
  }, []);

  const districts = city ? (CITY_DISTRICTS[city] ?? []) : [];

  const handleCityChange = (val: string) => {
    setCity(val);
    setDistrict("");
    // Clear geo "done" badge when user manually picks a different city
    if (geo.status === "done") setGeo({ status: "idle" });
  };

  // ── Geo detection ───────────────────────────────────────────────────────────
  const handleDetectLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "unsupported" });
      return;
    }
    setGeo({ status: "loading" });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { "Accept-Language": "tr" } }
          );
          const data = await res.json();
          const addr = (data.address ?? {}) as Record<string, string>;

          const rawCity     = extractNominatimCity(addr);
          const rawDistrict = extractNominatimDistrict(addr);

          const matchedCity     = matchCity(rawCity);
          const matchedDistrict = matchedCity ? matchDistrict(matchedCity, rawDistrict) : "";

          setGeo({ status: "done", city: matchedCity || rawCity, district: matchedDistrict, lat, lng: lon });
          setCity(matchedCity || rawCity);
          setDistrict(matchedDistrict);
        } catch {
          setGeo({ status: "idle" });
        }
      },
      (err) => {
        // PERMISSION_DENIED=1, POSITION_UNAVAILABLE=2, TIMEOUT=3
        // All cases → show the same friendly "denied" state with manual selection
        console.warn("Geolocation error:", err.code, err.message);
        setGeo({ status: "denied" });
      },
      { timeout: 8000 }
    );
  }, []);

  // ── Filter + proximity sort ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const base = vets.filter(v => {
      if (city      && v.city      !== city)     return false;
      if (district  && v.district  !== district) return false;
      if (specialty && v.specialty !== specialty) return false;
      if (availableToday && !v.is_available_today) return false;
      if (initialQuery) {
        const q = initialQuery.toLowerCase();
        return (
          v.user?.full_name?.toLowerCase().includes(q) ||
          v.city?.toLowerCase().includes(q) ||
          v.specialty?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Proximity sort: when user granted location and no city filter is active,
    // sort by Haversine distance to vet city centroid so nearest vets appear first.
    // Vets whose city isn't in the coordinates map sink to the end, sorted by rating.
    if (geo.status === "done" && !city) {
      const { lat, lng } = geo;
      return [...base].sort((a, b) => {
        const coordsA = CITY_COORDS[a.city];
        const coordsB = CITY_COORDS[b.city];
        if (!coordsA && !coordsB) return (b.average_rating ?? 0) - (a.average_rating ?? 0);
        if (!coordsA) return 1;
        if (!coordsB) return -1;
        const distA = haversineKm(lat, lng, coordsA[0], coordsA[1]);
        const distB = haversineKm(lat, lng, coordsB[0], coordsB[1]);
        // Within same city (dist diff < 30km): break ties by rating
        if (Math.abs(distA - distB) < 30) return (b.average_rating ?? 0) - (a.average_rating ?? 0);
        return distA - distB;
      });
    }

    return base;
  }, [vets, city, district, specialty, availableToday, initialQuery, geo]);

  // Reset pagination on filter change
  useEffect(() => { setVisibleCount(PAGE_SIZE_VET); }, [city, district, specialty, availableToday]);

  const hasFilters = city || district || specialty || availableToday;
  const clearFilters = () => {
    setCity(""); setDistrict(""); setSpecialty(""); setAvailableToday(false);
    if (geo.status === "done") setGeo({ status: "idle" });
  };

  return (
    <div className="space-y-6">

      {/* ── Filter card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">

        {/* Location detect button — hidden only when browser lacks geolocation */}
        {geo.status !== "unsupported" && (
          <button
            onClick={handleDetectLocation}
            disabled={geo.status === "loading"}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-wait ${
              geo.status === "done"
                ? "border-[#1A6B4A] bg-[#F0FDF4] text-[#1A6B4A]"
                : "border-[#1A6B4A] text-[#1A6B4A] hover:bg-[#F0FDF4] active:bg-[#DCFCE7]"
            }`}
          >
            {geo.status === "loading" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Konum alınıyor…</>
            ) : geo.status === "done" ? (
              <><MapPin className="w-4 h-4" />
                📍 {geo.city}{geo.district ? ` / ${geo.district}` : ""} — konumunuz algılandı
              </>
            ) : (
              <><MapPin className="w-4 h-4" /> 📍 Konumumu Kullan</>
            )}
          </button>
        )}

        {/* Denied warning — friendly, actionable */}
        {geo.status === "denied" && (
          <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-center leading-relaxed space-y-1.5">
            <p className="text-amber-800 font-medium">
              📍 Konum erişimi reddedildi veya kullanılamıyor.
            </p>
            <p className="text-amber-700">
              Aşağıdan şehrinizi manuel olarak seçerek yakınınızdaki veterinerleri bulabilirsiniz.
            </p>
          </div>
        )}

        {/* Divider label */}
        {geo.status !== "unsupported" && (
          <p className="text-xs font-semibold text-gray-400 -mb-1">veya manuel seçin:</p>
        )}

        {/* Dropdowns row */}
        <div className="flex flex-wrap gap-3 items-end">

          {/* Şehir */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Şehir</label>
            <div className="relative">
              <select
                value={city}
                onChange={e => handleCityChange(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Tüm Şehirler</option>
                {ALL_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* İlçe — only when city has known districts */}
          {city && districts.length > 0 && (
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">İlçe</label>
              <div className="relative">
                <select
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">Tüm İlçeler</option>
                  {districts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          )}

          {/* Uzmanlık */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Uzmanlık</label>
            <div className="relative">
              <select
                value={specialty}
                onChange={e => setSpecialty(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Tüm Uzmanlıklar</option>
                {VETERINARY_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Bugün Müsait toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-semibold text-gray-500">Bugün Müsait</label>
            <button
              onClick={() => setAvailableToday(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                availableToday
                  ? "bg-[#1A6B4A] text-white border-[#1A6B4A]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#1A6B4A] hover:text-[#1A6B4A]"
              }`}
            >
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${availableToday ? "border-white bg-white" : "border-gray-300"}`}>
                {availableToday && <span className="w-2 h-2 rounded-full bg-[#1A6B4A]" />}
              </span>
              Müsait
            </button>
          </div>

          {/* Clear */}
          {hasFilters && (
            <div className="flex flex-col gap-1.5">
              <label className="block text-xs font-semibold text-transparent select-none">.</label>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Temizle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Popular city pills ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">Hızlı:</span>
        {POPULAR_CITIES.map(c => (
          <button
            key={c}
            onClick={() => handleCityChange(city === c ? "" : c)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              city === c
                ? "bg-[#1A6B4A] text-white border-[#1A6B4A]"
                : "border-[#1A6B4A] text-[#1A6B4A] hover:bg-[#1A6B4A] hover:text-white"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ── Active city heading ───────────────────────────────────────────── */}
      {city && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <MapPin className="w-5 h-5 text-[#1A6B4A]" />
            <h2 className="text-xl font-bold text-gray-900">
              {district ? `${city} / ${district}` : city} Veterinerleri
            </h2>
            <span className="text-sm text-gray-500">({filtered.length} veteriner)</span>
          </div>
          <button onClick={clearFilters} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Result count ──────────────────────────────────────────────────── */}
      {!city && (
        <p className="text-sm text-gray-500">
          <strong className="text-gray-900">{filtered.length}</strong> veteriner bulundu
          {specialty && ` · ${specialty}`}
        </p>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <span className="text-5xl block mb-4">🐾</span>
          <p className="text-gray-700 font-semibold mb-2">
            {availableToday
              ? "Bugün müsait veteriner bulunamadı."
              : city
              ? `${city}${district ? ` / ${district}` : ""} bölgesinde henüz veteriner bulunmuyor.`
              : "Bu kriterlere uygun veteriner bulunamadı."}
          </p>
          <p className="text-gray-500 text-sm mb-4">
            {availableToday
              ? "Yarın tekrar deneyin veya tüm veterinerleri görün."
              : "Yakında bu bölgede veterinerler platformumuza katılacak 🐾"}
          </p>
          <button onClick={clearFilters} className="text-sm text-[#1A6B4A] hover:underline font-medium">
            Tüm veterinerleri göster
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.slice(0, visibleCount).map(vet => {
            const user = Array.isArray(vet.user) ? vet.user[0] : vet.user;
            const initials = user?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "V";
            return (
              <Link key={vet.id} href={`/veteriner/${vet.id}`}>
                <div className="bg-white rounded-2xl border border-gray-200 hover:border-[#1A6B4A] hover:shadow-md transition-all p-5 group h-full flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-14 h-14 bg-[#DCFCE7] rounded-2xl flex items-center justify-center text-xl font-black text-[#1A6B4A] shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-900 text-sm">Vet. Hek. {user?.full_name}</p>
                          <p className="text-xs text-gray-500">{vet.specialty}</p>
                        </div>
                        <ShieldCheck className="w-4 h-4 text-[#1A6B4A] shrink-0 mt-0.5" />
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {vet.city}{vet.district ? ` / ${vet.district}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {vet.average_rating && vet.average_rating > 0 && (
                    <div className="flex items-center gap-1 mb-2">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(vet.average_rating!) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`} />
                      ))}
                      <span className="text-xs text-gray-600 ml-1">
                        {vet.average_rating.toFixed(1)} ({vet.total_reviews})
                      </span>
                    </div>
                  )}

                  {vet.bio && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{vet.bio}</p>}

                  <div className="flex items-center justify-between mt-auto pt-2">
                    <div className="flex gap-1 flex-wrap">
                      {vet.offers_in_person && (
                        <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">🏥 Yüz Yüze</Badge>
                      )}
                      {vet.offers_video && (
                        <Badge variant="default" className="text-xs">
                          <Video className="w-3 h-3 mr-1" />Online
                        </Badge>
                      )}
                      {vet.offers_nobetci && (
                        <Badge variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-200">🚨 Nöbetçi</Badge>
                      )}
                    </div>
                    <span className="text-xs text-[#1A6B4A] font-semibold flex items-center gap-1 group-hover:gap-2 transition-all whitespace-nowrap">
                      Randevu Al <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {filtered.length > visibleCount && (
        <div className="text-center pt-2">
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE_VET)}
            className="px-6 py-2.5 rounded-xl border border-[#1A6B4A] text-[#1A6B4A] text-sm font-semibold hover:bg-[#1A6B4A] hover:text-white transition-colors"
          >
            Daha Fazla Yükle ({filtered.length - visibleCount} kaldı)
          </button>
        </div>
      )}
    </div>
  );
}
