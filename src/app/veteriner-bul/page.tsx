import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { MapPin, PawPrint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import VetListClient, { type Vet } from "./client";
import { VetListRealtimeSync } from "@/components/owner/VetListRealtimeSync";

export const metadata: Metadata = {
  title: "Veterineri Bul — Yakınındaki Veterineri Bul | Veterineri Bul AI",
  description:
    "Şehrindeki klinik veterinerleri bul, randevu al. Türkiye genelinde diploma doğrulamalı veterinerler.",
};

// Cache in-person vet list for 5 minutes — public data, no per-user variation
const getVetsData = unstable_cache(
  async () => {
    try {
      const supabase = createServiceClient();
      const { data: vets } = await supabase
        .from("veterinarians")
        .select(
          `id, specialty, city, average_rating, total_reviews, bio,
           consultation_fee, video_consultation_fee,
           offers_in_person, offers_video, offers_nobetci, is_available_today,
           user:users!veterinarians_user_id_fkey(full_name, avatar_url)`
        )
        .eq("is_verified", true)
        .eq("offers_in_person", true)
        .order("average_rating", { ascending: false })
        .limit(200);

      const cityMap: Record<string, number> = {};
      (vets || []).forEach((v: { city: string }) => {
        if (v.city) cityMap[v.city] = (cityMap[v.city] || 0) + 1;
      });

      return { vets: vets || [], cityMap };
    } catch {
      return { vets: [], cityMap: {} };
    }
  },
  ["veteriner-bul-vet-list"],
  { revalidate: 300 }
);

export default async function VeterinerBulPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; specialty?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const { vets, cityMap } = await getVetsData();

  const topCities = Object.entries(cityMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-gray-50">
      <VetListRealtimeSync />
      <header className="bg-[#166534] text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap min-h-[44px]">
            <PawPrint size={28} color="#FFFFFF" />
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg">Veterineri Bul</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
            <Link href="/veteriner-bul" className="text-white font-semibold">🏥 Klinikte Muayene</Link>
            <Link href="/online-veteriner" className="hover:text-white transition-colors">📹 Online Görüşme</Link>
            <Link href="/nobetci-veteriner" className="hover:text-white transition-colors">🚨 Acil & Nöbetçi</Link>
          </nav>
          <div className="flex gap-2">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">Giriş</Button>
            </Link>
            <Link href="/auth/register">
              <Button size="sm" className="bg-white text-[#166534] hover:bg-gray-100 font-bold">Kayıt Ol</Button>
            </Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-10 pt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-sm font-bold px-4 py-1.5 rounded-full mb-4">
            🏥 Yüz Yüze Muayene
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">
            Yakınındaki Veterineri Bul
          </h1>
          <p className="text-white/80 text-sm">
            {Object.keys(cityMap).length} şehirde {vets.length}+ doğrulanmış klinik veterineri
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <VetListClient
          vets={vets as unknown as Vet[]}
          cityMap={cityMap}
          topCities={topCities}
          initialCity={sp.city || ""}
          initialSpecialty={sp.specialty || ""}
          initialQuery={sp.q || ""}
        />
      </div>

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
              href={`/${slug}-veteriner`}
              className="px-4 py-2 rounded-full text-sm font-medium border border-[#1A6B4A] text-[#1A6B4A] hover:bg-[#1A6B4A] hover:text-white transition-colors min-h-[44px] flex items-center"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
