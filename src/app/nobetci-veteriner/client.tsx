"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  MapPin, Star, ShieldCheck, ChevronRight,
  Loader2, ChevronDown, Video, Zap, X,
  CreditCard, AlertTriangle, Clock, Check,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// Lazy-load map to keep initial bundle small
const ClinicMap = dynamic(() => import("@/components/ClinicMap"), {
  ssr: false,
  loading: () => <div className="h-28 rounded-xl bg-gray-100 animate-pulse" />,
});

export type VetRow = {
  id: string;
  specialty: string;
  city: string;
  average_rating: number | null;
  total_reviews: number | null;
  nobetci_fee: number | null;
  video_consultation_fee: number | null;
  offers_nobetci: boolean | null;
  user: { full_name: string } | null;
};

interface Props {
  vets: VetRow[];
  cities: string[];
}

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "done"; city: string; lat: number; lng: number };

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

// Modal flow states
type ModalStep =
  | "info"       // Step 1: pet selector + complaint
  | "payment"    // Step 2: card entry
  | "waiting"    // Step 3: waiting for vet to accept (countdown)
  | "declined"   // Vet declined / timed out
  | "accepted";  // Vet accepted — redirecting

const SELECT_CLASS =
  "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-red-400/30 appearance-none cursor-pointer min-h-[44px]";

function extractCity(addr: Record<string, string>): string {
  return addr.province || addr.state || addr.city || addr.county || addr.town || addr.village || "";
}

function normaliseCity(raw: string): string {
  return raw.replace(/\s*(Province|İli|Şehri|İlçesi|İlçe)\s*/gi, "").trim();
}

function formatCard(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

export default function NobetciVeterinerClient({ vets, cities }: Props) {
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState("");
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });

  // Booking modal state
  const [bookingVet, setBookingVet] = useState<VetRow | null>(null);
  const [pets, setPets] = useState<{ id: string; name: string; species: string }[]>([]);
  const [selectedPet, setSelectedPet] = useState("");
  const [complaint, setComplaint] = useState("");
  const [card, setCard] = useState({ holder: "", number: "", month: "", year: "", cvc: "" });
  const [paying, setPaying] = useState(false);
  const [step, setStep] = useState<ModalStep>("info");

  // Waiting state
  const [requestId, setRequestId]     = useState<string | null>(null);
  const [expiresAt, setExpiresAt]     = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(90);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !("geolocation" in navigator)) {
      setGeo({ status: "unsupported" });
    }
  }, []);

  // Load pets when modal opens
  useEffect(() => {
    if (!bookingVet) return;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("pets")
        .select("id, name, species")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      setPets(data || []);
      if (data?.length) setSelectedPet(data[0].id);
    })();
  }, [bookingVet]);

  // Countdown timer during "waiting" step
  useEffect(() => {
    if (step !== "waiting" || !expiresAt) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const updateTimer = () => {
      const diff = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        setStep("declined");
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step, expiresAt]);

  // Realtime subscription: watch for vet response
  useEffect(() => {
    if (step !== "waiting" || !requestId) return;

    const supabase = createClient();
    const channel  = supabase
      .channel(`owner-request-${requestId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "instant_requests",
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          const row = payload.new as {
            status: string;
            video_room_url?: string;
            appointment_id?: string;
          };

          if (row.status === "accepted") {
            setStep("accepted");
            toast.success("Veteriner kabul etti! Video odası açılıyor…");
            setTimeout(() => {
              router.push(row.video_room_url || `/video/${row.appointment_id}`);
            }, 1500);
          } else if (row.status === "declined") {
            setStep("declined");
          } else if (row.status === "timeout") {
            setStep("declined");
          }
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [step, requestId, router]);

  // Location detection
  const handleDetectLocation = useCallback(() => {
    if (!("geolocation" in navigator)) { setGeo({ status: "unsupported" }); return; }
    setGeo({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: { "Accept-Language": "tr" } });
          const data = await res.json();
          const raw  = extractCity(data.address ?? {});
          const city = normaliseCity(raw);
          const matched = cities.find(c => c.toLowerCase() === city.toLowerCase());
          setGeo({ status: "done", city: matched || city, lat, lng: lon });
          setSelectedCity(matched || city);
        } catch { setGeo({ status: "idle" }); }
      },
      () => { setGeo({ status: "denied" }); },
      { timeout: 8000 }
    );
  }, [cities]);

  const openModal = async (vet: VetRow) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setBookingVet(vet);
    setStep("info");
    setComplaint("");
    setCard({ holder: "", number: "", month: "", year: "", cvc: "" });
    setRequestId(null);
    setExpiresAt(null);
  };

  const closeModal = () => {
    if (step === "waiting") {
      if (!confirm("İsteği iptal etmek istiyor musunuz? Ödemeniz iade edilecek.")) return;
    }
    setBookingVet(null);
    setStep("info");
    setRequestId(null);
    setExpiresAt(null);
  };

  // Step 2 → 3: Send request + pre-auth payment
  const handleSubmitRequest = async () => {
    if (!bookingVet || !selectedPet) return;
    if (!card.number || !card.month || !card.year || !card.cvc) return;

    setPaying(true);
    try {
      const res  = await fetch("/api/nobetci/request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          vetId:          bookingVet.id,
          petId:          selectedPet,
          complaint,
          cardHolderName: card.holder,
          cardNumber:     card.number.replace(/\s/g, ""),
          expireMonth:    card.month,
          expireYear:     card.year,
          cvc:            card.cvc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İstek gönderilemedi");

      setRequestId(data.requestId);
      setExpiresAt(data.expiresAt);
      setSecondsLeft(90);
      setStep("waiting");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setPaying(false);
    }
  };

  const filtered = (() => {
    const base = selectedCity ? vets.filter(v => v.city === selectedCity) : vets;

    // Proximity sort: when user granted location, sort by Haversine distance
    // to vet city centroid. Vets without coordinates sink to the end.
    if (geo.status === "done" && !selectedCity) {
      const { lat, lng } = geo;
      return [...base].sort((a, b) => {
        const coordsA = CITY_COORDS[a.city];
        const coordsB = CITY_COORDS[b.city];
        const distA = coordsA ? haversineKm(lat, lng, coordsA[0], coordsA[1]) : Infinity;
        const distB = coordsB ? haversineKm(lat, lng, coordsB[0], coordsB[1]) : Infinity;
        return distA - distB;
      });
    }
    return base;
  })();

  return (
    <div className="space-y-6">

      {/* ── Location / city filter ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        {geo.status === "unsupported" ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
            <MapPin className="w-4 h-4 shrink-0" />
            <span>Tarayıcınız konum özelliğini desteklemiyor. Lütfen şehri manuel seçin.</span>
          </div>
        ) : (
          <button
            onClick={handleDetectLocation}
            disabled={geo.status === "loading"}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
              geo.status === "done"
                ? "border-green-500 bg-green-50 text-green-700"
                : geo.status === "denied"
                ? "border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100"
                : "border-red-500 text-red-600 hover:bg-red-50"
            } disabled:opacity-60 disabled:cursor-wait`}
          >
            {geo.status === "loading" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Konum alınıyor…</>
            ) : geo.status === "done" ? (
              <><MapPin className="w-4 h-4" /> 📍 {geo.city} — konumunuz algılandı</>
            ) : geo.status === "denied" ? (
              <><AlertTriangle className="w-4 h-4" /> Konum izni reddedildi — tekrar izin ver</>
            ) : (
              <><MapPin className="w-4 h-4" /> 📍 Konumumu Kullan</>
            )}
          </button>
        )}
        {geo.status === "denied" && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Konum erişimi engellendi
            </p>
            <ol className="text-xs text-orange-700 space-y-1 list-decimal list-inside">
              <li>Adres çubuğundaki <strong>kilit 🔒</strong> veya <strong>bilgi ℹ️</strong> simgesine tıklayın.</li>
              <li><strong>Konum</strong> iznini &ldquo;İzin ver&rdquo; olarak değiştirin.</li>
              <li>Sayfayı yenileyin veya yukarıdaki butona tekrar tıklayın.</li>
            </ol>
            <p className="text-xs text-orange-600">
              İzin vermek istemiyorsanız aşağıdan şehrinizi manuel seçebilirsiniz.
            </p>
          </div>
        )}
        <div className="relative">
          <select value={selectedCity} onChange={e => { setSelectedCity(e.target.value); if (geo.status === "done") setGeo({ status: "idle" }); }} className={SELECT_CLASS}>
            <option value="">Tüm Şehirler</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>

      <p className="text-sm text-gray-500">
        <strong className="text-gray-900">{filtered.length}</strong> nöbetçi veteriner
        {selectedCity && ` · ${selectedCity}`}
      </p>

      {/* ── Vet cards ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <span className="text-5xl block mb-4">🚨</span>
          <p className="text-gray-700 font-semibold mb-2">
            {selectedCity ? `${selectedCity} için şu an aktif nöbetçi veteriner yok` : "Şu an aktif nöbetçi veteriner yok"}
          </p>
          <p className="text-sm text-gray-500 mb-6">Nöbetçi hizmet veterinerlerin profil ayarlarından aktive edilir.</p>
          {selectedCity && (
            <button onClick={() => setSelectedCity("")} className="text-sm text-red-600 hover:underline font-medium mb-4 block mx-auto">
              Tüm şehirleri göster
            </button>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/online-veteriner">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">
                Online Görüşme Yap
              </button>
            </Link>
            <Link href="/veteriner-bul">
              <button className="px-4 py-2 border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl text-sm font-medium transition-colors">
                Klinik Veterineri Bul
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(vet => {
            const user     = Array.isArray(vet.user) ? vet.user[0] : vet.user;
            const initials = user?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "V";
            const fee      = vet.nobetci_fee ?? vet.video_consultation_fee ?? 300;

            return (
              <div key={vet.id} className="bg-white rounded-2xl border border-red-100 shadow-sm p-5 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-xl font-black text-red-700">
                      {initials}
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">Vet. Hek. {user?.full_name}</p>
                        <p className="text-xs text-gray-500">{vet.specialty}</p>
                      </div>
                      <ShieldCheck className="w-4 h-4 text-[#166534] shrink-0" />
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{vet.city}</span>
                    </div>
                  </div>
                </div>

                {vet.average_rating && vet.average_rating > 0 && (
                  <div className="flex items-center gap-1 mb-2">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(vet.average_rating!) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`} />
                    ))}
                    <span className="text-xs text-gray-600 ml-1">{vet.average_rating.toFixed(1)} ({vet.total_reviews})</span>
                  </div>
                )}

                {/* Fee badge */}
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Acil Görüşme — ₺{fee}
                  </span>
                </div>

                {/* Mini-map: interactive OpenStreetMap pinned to city centroid */}
                <div className="mb-3">
                  {(() => {
                    const coords = CITY_COORDS[vet.city];
                    return (
                      <ClinicMap
                        query={`${vet.city}, Türkiye`}
                        lat={coords?.[0]}
                        lng={coords?.[1]}
                        zoom={11}
                        height={112}
                        approximate
                        showDirections={false}
                      />
                    );
                  })()}
                </div>

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => openModal(vet)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    <Video className="w-3.5 h-3.5" /> Hemen Bağlan
                  </button>
                  <Link
                    href={`/veteriner/${vet.id}`}
                    className="flex items-center justify-center gap-1 px-3 py-2.5 border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl text-xs font-medium transition-colors"
                  >
                    Profil <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Instant booking modal ───────────────────────────────────── */}
      {bookingVet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

            {/* ── WAITING SCREEN ──────────────────────────────────────── */}
            {step === "waiting" && (
              <div className="p-8 text-center space-y-6">
                <div className="relative mx-auto w-24 h-24">
                  {/* Pulsing ring */}
                  <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center font-black text-3xl text-white mx-auto relative z-10 transition-colors duration-500 ${
                    secondsLeft <= 20 ? "bg-red-500" : secondsLeft <= 45 ? "bg-amber-500" : "bg-green-500"
                  }`}>
                    {secondsLeft}
                  </div>
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-xl">Veteriner Yanıt Veriyor…</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Vet. Hek. {(Array.isArray(bookingVet.user) ? bookingVet.user[0] : bookingVet.user)?.full_name} bildirim aldı.
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Ödemeniz kabul edilene kadar çekilmez.<br />
                    Yanıt gelmezse tam iade yapılır.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">
                    {secondsLeft > 0
                      ? `${secondsLeft} saniye içinde yanıt vermezse istek iptal edilir ve ödeme iade edilir.`
                      : "Süre doldu. Ödeme iade ediliyor…"}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full py-2.5 border border-gray-200 hover:border-gray-300 text-gray-600 rounded-xl text-sm font-medium transition-colors"
                >
                  İptal Et
                </button>
              </div>
            )}

            {/* ── ACCEPTED SCREEN ─────────────────────────────────────── */}
            {step === "accepted" && (
              <div className="p-8 text-center space-y-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                <p className="font-bold text-gray-900 text-xl">Bağlantı Kuruldu!</p>
                <p className="text-sm text-gray-500">Video odası açılıyor…</p>
                <Loader2 className="w-6 h-6 animate-spin text-green-500 mx-auto" />
              </div>
            )}

            {/* ── DECLINED / TIMEOUT SCREEN ───────────────────────────── */}
            {step === "declined" && (
              <div className="p-8 text-center space-y-4">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <X className="w-10 h-10 text-red-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-xl">İstek Kabul Edilmedi</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Veteriner yanıt vermedi veya reddetti. Ödemeniz iade edilecek.
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => { setStep("info"); setRequestId(null); setExpiresAt(null); }}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors"
                  >
                    Başka Veteriner Dene
                  </button>
                  <button
                    onClick={closeModal}
                    className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 1: INFO ─────────────────────────────────────────── */}
            {(step === "info" || step === "payment") && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div>
                    <p className="font-bold text-gray-900">Acil Video Görüşmesi</p>
                    <p className="text-xs text-gray-500">
                      Vet. Hek. {(Array.isArray(bookingVet.user) ? bookingVet.user[0] : bookingVet.user)?.full_name}
                      {" · "}₺{bookingVet.nobetci_fee ?? bookingVet.video_consultation_fee ?? 300}
                    </p>
                  </div>
                  <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Acil uyarı */}
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Veteriner kabul ettiğinde ödeme çekilir ve video bağlantısı kurulur.
                      Hayatı tehdit eden durumlar için lütfen en yakın kliniğe gidin.
                    </p>
                  </div>

                  {step === "info" && (
                    <>
                      {/* Pet selection */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1.5">Hangi hayvanınız için?</label>
                        {pets.length === 0 ? (
                          <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                            Kayıtlı hayvanınız yok.{" "}
                            <Link href="/owner/pets/new" className="text-[#166534] hover:underline font-medium">Hayvan ekle →</Link>
                          </div>
                        ) : (
                          <div className="relative">
                            <select value={selectedPet} onChange={e => setSelectedPet(e.target.value)} className={SELECT_CLASS}>
                              {pets.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.species})</option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Complaint */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1.5">Şikayet / Acil durum</label>
                        <textarea
                          value={complaint}
                          onChange={e => setComplaint(e.target.value)}
                          rows={3}
                          placeholder="Ör: Köpeğim kusmuyor, yemiyor, letarjik görünüyor..."
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400/30"
                        />
                      </div>

                      <button
                        onClick={() => setStep("payment")}
                        disabled={!selectedPet || !complaint.trim()}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-bold transition-colors"
                      >
                        Devam — Kart Bilgilerini Gir
                      </button>
                    </>
                  )}

                  {step === "payment" && (
                    <>
                      <button onClick={() => setStep("info")} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                        ← Geri
                      </button>

                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
                        <CreditCard className="w-4 h-4 text-green-700 shrink-0" />
                        <div>
                          <p className="text-xs text-green-700 font-medium">
                            ₺{bookingVet.nobetci_fee ?? bookingVet.video_consultation_fee ?? 300} — veteriner kabul ettiğinde çekilir
                          </p>
                          <p className="text-xs text-green-600">Kabul edilmezse ödeme yapılmaz.</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Kart Sahibi</label>
                          <input
                            value={card.holder}
                            onChange={e => setCard(c => ({ ...c, holder: e.target.value.toUpperCase() }))}
                            placeholder="AD SOYAD"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Kart Numarası</label>
                          <input
                            value={card.number}
                            onChange={e => setCard(c => ({ ...c, number: formatCard(e.target.value) }))}
                            placeholder="0000 0000 0000 0000"
                            maxLength={19}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400/30"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Ay</label>
                            <input value={card.month} onChange={e => setCard(c => ({ ...c, month: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                              placeholder="MM" maxLength={2}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-400/30" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Yıl</label>
                            <input value={card.year} onChange={e => setCard(c => ({ ...c, year: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                              placeholder="YYYY" maxLength={4}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-400/30" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">CVV</label>
                            <input value={card.cvc} onChange={e => setCard(c => ({ ...c, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                              placeholder="***" maxLength={4} type="password"
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-400/30" />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleSubmitRequest}
                        disabled={paying || !card.number || !card.month || !card.year || !card.cvc}
                        className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        {paying ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> İstek Gönderiliyor…</>
                        ) : (
                          <><Zap className="w-4 h-4" /> Veterinere İstek Gönder</>
                        )}
                      </button>

                      <p className="text-center text-[10px] text-gray-400">
                        Ödeme iyzico güvencesiyle korunur. Kart bilgileriniz saklanmaz.
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
