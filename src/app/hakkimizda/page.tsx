import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Target, Eye, Heart, ShieldCheck, Zap, Users, PawPrint, Mail, MapPin, Phone } from "lucide-react";

export const metadata: Metadata = {
  title: "Hakkımızda — Veterineri Bul",
  description:
    "Veterineri Bul; Türkiye'deki evcil hayvan sahiplerini güvenilir veteriner hekimlerle buluşturan dijital sağlık platformudur.",
};

const VALUES = [
  {
    icon: Heart,
    title: "Hayvanlara Önce",
    desc: "Her kararımızda önceliğimiz evcil hayvanların refahı ve sağlığıdır.",
    color: "bg-red-50 text-red-600",
  },
  {
    icon: ShieldCheck,
    title: "Güven ve Şeffaflık",
    desc: "Kayıtlı, TVHB onaylı veterinerler. Gizli ücret yok, sürpriz yok.",
    color: "bg-[#F0FDF4] text-[#166534]",
  },
  {
    icon: Zap,
    title: "Teknoloji ile Erişim",
    desc: "Coğrafi engelleri ortadan kaldırıyoruz. Türkiye'nin her yerinden online veteriner.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Users,
    title: "Topluluk",
    desc: "Veteriner hekimler ve hayvan sahiplerinin birlikte büyüdüğü bir ekosistem.",
    color: "bg-purple-50 text-purple-600",
  },
];

const STATS = [
  { value: "500+", label: "Kayıtlı Veteriner Hekim" },
  { value: "81", label: "İlde Hizmet" },
  { value: "10.000+", label: "Pet Sahibi" },
  { value: "4.8★", label: "Ortalama Memnuniyet" },
];

export default function HakkimizdaPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Ana Sayfa
        </Link>

        {/* Hero */}
        <div className="bg-[#166534] text-white rounded-2xl p-8 mb-6 relative overflow-hidden">
          <div className="absolute right-6 top-6 opacity-10">
            <PawPrint className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-3 mb-5">
            <PawPrint size={28} color="#1A6B4A" />
            <div>
              <h1 className="text-2xl font-black">Veterineri Bul</h1>
              <p className="text-white/70 text-sm">Türkiye&apos;nin Akıllı Veteriner Platformu</p>
            </div>
          </div>
          <p className="text-white/85 leading-relaxed text-sm max-w-xl">
            Veterineri Bul; evcil hayvan sahiplerinin istedikleri zaman, istedikleri yerden güvenilir
            ve lisanslı veteriner hekimlere ulaşabilmesi için kurulmuş bir dijital sağlık
            platformudur. Randevu alımından video görüşmeye, sağlık takibinden AI destekli semptom
            analizine kadar geniş bir hizmet yelpazesi sunuyoruz.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-[#166534]">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Mission & Vision */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-[#F0FDF4] rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-[#166534]" />
              </div>
              <h2 className="font-bold text-gray-900">Misyonumuz</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Türkiye&apos;deki her evcil hayvanın, bulunduğu coğrafyadan bağımsız olarak kaliteli
              veterinerlik hizmetine erişebilmesini sağlamak. Teknolojinin gücüyle bu erişimi
              hızlı, şeffaf ve güvenilir kılmak.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Eye className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="font-bold text-gray-900">Vizyonumuz</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Hayvan sağlığında öncü dijital ekosistem olmak; veteriner hekimlerin pratiklerini
              büyütmesine destek olurken evcil hayvan sahiplerine sürekli ve proaktif sağlık
              yönetimi imkânı tanımak.
            </p>
          </div>
        </div>

        {/* Values */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">Değerlerimiz</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="flex gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${v.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{v.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{v.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Story */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-3">Hikayemiz</h2>
          <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
            <p>
              Veterineri Bul, Türkiye&apos;de milyonlarca evcil hayvan sahibinin ortak sorunundan doğdu:
              <em>&quot;En yakın veteriner nerede? Acil durumda kime ulaşabilirim?&quot;</em>
            </p>
            <p>
              Özellikle büyükşehir dışında yaşayan hayvan sahiplerinin deneyimli veterinere
              ulaşmasındaki güçlükleri gözlemledik. Aynı zamanda genç veteriner hekimlerin hasta
              tabanlarını dijital ortamda büyütmekte zorlandığını fark ettik.
            </p>
            <p>
              Bu iki sorunu tek platformda çözmeye karar verdik: hayvan sahipleri için kolay
              erişim, veteriner hekimler için pratik yönetim araçları. AI destekli semptom analizi,
              video görüşme altyapısı ve güvenli ödeme sistemiyle Türkiye&apos;nin ilk kapsamlı veteriner
              dijital platformunu hayata geçirdik.
            </p>
          </div>
        </div>

        {/* Compliance */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">Yasal Uyum ve Güvenlik</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            {[
              {
                title: "TVHB Doğrulaması",
                desc: "Tüm veteriner hekimler Türk Veteriner Hekimleri Birliği kaydıyla doğrulanır.",
              },
              {
                title: "KVKK Uyumu",
                desc: "6698 sayılı Kanun kapsamında tüm kişisel veriler işlenir ve korunur.",
              },
              {
                title: "5996 Sayılı Kanun",
                desc: "Klinik kayıtlar ve ilaç yazım süreçleri veterinerlik mevzuatına uygundur.",
              },
              {
                title: "iyzico Güvencesi",
                desc: "Tüm ödemeler PCI-DSS sertifikalı iyzico altyapısıyla güvence altındadır.",
              },
              {
                title: "Veri Güvenliği",
                desc: "Tıbbi kayıtlar AES-256 şifreli Supabase Frankfurt (AB) sunucularında saklanır.",
              },
              {
                title: "6502 TKHK",
                desc: "Tüketici hakları kapsamında şeffaf ücretlendirme ve iade politikası uygulanır.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-800">{item.title}</p>
                <p className="text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-[#166534] text-white rounded-2xl p-6">
          <h2 className="font-bold mb-4">İletişim</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            {[
              { icon: Mail, label: "E-posta", value: "merhaba@veterineribul.com" },
              { icon: Mail, label: "Destek", value: "destek@veterineribul.com" },
              { icon: Mail, label: "KVKK", value: "kvkk@veterineribul.com" },
              { icon: MapPin, label: "Adres", value: "İstanbul, Türkiye" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-start gap-2">
                  <Icon className="w-4 h-4 mt-0.5 text-white/60 shrink-0" />
                  <div>
                    <p className="text-white/60 text-xs">{item.label}</p>
                    <p className="text-white font-medium">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap gap-3 text-xs text-white/60">
            <Link href="/kvkk" className="hover:text-white transition-colors">KVKK</Link>
            <Link href="/kullanim-kosullari" className="hover:text-white transition-colors">Kullanım Koşulları</Link>
            <Link href="/kvkk/cerez-politikasi" className="hover:text-white transition-colors">Çerez Politikası</Link>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          © 2026 Veterineri Bul Teknoloji A.Ş. Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  );
}
