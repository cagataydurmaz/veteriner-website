import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Star, ShieldCheck, Calendar, Mail, PawPrint,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TURKISH_CITIES } from "@/lib/constants";

// Build slug → city map
const CITY_SLUG_MAP: Record<string, string> = {};
TURKISH_CITIES.forEach((city) => {
  const slug = city
    .replace(/İ/g, "i").replace(/Ğ/g, "g").replace(/Ü/g, "u")
    .replace(/Ş/g, "s").replace(/Ö/g, "o").replace(/Ç/g, "c")
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "-");
  CITY_SLUG_MAP[slug] = city;
});

interface PageProps {
  params: Promise<{ city: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const cityName = CITY_SLUG_MAP[citySlug];
  if (!cityName) return { title: "Veterineri Bul" };
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://veterineribul.com";
  const title = `${cityName} Veteriner | Veterineri Bul`;
  const description = `${cityName} ilinde doğrulanmış veterinerler. Online randevu, uygun fiyatlar ve güvenilir hizmet. Veterineri Bul ile ${cityName} veteriner bulun.`;
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/${citySlug}-veteriner` },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${citySlug}-veteriner`,
      images: [{ url: `${siteUrl}/og-image.png`, width: 1424, height: 752, alt: title }],
    },
  };
}

export default async function CityVetPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const cityName = CITY_SLUG_MAP[citySlug];

  if (!cityName) notFound();

  let vets: {
    id: string;
    specialty: string;
    consultation_fee: number;
    average_rating: number;
    total_reviews: number;
    user: { full_name: string } | null;
  }[] = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("veterinarians")
      .select("id, specialty, consultation_fee, average_rating, total_reviews, user:users!veterinarians_user_id_fkey(full_name)")
      .eq("city", cityName)
      .eq("is_verified", true)
      .order("average_rating", { ascending: false })
      .limit(20);

    vets = (data || []).map((v) => ({
      ...v,
      user: Array.isArray(v.user) ? v.user[0] : v.user,
    }));
  } catch {
    // DB not configured, show empty state
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <PawPrint size={28} color="#1A6B4A" />
            <div className="flex items-center gap-1">
              <span className="font-black text-gray-900">Veterineri Bul</span>
            </div>
          </Link>
          <Link href="/veterinerler">
            <Button size="sm" className="bg-[#166534] hover:bg-[#14532D] text-white">Veterineri Bul</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-[#166534] mb-2">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">{cityName}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{cityName} Veteriner</h1>
          <p className="text-gray-600">
            {cityName} ilindeki diploma ve TVHB üyeliği doğrulanmış veterinerler.
            Online randevu ile anında erişin.
          </p>
        </div>

        {vets.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {vets.map((vet) => (
                <div key={vet.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  {/* Avatar */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-[#F0FDF4] rounded-full flex items-center justify-center shrink-0">
                      <span className="text-[#166534] font-bold">
                        {vet.user?.full_name?.charAt(0) || "V"}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="font-semibold text-sm text-gray-900">Vet. Hek. {vet.user?.full_name}</p>
                        <ShieldCheck className="w-3.5 h-3.5 text-[#166534]" aria-label="Doğrulanmış" />
                      </div>
                      <p className="text-xs text-gray-500">{vet.specialty}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    {vet.average_rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-sm font-medium">{vet.average_rating.toFixed(1)}</span>
                        <span className="text-xs text-gray-400">({vet.total_reviews})</span>
                      </div>
                    ) : <span className="text-xs text-gray-400">Yeni</span>}
                    <span className="text-sm font-semibold text-gray-700">₺{vet.consultation_fee}</span>
                  </div>

                  <Link href={`/veteriner/${vet.id}`}>
                    <Button size="sm" className="w-full bg-[#166534] hover:bg-[#14532D] text-white text-xs">
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      Randevu Al
                    </Button>
                  </Link>
                </div>
              ))}
            </div>

            {/* SEO text */}
            <div className="bg-[#F0FDF4] rounded-2xl p-6 text-sm text-gray-600 leading-relaxed">
              <h2 className="font-bold text-gray-900 mb-2">{cityName} Veteriner Hakkında</h2>
              <p>
                Veterineri Bul, {cityName} ilindeki tüm veteriner hekimleri için diploma ve
                Türk Veteriner Hekimleri Birliği (TVHB) üyeliği doğrulaması yapmaktadır.
                Listelenen tüm veterinerler admin onayından geçmiştir.
                {cityName}&apos;de veteriner arayışındaysanız online randevu alarak
                beklemeden hizmet alabilirsiniz.
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🐾</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Yakında {cityName}&apos;de</h2>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Henüz {cityName} ilinde doğrulanmış veterinerimiz bulunmuyor.
              Hizmet başladığında bildirim almak için kaydolun.
            </p>
            <div className="max-w-xs mx-auto space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="E-posta adresiniz"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
                <Button className="bg-[#166534] hover:bg-[#14532D] text-white shrink-0">
                  <Mail className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400">{cityName}&apos;de hizmet açıldığında size haber vereceğiz.</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12 py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap justify-between gap-4 text-xs text-gray-400">
          <p>© 2024 Veterineri Bul</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-gray-600">Ana Sayfa</Link>
            <Link href="/blog" className="hover:text-gray-600">Blog</Link>
            <Link href="/kvkk" className="hover:text-gray-600">KVKK</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
