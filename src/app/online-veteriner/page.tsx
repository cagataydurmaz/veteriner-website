import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Video, MapPin, PawPrint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import OnlineVetClient, { type Vet } from "./client";

export const metadata: Metadata = {
  title: "Online Veteriner — Video Görüşme ile Veteriner | Veterineri Bul AI",
  description:
    "Evden çıkmadan online veteriner görüşmesi yap. Türkiye'nin doğrulanmış veterinerleriyle video görüşme.",
};

function toSlug(city: string) {
  return city
    .toLowerCase()
    .replace(/İ/gi, "i").replace(/Ğ/g, "g").replace(/Ü/g, "u")
    .replace(/Ş/g, "s").replace(/Ö/g, "o").replace(/Ç/g, "c")
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ö/g, "o").replace(/ç/g, "c").replace(/ı/g, "i")
    .replace(/\s+/g, "-");
}

async function getVetsData() {
  try {
    const supabase = await createClient();

    // Combined 3-Layer filter:
    // Layer 1 (Permission): offers_video = true
    // Layer 2 (Intent):     is_online_now = true
    // Layer 3 (Reality):    is_busy = false AND buffer_lock = false
    const { data: vets } = await supabase
      .from("veterinarians")
      .select(
        `id, specialty, city, district, average_rating, total_reviews, bio,
         video_consultation_fee, consultation_fee,
         offers_in_person, offers_video, offers_nobetci, is_available_today, is_online_now,
         working_hours_start, working_hours_end, working_days,
         user:users!veterinarians_user_id_fkey(full_name, avatar_url)`
      )
      .eq("is_verified", true)
      .eq("offers_video", true)       // Layer 1
      .eq("is_online_now", true)      // Layer 2
      .eq("is_busy", false)           // Layer 3
      .eq("buffer_lock", false)       // Layer 3
      .order("average_rating", { ascending: false });

    const cityMap: Record<string, number> = {};
    (vets || []).forEach((v: { city: string }) => {
      if (v.city) cityMap[v.city] = (cityMap[v.city] || 0) + 1;
    });

    return { vets: vets || [], cityMap, busyVetIds: [] };
  } catch {
    return { vets: [], cityMap: {}, busyVetIds: [] };
  }
}

export default async function OnlineVeterinerPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; specialty?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const { vets, cityMap, busyVetIds } = await getVetsData();

  const topCities = Object.entries(cityMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap min-h-[44px]">
            <PawPrint size={28} color="#FFFFFF" />
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg">Veterineri Bul</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
            <Link href="/veteriner-bul" className="hover:text-white transition-colors">🏥 Klinikte Muayene</Link>
            <Link href="/online-veteriner" className="text-white font-semibold">📹 Online Görüşme</Link>
            <Link href="/nobetci-veteriner" className="hover:text-white transition-colors">🚨 Acil & Nöbetçi</Link>
          </nav>
          <div className="flex gap-2">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">Giriş</Button>
            </Link>
            <Link href="/auth/register">
              <Button size="sm" className="bg-white text-blue-700 hover:bg-gray-100 font-bold">Kayıt Ol</Button>
            </Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-10 pt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-sm font-bold px-4 py-1.5 rounded-full mb-4">
            <Video className="w-4 h-4" /> Video Görüşme
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">
            Online Veteriner Görüşmesi
          </h1>
          <p className="text-white/80 text-sm mb-2">
            {vets.length > 0
              ? <><span className="font-bold text-white">{vets.length}</span> veteriner şu an online ve müsait</>
              : "Doğrulanmış veterinerlerle video görüşme yap"
            }
          </p>
          <p className="text-white/60 text-xs">
            Güvenli ödeme · İptal garantisi · 7/24
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <OnlineVetClient
          vets={vets as unknown as Vet[]}
          cityMap={cityMap}
          topCities={topCities}
          busyVetIds={busyVetIds}
          initialCity={sp.city || ""}
          initialSpecialty={sp.specialty || ""}
          initialQuery={sp.q || ""}
        />
      </div>

      {/* Popular city pills */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#1A6B4A]" />
          Popüler Şehirler
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "İstanbul", slug: "istanbul" },
            { label: "Ankara", slug: "ankara" },
            { label: "İzmir", slug: "izmir" },
            { label: "Bursa", slug: "bursa" },
            { label: "Antalya", slug: "antalya" },
            { label: "Adana", slug: "adana" },
            { label: "Kocaeli", slug: "kocaeli" },
            { label: "Gaziantep", slug: "gaziantep" },
            { label: "Konya", slug: "konya" },
            { label: "Mersin", slug: "mersin" },
          ].map(({ label, slug }) => (
            <Link
              key={slug}
              href={`/online-veteriner/${slug}`}
              className="px-4 py-1.5 rounded-full text-sm font-medium border border-[#1A6B4A] text-[#1A6B4A] hover:bg-[#1A6B4A] hover:text-white transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
