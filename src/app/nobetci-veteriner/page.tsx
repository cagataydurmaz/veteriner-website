import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Clock, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import NobetciVeterinerClient, { type VetRow } from "./client";
import { VetListRealtimeSync } from "@/components/owner/VetListRealtimeSync";

export const metadata: Metadata = {
  title: "Nöbetçi Veteriner — Acil Veteriner Hizmeti | Veterineri Bul AI",
  description:
    "Acil durumlar için nöbetçi veteriner bul. Türkiye genelinde şu an aktif nöbetçi veterinerlere ulaş.",
};

export const dynamic = "force-dynamic";

async function getOnCallVets() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("veterinarians")
      .select(
        `id, specialty, city, average_rating, total_reviews,
         nobetci_fee, video_consultation_fee, offers_nobetci,
         user:users!veterinarians_user_id_fkey(full_name, phone)`
      )
      .eq("is_verified", true)
      .eq("offers_nobetci", true)     // Layer 1
      .eq("is_on_call", true)         // Layer 2
      .eq("is_busy", false)           // Layer 3
      .eq("buffer_lock", false)       // Layer 3
      .order("city", { ascending: true });

    if (error) {
      console.error("[nobetci-veteriner] query error:", error.message);
    }

    return (data || []) as unknown as VetRow[];
  } catch {
    return [];
  }
}

export default async function NobetciVeterinerPage() {
  const vets = await getOnCallVets();

  // Deduplicated sorted city list for dropdown
  const cities = [...new Set(vets.map((v) => v.city).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "tr")
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <VetListRealtimeSync />
      <header className="bg-red-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap min-h-[44px]">
            <PawPrint size={28} color="#FFFFFF" />
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg">Veterineri Bul</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
            <Link href="/veteriner-bul" className="hover:text-white transition-colors">🏥 Klinikte Muayene</Link>
            <Link href="/online-veteriner" className="hover:text-white transition-colors">📹 Online Görüşme</Link>
            <Link href="/nobetci-veteriner" className="text-white font-semibold">🚨 Acil & Nöbetçi</Link>
          </nav>
          <div className="flex gap-2">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">Giriş</Button>
            </Link>
            <Link href="/auth/register">
              <Button size="sm" className="bg-white text-red-700 hover:bg-gray-100 font-bold">Kayıt Ol</Button>
            </Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-10 pt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-sm font-bold px-4 py-1.5 rounded-full mb-4">
            <Clock className="w-4 h-4" />
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            Şu An Aktif
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">
            Nöbetçi Veteriner
          </h1>
          <p className="text-white/80 text-sm">
            {vets.length > 0
              ? `${vets.length} nöbetçi veteriner şu an aktif`
              : "Şu an aktif nöbetçi veteriner bekleniyor"}
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Emergency banner */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="text-2xl">🚨</div>
          <div>
            <p className="font-bold text-red-800 text-sm">Acil Durum mu?</p>
            <p className="text-red-700 text-xs mt-0.5">
              Hayatı tehdit eden bir durum varsa lütfen en yakın veteriner kliniğine gidin.
              Nöbetçi veteriner listesi 7/24 güncellenir.
            </p>
          </div>
        </div>

        {/* Client island — location detection + filtering + vet cards */}
        <NobetciVeterinerClient vets={vets} cities={cities} />

        {/* By city breakdown — server-rendered summary */}
        {cities.length > 1 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Şehirlere Göre</h2>
            <div className="flex flex-wrap gap-2">
              {cities.map((city) => {
                const count = vets.filter((v) => v.city === city).length;
                return (
                  <div
                    key={city}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm"
                  >
                    <span className="text-red-500 text-xs">📍</span>
                    <span className="font-medium">{city}</span>
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA for vets */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-6 text-white text-center">
          <p className="font-bold text-lg mb-1">Siz de Nöbetçi Olun</p>
          <p className="text-white/80 text-sm mb-4">
            Profil ayarlarınızdan nöbetçi hizmetini aktive edin, acil ihtiyaç duyan hasta sahiplerine ulaşın.
          </p>
          <Link href="/vet/profile">
            <Button className="bg-white text-red-700 hover:bg-red-50 font-bold">
              Profil Ayarlarım
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
