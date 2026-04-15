import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield, User, Stethoscope, Cookie, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "KVKK & Gizlilik — Veterineri Bul",
  description:
    "6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma metinleri ve gizlilik politikası",
};

const PAGES = [
  {
    href: "/kvkk/hayvan-sahibi",
    icon: User,
    title: "Hayvan Sahipleri İçin Aydınlatma Metni",
    desc: "Ad, iletişim, evcil hayvan ve randevu verilerinin nasıl işlendiği",
    color: "bg-[#F0FDF4] text-[#166534]",
  },
  {
    href: "/kvkk/veteriner",
    icon: Stethoscope,
    title: "Veteriner Hekimler İçin Aydınlatma Metni",
    desc: "Mesleki kimlik, klinik ve ödeme verilerinin nasıl işlendiği",
    color: "bg-blue-50 text-blue-700",
  },
  {
    href: "/kvkk/cerez-politikasi",
    icon: Cookie,
    title: "Çerez Politikası",
    desc: "Platformda kullanılan çerezler ve tercih yönetimi",
    color: "bg-amber-50 text-amber-700",
  },
];

export default function KVKKPage() {
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
        <div className="bg-[#166534] text-white rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">KVKK & Gizlilik</h1>
              <p className="text-white/70 text-sm">6698 sayılı Kanun kapsamında aydınlatma metinleri</p>
            </div>
          </div>
          <p className="text-white/80 text-sm leading-relaxed">
            Veterineri Bul olarak kişisel verilerinizi 6698 sayılı Kişisel Verilerin Korunması Kanunu
            (&quot;KVKK&quot;) ve ilgili mevzuat çerçevesinde, şeffaf ve güvenli biçimde işliyoruz.
            Aşağıdaki belgeleri rolünüze göre inceleyebilirsiniz.
          </p>
        </div>

        {/* Page Cards */}
        <div className="space-y-3 mb-6">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <Link key={p.href} href={p.href}>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-sm hover:border-[#166534]/30 transition-all flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{p.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Summary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900">Önemli Noktalar</h2>

          <div className="grid sm:grid-cols-2 gap-3 text-xs text-gray-700">
            {[
              { label: "Veri Sorumlusu", value: "Veterineri Bul Teknoloji A.Ş." },
              { label: "İletişim", value: "kvkk@veterineribul.com" },
              { label: "Yanıt Süresi", value: "Başvurudan itibaren 30 gün" },
              { label: "Veri Depolama", value: "Supabase — Frankfurt (AB)" },
              { label: "Ödeme İşlemcisi", value: "iyzico — Türkiye" },
              { label: "Sertifika", value: "ISO 27001 uyumlu altyapı" },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 font-medium">{item.label}</p>
                <p className="text-gray-800 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="p-4 bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl text-sm text-[#166534]">
            <p className="font-semibold mb-1">Başvuru Hakkınız</p>
            <p className="text-xs leading-relaxed text-gray-700">
              KVKK m. 11 kapsamında verilerinize erişim, düzeltme, silme ve itiraz haklarınızı{" "}
              <strong>kvkk@veterineribul.com</strong> adresine yazılı olarak iletebilirsiniz.
              Kimliğinizi doğrulayan belgelerle yapılan başvurular 30 gün içinde yanıtlanır.
              Kurula başvuru hakkınız saklıdır.
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Son güncelleme: Nisan 2026 · Kişisel Verileri Koruma Kurumu:{" "}
          <a
            href="https://www.kvkk.gov.tr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            kvkk.gov.tr
          </a>
        </p>
      </div>
    </div>
  );
}
