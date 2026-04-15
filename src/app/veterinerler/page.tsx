import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MapPin, Search, Star, ShieldCheck, Stethoscope, ChevronRight, Users, PawPrint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TURKISH_CITIES, VETERINARY_SPECIALTIES } from "@/lib/constants";
import VetCityFilterClient, { type Vet } from "./client";
import { VetListRealtimeSync } from "@/components/owner/VetListRealtimeSync";

export const metadata: Metadata = {
  title: "Veterineri Bul — Şehre Göre Veteriner | Veterineri Bul AI Asistan",
  description: "Türkiye'nin tüm illerinde diploma doğrulamalı veterinerleri şehre ve uzmanlığa göre bulun.",
};

async function getVetsData() {
  try {
    const supabase = await createClient();
    const { data: vets } = await supabase
      .from("veterinarians")
      .select(`
        id, specialty, city, district, average_rating, total_reviews, bio,
        offers_in_person, offers_video, offers_nobetci,
        is_verified, education, video_consultation_fee, consultation_fee,
        working_hours_start, working_hours_end, working_days, is_available_today,
        user:users!veterinarians_user_id_fkey(full_name, avatar_url)
      `)
      .eq("is_verified", true)
      .order("average_rating", { ascending: false })
      .limit(200);

    // City counts
    const cityMap: Record<string, number> = {};
    (vets || []).forEach((v: { city: string }) => {
      if (v.city) cityMap[v.city] = (cityMap[v.city] || 0) + 1;
    });

    return { vets: vets || [], cityMap };
  } catch {
    return { vets: [], cityMap: {} };
  }
}

export default async function VeterinerlerPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; specialty?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const { vets, cityMap } = await getVetsData();

  // Top cities by vet count
  const topCities = Object.entries(cityMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Realtime vet availability sync — refreshes page when any vet goes online/offline */}
      <VetListRealtimeSync />
      {/* Header */}
      <header className="bg-[#166534] text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap min-h-[44px]">
            <PawPrint size={28} color="#FFFFFF" />
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg">Veterineri Bul</span>
            </div>
          </Link>
          <div className="flex gap-2">
            <Link href="/auth/login"><Button variant="ghost" size="sm" className="text-white hover:bg-white/10">Giriş</Button></Link>
            <Link href="/auth/register"><Button size="sm" className="bg-white text-[#166534] hover:bg-gray-100 font-bold">Kayıt Ol</Button></Link>
          </div>
        </div>

        {/* Hero search */}
        <div className="max-w-6xl mx-auto px-4 pb-10 pt-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-black mb-2">
            Şehrine Göre Veterineri Bul
          </h1>
          <p className="text-white/80 text-sm mb-6">
            {Object.keys(cityMap).length} şehirde {vets.length}+ doğrulanmış veteriner
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Client-side filter + listing */}
        <VetCityFilterClient
          vets={vets as unknown as Vet[]}
          cityMap={cityMap}
          topCities={topCities}
          initialCity={sp.city || ""}
          initialSpecialty={sp.specialty || ""}
          initialQuery={sp.q || ""}
        />
      </div>

      {/* SEO city links */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Şehirlere Göre Veteriner</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {TURKISH_CITIES.map(city => (
            <Link
              key={city}
              href={`/${city.toLowerCase()
                .replace(/İ/gi, "i").replace(/Ğ/g, "g").replace(/Ü/g, "u")
                .replace(/Ş/g, "s").replace(/Ö/g, "o").replace(/Ç/g, "c")
                .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
                .replace(/ö/g, "o").replace(/ç/g, "c").replace(/ı/g, "i")
                .replace(/\s+/g, "-")}-veteriner`}
              className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm hover:border-[#166534] hover:text-[#166534] transition-colors group"
            >
              <span>{city}</span>
              <span className="text-xs text-gray-400 group-hover:text-[#166534]">
                {cityMap[city] || 0}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
