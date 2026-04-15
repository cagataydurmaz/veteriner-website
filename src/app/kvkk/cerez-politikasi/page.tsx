import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Çerez Politikası — Veterineri Bul",
};

export default function CerezPolitikasiPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Ana Sayfa
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Çerez Politikası</h1>
            <p className="text-sm text-gray-500">7 Nisan 2026 tarihinde yürürlüğe girmiştir.</p>
          </div>

          <Section title="Çerez Nedir?">
            <p>
              Çerezler, ziyaret ettiğiniz web sitesi tarafından cihazınıza yerleştirilen küçük metin
              dosyalarıdır. Oturum yönetimi, tercihlerinizin hatırlanması ve platform güvenliği için
              kullanılırlar.
            </p>
          </Section>

          <Section title="Kullandığımız Çerezler">
            <div className="space-y-3">
              {[
                {
                  category: "Zorunlu Çerezler",
                  color: "bg-green-50 border-green-200",
                  badge: "Her zaman aktif",
                  badgeColor: "bg-green-100 text-green-700",
                  items: [
                    { name: "sb-auth-token", purpose: "Supabase kimlik doğrulama oturumu", duration: "Oturum sonunda silinir" },
                    { name: "oauth_role", purpose: "Google OAuth kayıt akışı", duration: "5 dakika" },
                  ],
                },
                {
                  category: "Analitik Çerezler",
                  color: "bg-blue-50 border-blue-200",
                  badge: "Onaya tabi",
                  badgeColor: "bg-blue-100 text-blue-700",
                  items: [
                    { name: "cookie_consent", purpose: "Çerez tercih kaydı", duration: "1 yıl" },
                  ],
                },
              ].map((group) => (
                <div key={group.category} className={`border rounded-xl p-4 ${group.color}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-sm text-gray-800">{group.category}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.badgeColor}`}>
                      {group.badge}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div key={item.name} className="text-xs">
                        <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded text-gray-800">{item.name}</span>
                        <span className="text-gray-600 ml-2">{item.purpose}</span>
                        <span className="text-gray-400 ml-2">· {item.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Çerez Tercihlerinizi Değiştirme">
            <p>
              Tarayıcınızın ayarlarından çerezleri silebilir veya engelleyebilirsiniz. Zorunlu çerezleri
              devre dışı bırakmanız durumunda platform işlevselliği etkilenebilir. Tercihlerinizi
              sayfanın alt kısmındaki çerez bildirimi aracılığıyla istediğiniz zaman güncelleyebilirsiniz.
            </p>
          </Section>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
            İletişim: kvkk@veterineribul.com · Son güncelleme: Nisan 2026
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}
