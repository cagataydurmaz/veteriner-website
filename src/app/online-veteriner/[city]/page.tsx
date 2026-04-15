import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Video, MapPin, Star, ShieldCheck, CreditCard, ChevronRight, PawPrint,
} from "lucide-react";

// Cache city SEO pages for 1 hour
export const revalidate = 3600;
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TURKISH_CITIES } from "@/lib/constants";

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
  if (!cityName) return { title: "Online Veteriner" };
  return {
    title: `Online Veteriner ${cityName} | Video Görüşme | Veterineri Bul`,
    description: `${cityName} online veteriner görüşmesi. Evden çıkmadan ${cityName}'deki doğrulanmış veterinerlerle video görüşme yapın. Güvenli ödeme, iptal garantisi.`,
    alternates: { canonical: `/online-veteriner/${citySlug}` },
  };
}

export default async function OnlineVeterinerCityPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const cityName = CITY_SLUG_MAP[citySlug];

  if (!cityName) notFound();

  type VetRow = {
    id: string;
    specialty: string;
    video_consultation_fee: number;
    average_rating: number;
    total_reviews: number;
    user: { full_name: string } | null;
  };

  let vets: VetRow[] = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("veterinarians")
      .select("id, specialty, video_consultation_fee, average_rating, total_reviews, user:users!veterinarians_user_id_fkey(full_name)")
      .eq("city", cityName)
      .eq("is_verified", true)
      .eq("offers_video", true)
      .order("average_rating", { ascending: false })
      .limit(20);
    vets = (data || []) as unknown as VetRow[];
  } catch {}

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap min-h-[44px]">
            <PawPrint size={28} color="#FFFFFF" />
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg">Veterineri Bul</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-white/80">
            <Link href="/veteriner-bul" className="hover:text-white transition-colors">🏥 Klinikte Muayene</Link>
            <Link href="/online-veteriner" className="text-white font-semibold">📹 Online Görüşme</Link>
            <Link href="/nobetci-veteriner" className="hover:text-white transition-colors">🚨 Nöbetçi</Link>
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
        <div className="max-w-5xl mx-auto px-4 pb-10 pt-6">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/online-veteriner" className="text-white/70 hover:text-white text-sm transition-colors">
              Online Veteriner
            </Link>
            <span className="text-white/50">/</span>
            <span className="text-white text-sm font-semibold">{cityName}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">
            {cityName} Online Veteriner
          </h1>
          <p className="text-white/80 text-sm">
            {vets.length > 0
              ? `${vets.length} doğrulanmış veteriner video görüşmeye hazır`
              : `${cityName}'de henüz online veteriner bulunmuyor`}
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {vets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <Video className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">
              {cityName} için henüz online veteriner mevcut değil
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Tüm online veterinerleri görmek için aşağıya bakın
            </p>
            <Link href="/online-veteriner">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Tüm Online Veterinerleri Gör
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vets.map((vet) => {
              const user = Array.isArray(vet.user) ? vet.user[0] : vet.user;
              const initials =
                user?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "V";
              const fee = vet.video_consultation_fee || 300;

              return (
                <Link key={vet.id} href={`/veteriner/${vet.id}`}>
                  <div className="bg-white rounded-2xl border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all p-5 group">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-xl font-black text-blue-700 shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">Vet. Hek. {user?.full_name}</p>
                            <p className="text-xs text-gray-500">{vet.specialty}</p>
                          </div>
                          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{cityName}</span>
                        </div>
                      </div>
                    </div>

                    {vet.average_rating > 0 && (
                      <div className="flex items-center gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${s <= Math.round(vet.average_rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`}
                          />
                        ))}
                        <span className="text-xs text-gray-600 ml-1">
                          {vet.average_rating.toFixed(1)} ({vet.total_reviews})
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1 text-sm font-bold text-blue-700">
                        <CreditCard className="w-3.5 h-3.5" />
                        ₺{fee}
                      </div>
                      <span className="text-xs text-blue-600 font-semibold flex items-center gap-1 group-hover:gap-2 transition-all bg-blue-50 px-3 py-1.5 rounded-lg">
                        <Video className="w-3 h-3" /> Görüşme Al <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Other cities */}
        <div className="mt-12">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Diğer Şehirlerde Online Veteriner</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {TURKISH_CITIES.filter(c => c !== cityName).slice(0, 16).map((city) => {
              const slug = city
                .replace(/İ/g, "i").replace(/Ğ/g, "g").replace(/Ü/g, "u")
                .replace(/Ş/g, "s").replace(/Ö/g, "o").replace(/Ç/g, "c")
                .toLowerCase()
                .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
                .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
                .replace(/[^a-z0-9]/g, "-");
              return (
                <Link
                  key={city}
                  href={`/online-veteriner/${slug}`}
                  className="px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm hover:border-blue-600 hover:text-blue-600 transition-colors"
                >
                  {city} Online Veteriner
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
