import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Star, ShieldCheck, Calendar, GraduationCap, MessageCircle, Clock, CheckCircle, Heart, PawPrint,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import Image from "next/image";
import ReportVetButton from "@/components/owner/ReportVetButton";

// Cache vet profile pages for 1 hour
export const revalidate = 300;

// Lazy-load the map to reduce initial bundle
const ClinicMap = dynamic(() => import("@/components/ClinicMap"), {
  loading: () => (
    <div className="h-[200px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
      <span className="text-xs text-gray-400">Harita yükleniyor…</span>
    </div>
  ),
});

// Lazy-load the booking calendar
const BookingCalendar = dynamic(() => import("@/components/owner/BookingCalendar"), {
  loading: () => <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />,
});

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getVet(id: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("veterinarians")
      .select(`
        id, specialty, consultation_fee, video_consultation_fee, nobetci_fee, average_rating, total_reviews,
        city, district, bio, education, license_number, chamber_number,
        is_verified, created_at, is_available_today, is_on_call,
        offers_in_person, offers_video, offers_nobetci, auto_approve_appointments,
        user:users!veterinarians_user_id_fkey(full_name, avatar_url)
      `)
      .eq("id", id)
      .eq("is_verified", true)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

async function getVetReputation(vetId: string) {
  try {
    const supabase = await createClient();
    const [{ count: completedCount }, { data: ownerRows }] = await Promise.all([
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("vet_id", vetId)
        .eq("status", "completed"),
      supabase
        .from("appointments")
        .select("owner_id")
        .eq("vet_id", vetId)
        .eq("status", "completed"),
    ]);
    const uniqueOwners = new Set((ownerRows ?? []).map((r: { owner_id: string }) => r.owner_id)).size;
    return { completedApts: completedCount ?? 0, happyOwners: uniqueOwners };
  } catch {
    return { completedApts: 0, happyOwners: 0 };
  }
}

async function getVetReviews(vetId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("reviews")
      .select(`
        id, rating, comment, created_at,
        owner:users!reviews_owner_id_fkey(full_name)
      `)
      .eq("vet_id", vetId)
      .order("created_at", { ascending: false })
      .limit(5);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const vet = await getVet(id);
  if (!vet) return { title: "Veteriner | Veterineri Bul" };
  const user = Array.isArray(vet.user) ? vet.user[0] : vet.user;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://veterineribul.com";
  const title = `Vet. Hek. ${user?.full_name} — ${vet.specialty} | Veterineri Bul`;
  const description = `${vet.city} ilinde ${vet.specialty} uzmanı Vet. Hek. ${user?.full_name}. Online randevu ve video görüşme için Veterineri Bul.`;
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/veteriner/${id}` },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/veteriner/${id}`,
      images: [{ url: `${siteUrl}/og-image.png`, width: 1424, height: 752, alt: title }],
    },
  };
}

const SPECIALTY_COLORS: Record<string, string> = {
  "Dermatolog": "bg-purple-100 text-purple-700",
  "Ortoped": "bg-blue-100 text-blue-700",
  "Kardiyolog": "bg-red-100 text-red-700",
  "Onkolog": "bg-orange-100 text-orange-700",
  "Göz Uzmanı": "bg-cyan-100 text-cyan-700",
  "Diş Hekimi": "bg-yellow-100 text-yellow-700",
  "İç Hastalıklar": "bg-indigo-100 text-indigo-700",
  "Genel Veteriner": "bg-[#F0FDF4] text-[#166534]",
};

export default async function VetProfilePage({ params }: PageProps) {
  const { id } = await params;
  const [vet, reputation, reviews] = await Promise.all([
    getVet(id),
    getVetReputation(id),
    getVetReviews(id),
  ]);

  // Fallback for demo
  const demoVet = !vet ? {
    id,
    specialty: "Genel Veteriner",
    consultation_fee: 400,
    video_consultation_fee: 300,
    nobetci_fee: null as number | null,
    average_rating: 4.8,
    total_reviews: 92,
    city: "İstanbul",
    district: "Kadıköy",
    bio: "15 yıllık deneyimle köpek ve kedi sağlığı alanında uzmanlaşmış veteriner hekim. Özellikle iç hastalıklar ve koruyucu hekimlik konularında çalışmaktayım.",
    education: "Ankara Üniversitesi Veterinerlik Fakültesi",
    license_number: "06-VH-12345",
    chamber_number: "06-1234",
    is_verified: true,
    is_on_call: false,
    offers_in_person: true,
    offers_video: true,
    offers_nobetci: false,
    user: { full_name: "Demo Veteriner", avatar_url: null },
  } : null;

  const v = vet || demoVet;
  if (!v) notFound();

  const user = Array.isArray(v.user) ? v.user[0] : v.user;
  const initials = user?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "V";
  const colorClass = SPECIALTY_COLORS[v.specialty] || "bg-[#F0FDF4] text-[#166534]";

  // Reputation: months on platform
  const vetCreatedAt = (v as Record<string, unknown>).created_at as string | undefined;
  const monthsOnPlatform = vetCreatedAt
    ? Math.max(1, Math.floor((Date.now() - new Date(vetCreatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://veterineribul.com";
  const vetSchema = {
    "@context": "https://schema.org",
    "@type": "VeterinaryCare",
    name: `Vet. Hek. ${user?.full_name}`,
    url: `${siteUrl}/veteriner/${v.id}`,
    description: v.bio ?? `${v.city} ilinde ${v.specialty} uzmanı veteriner hekim.`,
    medicalSpecialty: "Veterinary",
    ...(v.city ? { address: { "@type": "PostalAddress", addressLocality: v.city, addressCountry: "TR" } } : {}),
    ...(v.average_rating && v.total_reviews
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: v.average_rating,
            reviewCount: v.total_reviews,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(user?.avatar_url ? { image: user.avatar_url } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vetSchema) }}
      />
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Veterineri Bul</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <PawPrint size={28} color="#1A6B4A" />
            <div className="flex items-center gap-1">
              <span className="font-black text-gray-900">Veterineri Bul</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — Profile card */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
              {/* Avatar */}
              {user?.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.full_name}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2 border-[#DCFCE7]"
                  sizes="80px"
                  priority
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-[#166534] to-[#15803D] rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold text-2xl">{initials}</span>
                </div>
              )}
              <h1 className="text-xl font-bold text-gray-900 mb-1">Vet. Hek. {user?.full_name}</h1>
              <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3 ${colorClass}`}>
                {v.specialty}
              </span>
              <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 mb-2">
                <MapPin className="w-3.5 h-3.5" />
                {v.city}
              </div>
              {v.is_verified && (
                <div className="flex items-center justify-center gap-1 text-xs text-[#166534] font-medium mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  TVHB Onaylı Veteriner
                </div>
              )}
              {/* Availability badge */}
              <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-3 ${
                (v as Record<string, unknown>).is_available_today
                  ? "bg-[#DCFCE7] text-[#166534]"
                  : "bg-gray-100 text-gray-400"
              }`}>
                <span className="text-[10px]">
                  {(v as Record<string, unknown>).is_available_today ? "🟢" : "⚫"}
                </span>
                {(v as Record<string, unknown>).is_available_today ? "Bugün Müsait" : "Bugün Kapalı"}
              </div>
              {/* Service badges */}
              <div className="flex flex-wrap justify-center gap-1.5">
                {v.offers_in_person && (
                  <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-medium">
                    🏥 Yüz Yüze
                  </span>
                )}
                {v.offers_video && (
                  <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium">
                    📱 Online
                  </span>
                )}
                {v.offers_nobetci && (
                  <span className="text-xs px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full font-medium">
                    🚨 Nöbetçi{v.is_on_call && (v.nobetci_fee || v.video_consultation_fee) ? ` — ₺${v.nobetci_fee || v.video_consultation_fee}` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Reputation — platform-exclusive stats */}
            <div className="bg-gradient-to-br from-[#166534] to-[#15803D] rounded-2xl p-4 shadow-sm text-white">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3">
                Veterineri Bul&apos;da Kazanılan İtibar
              </p>
              <div className="space-y-2.5">
                {monthsOnPlatform !== null && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm leading-tight">
                        Veterineri Bul&apos;da {monthsOnPlatform} ay
                      </p>
                      <p className="text-white/60 text-[10px]">Platform üyesi</p>
                    </div>
                  </div>
                )}
                {reputation.completedApts > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm leading-tight">
                        {reputation.completedApts} randevu tamamlandı
                      </p>
                      <p className="text-white/60 text-[10px]">Platform üzerinden</p>
                    </div>
                  </div>
                )}
                {reputation.happyOwners > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
                      <Heart className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm leading-tight">
                        {reputation.happyOwners} mutlu pet sahibi
                      </p>
                      <p className="text-white/60 text-[10px]">Tekrar gelen müşteriler dahil</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-white/40 mt-3 leading-tight">
                Bu istatistikler yalnızca Veterineri Bul platformuna aittir. Platform dışında sıfırlanır.
              </p>
            </div>

            {/* Rating Stats */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-[#F0FDF4] rounded-xl p-3">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-bold text-gray-900">{v.average_rating > 0 ? v.average_rating.toFixed(1) : "—"}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">{v.total_reviews} değerlendirme</p>
                </div>
                <div className="bg-[#F0FDF4] rounded-xl p-3">
                  <p className="font-bold text-[#166534] mb-1">Online</p>
                  <p className="text-[10px] text-gray-500">Randevu alın</p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
              {v.education && (
                <div className="flex items-start gap-2">
                  <GraduationCap className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">Eğitim</p>
                    <p className="text-xs text-gray-700">{v.education}</p>
                  </div>
                </div>
              )}
              {v.license_number && (
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">Lisans No</p>
                    <p className="text-xs text-gray-700 font-mono">{v.license_number}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400">Yanıt süresi</p>
                  <p className="text-xs text-gray-700">Ortalama 2 saat içinde</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Hakkında */}
            {v.bio && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-3">Hakkında</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{v.bio}</p>
              </div>
            )}

            {/* Approximate location map */}
            {v.offers_in_person && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#166534]" />
                  Klinik Bölgesi
                </h2>
                <ClinicMap
                  query={[v.district, v.city, "Türkiye"].filter(Boolean).join(", ")}
                  zoom={13}
                  height={200}
                  showDirections={false}
                  approximate
                />
                <p className="text-xs text-gray-400 mt-2">
                  Kesin adres randevu onaylandıktan sonra paylaşılır.
                </p>
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  Değerlendirmeler
                  <span className="text-xs font-normal text-gray-400 ml-auto">
                    {v.total_reviews} toplam
                  </span>
                </h2>
                <div className="space-y-4">
                  {reviews.map((review: {
                    id: string;
                    rating: number;
                    comment: string | null;
                    created_at: string;
                    owner: { full_name: string } | { full_name: string }[] | null;
                  }) => {
                    const ownerName = Array.isArray(review.owner)
                      ? review.owner[0]?.full_name
                      : review.owner?.full_name;
                    const initials = ownerName
                      ? ownerName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)
                      : "?";
                    return (
                      <div key={review.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#E8F5EE] flex items-center justify-center shrink-0 text-xs font-bold text-[#166534]">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-sm font-medium text-gray-800">{ownerName || "Anonim"}</p>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3 h-3 ${i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`}
                                  />
                                ))}
                              </div>
                            </div>
                            {review.comment && (
                              <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(review.created_at).toLocaleDateString("tr-TR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Booking Calendar / CTA */}
            {(v.offers_in_person || v.offers_video) ? (
              <div>
                <BookingCalendar
                  vetId={v.id}
                  vetName={user?.full_name ?? "Veteriner"}
                  offersInPerson={v.offers_in_person ?? false}
                  offersVideo={v.offers_video ?? false}
                  videoFee={v.video_consultation_fee ?? 0}
                  inPersonFee={v.consultation_fee ?? 0}
                  autoApprove={(v as Record<string, unknown>).auto_approve_appointments === true}
                />
                <Link href="/ai-asistan" className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-[#166534] transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" />
                  Önce AI asistana danış
                </Link>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-[#F0FDF4] to-white rounded-2xl border border-[#DCFCE7] p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-2">Randevu veya Görüşme</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Vet. Hek. {user?.full_name} ile randevu alın.
                </p>
                <Link href="/auth/register">
                  <Button className="w-full bg-[#F97316] hover:bg-[#EA6A0A] text-white">
                    <Calendar className="w-4 h-4 mr-2" />
                    Randevu Al
                  </Button>
                </Link>
                <Link href="/ai-asistan" className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-[#166534] transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" />
                  Önce AI asistana danış
                </Link>
              </div>
            )}
          </div>

          {/* Report button */}
          <div className="flex justify-center pt-2 pb-4">
            <ReportVetButton vetId={v.id} />
          </div>
        </div>
      </main>
    </div>
    </>
  );
}
