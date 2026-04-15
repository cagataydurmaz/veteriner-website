import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Cache homepage for 5 minutes (300 seconds)
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Veterineri Bul | Türkiye'nin Güvenilir Online Veteriner Platformu",
  description:
    "Diploma doğrulamalı veterinerleri şehre ve uzmanlığa göre bulun. Online randevu, video görüşme ve yapay zeka destekli semptom kontrolü — hepsi Veterineri Bul'da.",
  alternates: { canonical: "https://veterineribul.com" },
  openGraph: {
    title: "Veterineri Bul | Türkiye'nin Güvenilir Online Veteriner Platformu",
    description:
      "Diploma doğrulamalı veterinerleri şehre ve uzmanlığa göre bulun. Online randevu, video görüşme, semptom kontrolü.",
    url: "https://veterineribul.com",
    images: [
      {
        url: "https://veterineribul.com/og-image.png",
        width: 1424,
        height: 752,
        alt: "Veterineri Bul Ana Sayfa",
      },
    ],
  },
};
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import HeroAssistant from "@/components/HeroAssistant";
import VetCarousel from "@/components/VetCarousel";
import HowItWorks from "@/components/HowItWorks";
import PricingTransparency from "@/components/PricingTransparency";
import DemoVetCarousel, { type DemoVet } from "@/components/home/DemoVetCarousel";
import HomeLogoLink from "@/components/home/HomeLogoLink";
import {
  Calendar,
  Video,
  Activity,
  Shield,
  Star,
  Clock,
  MapPin,
  Stethoscope,
  ShieldCheck,
  CreditCard,
  Users,
  CheckCircle,
  GraduationCap,
  Brain,
  Lock,
  BadgeCheck,
  Zap,
  PawPrint,
} from "lucide-react";

function toAvatarSeed(fullName: string): string {
  return fullName
    .replace(/^Dr\.\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/ş/g, "s").replace(/Ş/g, "S")
    .replace(/ğ/g, "g").replace(/Ğ/g, "G")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ç/g, "c").replace(/Ç/g, "C");
}

async function getSocialProof() {
  try {
    const supabase = await createClient();
    const [reviewsResult, carouselVetsResult, realVetCountResult, demoVetsResult] = await Promise.all([
      supabase
        .from("reviews")
        .select("rating, comment, created_at, owner:users!reviews_owner_id_fkey(full_name)")
        .eq("rating", 5)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("veterinarians")
        .select("id, specialty, consultation_fee, average_rating, total_reviews, city, user:users!veterinarians_user_id_fkey(full_name), offers_in_person, offers_video, offers_nobetci")
        .eq("is_verified", true)
        .eq("is_demo", false)
        .order("created_at", { ascending: false })
        .limit(16),
      supabase
        .from("veterinarians")
        .select("id", { count: "exact", head: true })
        .eq("is_verified", true)
        .eq("is_demo", false),
      supabase
        .from("veterinarians")
        .select("id, full_name, city, specialty, average_rating, total_reviews, bio, photo_url")
        .eq("is_demo", true)
        .eq("is_verified", true)
        .order("average_rating", { ascending: false }),
    ]);

    const carouselVets = (carouselVetsResult.data || []).map((v) => ({
      ...v,
      user: Array.isArray(v.user) ? v.user[0] : v.user,
    }));

    const realVetCount = realVetCountResult.count ?? 0;

    const demoVets: DemoVet[] = (demoVetsResult.data || []).map((v) => ({
      id: v.id,
      full_name: v.full_name ?? "",
      specialty: typeof v.specialty === "string" ? v.specialty : "",
      city: v.city ?? "",
      rating: v.average_rating ?? 0,
      appointment_count: v.total_reviews ?? 0,
      bio: v.bio ?? "",
      photo_url: v.photo_url ?? undefined,
      avatar_seed: toAvatarSeed(v.full_name ?? ""),
    }));

    return {
      reviews: reviewsResult.data || [],
      carouselVets,
      realVetCount,
      demoVets,
    };
  } catch {
    return { reviews: [], carouselVets: [], realVetCount: 0, demoVets: [] };
  }
}

export default async function Home() {
  const { reviews, carouselVets, realVetCount, demoVets } = await getSocialProof();

  // Get logged-in user info
  let userCity: string | null = null;
  let loggedInRole: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("city, role")
        .eq("id", user.id)
        .maybeSingle();
      userCity = userData?.city || null;
      loggedInRole = userData?.role || null;
    }
  } catch {}

  const features = [
    { icon: Calendar, title: "Kolay Randevu", desc: "7/24 online randevu alın, takvimde uygun saati seçin." },
    { icon: Video, title: "Online Görüşme", desc: "Evinizden çıkmadan veterinerinizle video görüşme yapın." },
    { icon: Activity, title: "Veteriner Yönlendirme", desc: "Yapay zeka ile aciliyet değerlendirmesi yapın, doğru uzmana yönlenin." },
    { icon: Shield, title: "Güvenli Kayıtlar", desc: "Tüm tıbbi kayıtlar şifreli ve güvenli saklanır." },
    { icon: Star, title: "Onaylı Veterinerler", desc: "Diploma ve TVHB üyeliği doğrulanmış veterinerler." },
    { icon: Clock, title: "Hatırlatıcılar", desc: "Aşı ve kontrol tarihlerini WhatsApp ile hatırlatın." },
  ];

  const tools = [
    { href: "/owner/symptom-check", icon: Activity, label: "Hayvanım Hasta mı?", desc: "Semptom kontrolü" },
    { href: "/arac/asi-takvimi", icon: Calendar, label: "Aşı Takvimi", desc: "Aşı programı hesapla" },
    { href: "/veteriner-bul", icon: MapPin, label: "Yakınımda Veteriner", desc: "Konumuma göre veteriner bul" },
    { href: "/arac/hangi-uzman", icon: Stethoscope, label: "Hangi Uzman?", desc: "Doğru uzmanı bul" },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Veteriner nasıl bulunur?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Veterineri Bul platformunda şehir veya uzmanlık alanına göre arama yaparak diploma doğrulamalı veterinerleri bulabilirsiniz. Ardından online randevu alabilir ya da video görüşme yapabilirsiniz.",
        },
      },
      {
        "@type": "Question",
        name: "Online veteriner güvenilir mi?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Veterineri Bul'daki tüm veteriner hekimler diploma doğrulaması ve lisans kontrolünden geçmektedir. Platform, KVKK uyumlu altyapısıyla tüm görüşmeleri güvenli tutar.",
        },
      },
      {
        "@type": "Question",
        name: "Randevu nasıl alınır?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Platforma üye olduktan sonra istediğiniz veterinerin profilini açın, uygun tarih ve saati takvimden seçip onaylayın. Randevu onayı SMS ve e-posta ile bildirilir.",
        },
      },
      {
        "@type": "Question",
        name: "Acil veteriner nasıl bulunur?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "'Nöbetçi Veteriner' filtresiyle bulunduğunuz şehirde acil hizmet veren veteriner hekimlere ulaşabilirsiniz. Hayvan sahipleri 7/24 nöbetçi veterinerlerle iletişime geçebilir.",
        },
      },
      {
        "@type": "Question",
        name: "Platform ücretsiz mi?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Veterineri Bul'a kayıt ve veteriner arama tamamen ücretsizdir. Randevu ücretleri veteriner hekim tarafından belirlenmekte olup platform üzerinden şeffaf şekilde gösterilmektedir.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    <div className="min-h-screen bg-[#FAFCFA]">
      {/* Header */}
      <header className="border-b border-[#D4E0D8] sticky top-0 bg-white/97 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <HomeLogoLink />
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/veteriner-bul" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#4A5C52] hover:bg-[#EEF5F2] hover:text-[#1A6B4A] transition-colors">
                <span>🏥</span> Klinikte Muayene
              </Link>
              <Link href="/online-veteriner" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#4A5C52] hover:bg-[#EEF5F2] hover:text-[#1A6B4A] transition-colors">
                <span>📹</span> Online Görüşme
              </Link>
              <Link href="/nobetci-veteriner" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#4A5C52] hover:bg-[#EEF5F2] hover:text-[#1A6B4A] transition-colors">
                <span>🚨</span> Acil & Nöbetçi
              </Link>
              {process.env.NEXT_PUBLIC_BLOG_ENABLED === 'true' && (
                <Link href="/blog" className="px-3 py-2 rounded-lg text-sm font-medium text-[#4A5C52] hover:bg-[#EEF5F2] hover:text-[#1A6B4A] transition-colors">
                  Blog
                </Link>
              )}
            </nav>
            <div className="flex items-center gap-3">
              {loggedInRole ? (
                <Link href={
                  loggedInRole === "admin" ? "/admin/dashboard" :
                  loggedInRole === "vet"   ? "/vet/dashboard"   :
                  "/owner/dashboard"
                }>
                  <Button size="sm" className="bg-[#3D6B5E] hover:bg-[#2C4A3E] text-white">
                    Panelime Git
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth/login">
                    <Button variant="ghost" size="sm" className="text-[#4A5C52] hover:text-[#2C3A32] hover:bg-[#EEF5F2] min-h-[44px]">
                      Giriş Yap
                    </Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button size="sm" className="bg-[#F97316] hover:bg-[#EA6A0A] text-white min-h-[44px]">
                      Kayıt Ol
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: "linear-gradient(150deg, #2C4A3E 0%, #3D6B5E 45%, #4A8070 75%, #3D6B5E 100%)" }} className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white px-4 py-1.5 rounded-full text-sm font-bold mb-6 shadow-sm">
                <Brain className="w-4 h-4" />
                Türkiye&apos;nin İlk ve Tek Yapay Zeka Destekli Veteriner Platformu
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
                <span className="text-[#95D5B2]">Veterineri Bul</span>
                <br />
                <span className="bg-gradient-to-r from-[#95D5B2] to-[#86EFAC] bg-clip-text text-transparent">
                  Yapay Zeka Asistan
                </span>
              </h1>
              <p className="text-lg text-white/80 mb-5">
                Yapay zeka ile <strong className="text-[#95D5B2]">doğru veterinere yönlenin</strong>, online randevu alın,
                video görüşme yapın — Diploma doğrulamalı veterinerlerle güvende olun.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth/register">
                  <Button size="xl" className="w-full sm:w-auto bg-[#F97316] hover:bg-[#EA6A0A] text-white">
                    Hemen Başla — Ücretsiz
                  </Button>
                </Link>
                <Link href="/auth/vet-register">
                  <Button variant="outline" size="xl" className="w-full sm:w-auto border-white/40 text-white hover:bg-white/10">
                    Veteriner Olarak Katıl
                  </Button>
                </Link>
              </div>
              {/* Stats */}
              <div className="mt-8 grid grid-cols-3 gap-6">
                {[
                  { value: "Türkiye Geneli", label: "Doğrulanmış Veteriner" },
                  { value: "81 İl", label: "Hizmet Bölgesi" },
                  { value: "Büyüyen Platform", label: "Aktif Randevular" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-lg font-bold text-[#95D5B2]">{stat.value}</p>
                    <p className="text-xs text-white/60 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

            </div>

            {/* AI Assistant Widget */}
            <HeroAssistant userCity={userCity} />
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır */}
      <HowItWorks />

      {/* Nasıl Doğruluyoruz? — Full-width below hero */}
      <section className="py-14 bg-[#F6F3EF]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#EEF5F2] border border-[#D4E0D8] px-4 py-1.5 rounded-full text-sm font-semibold text-[#3D6B5E] mb-4">
              <BadgeCheck className="w-4 h-4" /> Güvenilir Platform
            </div>
            <h2 className="text-3xl font-black text-[#2C3A32] mb-3">Veterinerleri Nasıl Doğruluyoruz?</h2>
            <p className="text-[#7A8F85] max-w-xl mx-auto text-sm">
              Platformumuzdaki her veteriner 4 aşamalı doğrulama sürecinden geçer.
              Onaylanmadan aktif olamazlar.
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[
              { icon: GraduationCap, step: "1", label: "Diploma Yükleme", desc: "Mezuniyet belgesi sisteme yüklenir ve kayıt altına alınır.", color: "bg-blue-50 text-blue-600" },
              { icon: ShieldCheck, step: "2", label: "TVHB Üyeliği", desc: "Türk Veteriner Hekimleri Birliği üyelik numarası doğrulanır.", color: "bg-purple-50 text-purple-600" },
              { icon: Shield, step: "3", label: "Admin İncelemesi", desc: "Tüm belgeler ekibimiz tarafından manuel olarak incelenir.", color: "bg-orange-50 text-orange-600" },
              { icon: BadgeCheck, step: "4", label: "Onaylı Profil", desc: "Onay sonrası profil yayınlanır ve randevu alımı başlar.", color: "bg-[#EEF5F2] text-[#3D6B5E]" },
            ].map((s, i) => (
              <div key={s.label} className="relative">
                <div className="bg-white border border-[#D4E0D8] shadow-sm hover:border-[#3D6B5E] rounded-2xl p-5 h-full flex flex-col items-center text-center transition-colors">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                    <s.icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-[#7A8F85] mb-1">ADIM {s.step}</span>
                  <p className="font-bold text-[#2C3A32] text-sm mb-2">{s.label}</p>
                  <p className="text-xs text-[#7A8F85] leading-relaxed">{s.desc}</p>
                </div>
                {i < 3 && (
                  <div className="hidden sm:flex absolute top-1/2 -right-2 transform -translate-y-1/2 z-10 w-4 h-4 bg-[#3D6B5E] rounded-full items-center justify-center">
                    <span className="text-white text-[8px] font-bold">›</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bottom note */}
          <div className="bg-gradient-to-r from-[#2C4A3E] to-[#3D6B5E] rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold">Türkiye&apos;de bir ilk — Doğrulamalı Veteriner Platformu</p>
              <p className="text-white/70 text-sm mt-1">Diploma ve TVHB üyeliği doğrulanmamış hiçbir veteriner platformda aktif olamaz.</p>
            </div>
            <Link href="/auth/register">
              <Button className="bg-white text-[#3D6B5E] hover:bg-white/90 font-bold shrink-0">
                Şimdi Başla
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Neden Farklıyız? */}
      <section className="py-14 bg-[#FAFCFA]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#EEF5F2] border border-[#D4E0D8] text-[#3D6B5E] px-4 py-1.5 rounded-full text-sm font-bold mb-4">
              <Zap className="w-4 h-4" /> Platform Farkı
            </div>
            <h2 className="text-3xl font-black text-[#2C3A32] mb-3">Neden Diğer Sitelerden Farklıyız?</h2>
            <p className="text-[#7A8F85] max-w-xl mx-auto text-sm">
              Veterineri Bul, Türkiye&apos;nin tek yapay zeka destekli, doğrulamalı veteriner platformudur.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: Brain,
                title: "Yapay Zeka Yönlendirme",
                desc: "Semptomlarınızı anlatın, AI hangi uzmanla görüşmeniz gerektiğini belirlesin. Doğru veterinere ilk seferde ulaşın.",
                tag: "Sadece Bizde",
                tagColor: "bg-purple-50 text-purple-700",
                iconBg: "bg-purple-50 text-purple-600",
              },
              {
                icon: BadgeCheck,
                title: "Diploma Doğrulaması",
                desc: "Her veteriner, diploma ve TVHB belgesiyle doğrulanır. Sahte profil sıfır — sadece gerçek uzmanlar.",
                tag: "Güvence",
                tagColor: "bg-[#EEF5F2] text-[#3D6B5E]",
                iconBg: "bg-[#EEF5F2] text-[#3D6B5E]",
              },
              {
                icon: Video,
                title: "HD Video Görüşme",
                desc: "720p kalitesinde, şifreli, kayıt tutulmayan video görüşme. Evinizden profesyonel muayene.",
                tag: "720p HD",
                tagColor: "bg-blue-50 text-blue-700",
                iconBg: "bg-blue-50 text-blue-600",
              },
              {
                icon: CreditCard,
                title: "Hayvan Sahiplerine Ücretsiz",
                desc: "Platform kullanımı, randevu alma, AI asistan ve araçların tamamı hayvan sahipleri için ücretsizdir.",
                tag: "Tamamen Ücretsiz",
                tagColor: "bg-yellow-50 text-yellow-700",
                iconBg: "bg-yellow-50 text-yellow-600",
              },
              {
                icon: Lock,
                title: "KVKK Uyumlu Gizlilik",
                desc: "Tıbbi kayıtlar AES-256 şifrelemesiyle saklanır. Verileriniz hiçbir üçüncü tarafla paylaşılmaz.",
                tag: "KVKK",
                tagColor: "bg-gray-100 text-gray-600",
                iconBg: "bg-gray-100 text-gray-600",
              },
              {
                icon: Star,
                title: "Şeffaf Puanlama",
                desc: "Gerçek kullanıcı yorumları ve puanlar manipüle edilmez. Veteriner seçiminde güvenilir rehberiniz.",
                tag: "Güvenilir",
                tagColor: "bg-orange-50 text-orange-700",
                iconBg: "bg-orange-50 text-orange-600",
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl p-5 border border-[#D4E0D8] shadow-sm hover:border-[#3D6B5E] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.iconBg}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.tagColor}`}>{item.tag}</span>
                </div>
                <h3 className="font-bold text-[#2C3A32] mb-2 text-sm">{item.title}</h3>
                <p className="text-xs text-[#7A8F85] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="border-y border-[#D4E0D8] bg-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
            {[
              { icon: ShieldCheck, label: "KVKK Uyumlu" },
              { icon: CheckCircle, label: "Doğrulanmış Uzmanlar" },
              { icon: CreditCard, label: "Güvenli Ödeme" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-[#4A5C52]">
                <Icon className="w-4 h-4 text-[#3D6B5E]" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free SEO Tools */}
      <section className="py-12 bg-[#F6F3EF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-widest text-[#3D6B5E] font-semibold mb-2">Ücretsiz Araçlar</p>
            <h2 className="text-2xl font-bold text-[#2C3A32]">Evcil Hayvanınız İçin Hızlı Kontrol</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {tools.map((tool) => (
              <Link key={tool.href} href={tool.href}>
                <div className="bg-white rounded-xl p-4 text-center hover:border-[#3D6B5E] hover:shadow-md transition-all border border-[#D4E0D8] shadow-sm cursor-pointer group h-full flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-[#EEF5F2] flex items-center justify-center group-hover:bg-[#D4E0D8] transition-colors">
                    <tool.icon className="w-5 h-5 text-[#3D6B5E]" />
                  </div>
                  <p className="font-semibold text-sm text-[#2C3A32] leading-snug">{tool.label}</p>
                  <p className="text-xs text-[#7A8F85]">{tool.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Vet Carousel */}
      <section className="py-12 bg-[#FAFCFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#3D6B5E] font-semibold mb-1">Doğrulanmış Uzmanlar</p>
              <h2 className="text-2xl font-bold text-[#2C3A32]">Veterinerlerimizle Tanışın</h2>
            </div>
            <Link href="/auth/register" className="text-sm text-[#3D6B5E] font-medium hover:underline hidden sm:block">
              Tümünü gör →
            </Link>
          </div>
        </div>
        {realVetCount < 3 && demoVets.length > 0 ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <DemoVetCarousel vets={demoVets} />
          </div>
        ) : (
          <VetCarousel vets={carouselVets} />
        )}
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24 bg-[#F6F3EF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#2C3A32] mb-4">Neden Veterineri Bul?</h2>
            <p className="text-[#4A5C52] max-w-xl mx-auto">
              Evcil hayvanınızın sağlığını takip etmek, randevu almak ve
              veterinerinizle iletişimde kalmak hiç bu kadar kolay olmamıştı.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white rounded-2xl p-6 border border-[#D4E0D8] shadow-sm hover:border-[#3D6B5E] transition-colors">
                  <div className="w-12 h-12 bg-[#EEF5F2] rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-[#3D6B5E]" />
                  </div>
                  <h3 className="font-semibold text-[#2C3A32] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#7A8F85]">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Transparency */}
      <PricingTransparency />

      {/* Recent Verified Vets — hidden until platform has enough data */}

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="py-12 bg-[#F6F3EF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-[#2C3A32] mb-6 text-center">Kullanıcı Yorumları</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {reviews.map((review, i) => {
                const owner = Array.isArray(review.owner) ? review.owner[0] : review.owner;
                return (
                  <div key={i} className="bg-white rounded-xl border border-[#D4E0D8] shadow-sm p-4">
                    <div className="flex gap-0.5 mb-2">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                    <p className="text-sm text-[#4A5C52] mb-3 line-clamp-3">{review.comment}</p>
                    <p className="text-xs text-[#7A8F85] font-medium">{owner?.full_name || "Anonim"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* SSS */}
      <section className="py-16 bg-[#FAFCFA]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[#2C3A32] mb-3">Sık Sorulan Sorular</h2>
            <p className="text-[#7A8F85]">Merak ettiklerinizi burada bulabilirsiniz.</p>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "Platform gerçekten ücretsiz mi?",
                a: "Evet. Hayvan sahipleri için üyelik, veteriner arama ve randevu alma tamamen ücretsizdir. Ödeme yalnızca veteriner hekimin belirlediği muayene veya görüşme ücretine yapılır — platform bu ücretten pay almaz.",
              },
              {
                q: "Veterinerler neden ücretsiz kullanıyor?",
                a: "Beta döneminde tüm özellikler ücretsizdir. Ücretli döneme geçmeden önce veteriner hekimlere önceden bilgilendirme yapılacak ve onay alınacaktır. Kredi kartı bilgisi şu an talep edilmemektedir.",
              },
              {
                q: "Online görüşmede ödeme nasıl işliyor?",
                a: "Video görüşme öncesinde iyzico altyapısıyla güvenli ödeme alınır. Görüşme tamamlandıktan sonra ücret veteriner hekime aktarılır. İptal durumunda iade politikası uygulanır.",
              },
              {
                q: "Veteriner muayene ücreti ne kadar?",
                a: "Her veteriner hekimin muayene ücreti farklıdır; profil sayfasında açıkça gösterilir. Platform bu ücrete ek ücret veya komisyon eklemez.",
              },
              {
                q: "Veterinerler nasıl doğrulanıyor?",
                a: "Her veteriner diploma belgesi, TVHB (Türk Veteriner Hekimleri Birliği) üyelik belgesi ve lisans numarasıyla doğrulanır. Tüm belgeler admin tarafından manuel olarak incelenir; onay olmadan platform üzerinde aktif olamazlar.",
              },
              {
                q: "Video görüşme nasıl çalışır ve görüntü kalitesi nedir?",
                a: "Randevu saatinde size özel güvenli bir video odası oluşturulur. Agora altyapısı üzerinde 720p HD kalitesinde, şifreli bağlantıyla görüşme yapılır. Görüşmeler hiçbir şekilde kaydedilmez.",
              },
              {
                q: "Hangi hayvanlar için hizmet verilmektedir?",
                a: "Kedi, köpek, kuş, tavşan, hamster, sürüngen ve egzotik hayvanlar dahil tüm evcil hayvanlar için hizmet verilmektedir. Uzman filtresini kullanarak hayvanınıza özel veteriner bulabilirsiniz.",
              },
              {
                q: "Ücretler nasıl belirleniyor? Gizli ödeme var mı?",
                a: "Ücretler her veteriner tarafından bağımsız olarak belirlenir ve profilde açıkça gösterilir. Platform üzerinde gizli ücret veya ek komisyon yoktur.",
              },
              {
                q: "Verilerim ve hayvan sağlık kayıtlarım güvende mi?",
                a: "Tüm veriler KVKK uyumlu şekilde AES-256 şifrelemesiyle saklanır. Kişisel ve tıbbi verileriniz hiçbir üçüncü tarafla paylaşılmaz. Supabase Frankfurt (AB) sunucularında barındırılmaktadır.",
              },
              {
                q: "Randevuyu iptal edebilir miyim?",
                a: "Randevu saatinden 24 saat önce ücretsiz iptal yapabilirsiniz. Daha geç iptal durumunda veteriner politikası geçerlidir.",
              },
              {
                q: "Acil durumda ne yapmalıyım?",
                a: "Acil durumlarda en yakın veteriner kliniğine gidin. Platformumuzun yapay zeka asistanı nefes güçlüğü, bilinç kaybı, şiddetli kanama gibi acil belirtileri otomatik tespit ederek sizi uyarır.",
              },
              {
                q: "Veteriner olarak nasıl listelenebilirim?",
                a: "'Veteriner Olarak Kayıt Ol' butonuna tıklayarak diploma belgenizi ve TVHB üyelik numaranızı yükleyin. Admin onayı sonrası profiliniz yayınlanır ve randevu almaya başlayabilirsiniz.",
              },
              {
                q: "Yapay zeka asistan teşhis koyuyor mu?",
                a: "Hayır. AI asistanımız yalnızca aciliyet değerlendirmesi yaparak sizi doğru veteriner uzmana yönlendirir. Kesin tanı ve tedavi yalnızca veteriner hekim tarafından yapılabilir.",
              },
              {
                q: "Mobil uygulama var mı?",
                a: "Web sitemiz tüm cihazlarda mobil uyumludur ve PWA (Progresif Web Uygulaması) olarak ana ekrana eklenebilir. Native iOS ve Android uygulama yakında yayınlanacaktır.",
              },
            ].map(({ q, a }, i) => (
              <details key={i} className="group bg-white rounded-xl border border-[#D4E0D8] shadow-sm overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                  <span className="font-semibold text-[#2C3A32] text-sm pr-4">{q}</span>
                  <span className="text-[#3D6B5E] text-lg font-bold shrink-0 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-[#4A5C52] leading-relaxed border-t border-[#D4E0D8] pt-3">{a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA for Vets */}
      <section className="py-16 bg-[#2C4A3E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Veteriner misiniz?</h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            Pratiğinizi dijitalleştirin. Randevularınızı yönetin, hastalara
            online hizmet verin, gelirinizi artırın.
          </p>
          <Link href="/auth/vet-register">
            <Button size="xl" className="bg-[#F97316] hover:bg-[#EA6A0A] text-white">
              <MapPin className="w-5 h-5 mr-2" />
              Veteriner Olarak Kayıt Ol
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#243C34] text-white/70 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <PawPrint size={22} color="#FFFFFF" />
                <span className="font-bold text-white">Veterineri Bul</span>
              </div>
              <p className="text-xs text-white/50">Güvenilir veterineri kolayca bul.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-3">Araçlar</p>
              <div className="space-y-2">
                {tools.map((t) => (
                  <Link key={t.href} href={t.href} className="block text-xs hover:text-white transition-colors">{t.label}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-3">Şehirler</p>
              <div className="space-y-2">
                {["istanbul", "ankara", "izmir", "bursa", "antalya"].map((city) => (
                  <Link key={city} href={`/${city}-veteriner`} className="block text-xs hover:text-white transition-colors">{city} veteriner</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-3">Yasal</p>
              <div className="space-y-2">
                {[
                  { href: "/kvkk", label: "KVKK" },
                  { href: "/kullanim-kosullari", label: "Kullanım Koşulları" },
                  { href: "/blog", label: "Blog" },
                  { href: "/hakkimizda", label: "Hakkımızda" },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="block text-xs hover:text-white transition-colors">{l.label}</Link>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center">
            <p className="text-xs text-white/40">© 2024 Veterineri Bul. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
