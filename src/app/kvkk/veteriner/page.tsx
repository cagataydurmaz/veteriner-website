import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni (Veteriner) — Veterineri Bul",
  description: "Veteriner hekimlere yönelik kişisel verilerin korunması aydınlatma metni",
};

export default function KVKKVeterinerPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Ana Sayfa
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">KVKK Aydınlatma Metni</h1>
            <p className="text-sm text-gray-500">Veteriner Hekimler İçin — 6698 sayılı KVKK m. 10</p>
          </div>

          <Section title="1. Veri Sorumlusu">
            <p>
              Veterineri Bul Teknoloji A.Ş. (&quot;Platform&quot;), 6698 sayılı Kişisel Verilerin Korunması Kanunu
              (&quot;KVKK&quot;) kapsamında veri sorumlusudur.
            </p>
          </Section>

          <Section title="2. İşlenen Kişisel Veriler">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Kimlik verileri:</strong> Ad, soyad, unvan</li>
              <li><strong>İletişim verileri:</strong> E-posta, telefon, adres</li>
              <li><strong>Mesleki kimlik verileri:</strong> TVHB üye numarası, lisans numarası, Veteriner Hekimler Odası sicil numarası, diploma belgesi</li>
              <li><strong>Profil verileri:</strong> Uzmanlık alanı, biyografi, fotoğraf, şehir</li>
              <li><strong>Randevu ve klinik verileri:</strong> Randevu kayıtları, muayene notları (SOAP), yazdığı ilaçlar</li>
              <li><strong>Mali veriler:</strong> İBAN, ödeme geçmişi, platform kazançları</li>
              <li><strong>Teknik veriler:</strong> IP adresi, cihaz bilgisi, giriş geçmişi</li>
            </ul>
          </Section>

          <Section title="3. İşleme Amaçları ve Hukuki Dayanaklar">
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700">Amaç</th>
                  <th className="text-left p-3 font-medium text-gray-700">Hukuki Dayanak (KVKK m.5)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ["Mesleki kimlik doğrulama (TVHB, ODA)", "Kanuni yükümlülük / Sözleşmenin ifası"],
                  ["Platform profili oluşturma ve yayınlama", "Sözleşmenin ifası"],
                  ["Randevu yönetimi", "Sözleşmenin ifası"],
                  ["Ödeme ve fatura işlemleri", "Kanuni yükümlülük (VUK)"],
                  ["Klinik kayıt tutma (muayene/SOAP)", "5996 sayılı Kanun zorunluluğu"],
                  ["Şüpheli davranış tespiti (anti-circumvention)", "Meşru menfaat"],
                  ["Yasal ihbar yükümlülüğü hatırlatmaları", "Kanuni yükümlülük"],
                  ["Video görüşme hizmeti", "Sözleşmenin ifası"],
                ].map(([amaç, dayanak]) => (
                  <tr key={amaç}>
                    <td className="p-3 text-gray-700">{amaç}</td>
                    <td className="p-3 text-gray-500">{dayanak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="4. Veri Saklama Süreleri">
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700">Veri Türü</th>
                  <th className="text-left p-3 font-medium text-gray-700">Saklama Süresi</th>
                  <th className="text-left p-3 font-medium text-gray-700">Dayanak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ["Veterinerlik kayıtları (muayene, SOAP)", "10 yıl", "5996 sayılı Veteriner Hizmetleri Kanunu"],
                  ["Ödeme ve fatura kayıtları", "10 yıl", "213 sayılı Vergi Usul Kanunu"],
                  ["Diploma ve lisans belgeleri", "Meslek süresince + 5 yıl", "5996 sayılı Kanun"],
                  ["Mesajlaşma kayıtları", "3 yıl", "Zamanaşımı"],
                  ["Hesap bilgileri", "Hesap kapatma + 5 yıl", "KVKK m.7 / Zamanaşımı"],
                  ["Teknik/log verileri", "1 yıl", "5651 sayılı Kanun"],
                ].map(([tür, süre, dayanak]) => (
                  <tr key={tür}>
                    <td className="p-3 text-gray-700">{tür}</td>
                    <td className="p-3 font-medium text-gray-900">{süre}</td>
                    <td className="p-3 text-gray-500">{dayanak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="5. Üçüncü Taraflara Aktarım">
            <p className="mb-3">Mesleki verileriniz aşağıdaki hizmet sağlayıcılara aktarılmaktadır:</p>
            <div className="space-y-2">
              {[
                { name: "iyzico Ödeme Hizmetleri A.Ş.", purpose: "Ödeme ve ödeme dağıtım işlemleri", country: "Türkiye" },
                { name: "İleti Merkezi", purpose: "SMS / WhatsApp bildirimleri", country: "Türkiye" },
                { name: "Agora.io", purpose: "Video görüşme altyapısı", country: "ABD (SCC kapsamında)" },
                { name: "Supabase Inc.", purpose: "Veri tabanı, depolama, kimlik doğrulama", country: "ABD (SCC kapsamında)" },
                { name: "Anthropic PBC", purpose: "AI asistan (yalnızca şikayet metni işlenir)", country: "ABD (SCC kapsamında)" },
                { name: "Türk Veteriner Hekimleri Birliği (TVHB)", purpose: "Lisans doğrulama", country: "Türkiye" },
              ].map((p) => (
                <div key={p.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-xs">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{p.name}</p>
                    <p className="text-gray-500">{p.purpose}</p>
                  </div>
                  <span className="text-gray-400 shrink-0">{p.country}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="6. 5996 Sayılı Kanun Kapsamındaki Yükümlülükler">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
              <p className="font-bold mb-2">Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu (5996)</p>
              <p>
                Platform aracılığıyla sunulan hizmetler ve tutulan kayıtlar, 5996 sayılı Kanun kapsamındaki
                yükümlülüklerinizi etkileyebilir. Muayene kayıtları, ilaç reçeteleri ve ihbar zorunluluğu
                gerektiren hastalıklar için yasal sorumluluk veteriner hekime aittir.
              </p>
              <p className="mt-2">
                Platformumuz bu kapsamdaki yükümlülüklerinizi yerine getirmeniz için hatırlatma
                mekanizmaları sunmakla birlikte, yasal sorumluluk tamamen size aittir.
              </p>
            </div>
          </Section>

          <Section title="7. Haklarınız (KVKK m.11)">
            <ul className="list-disc pl-5 space-y-1">
              <li>Verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse bilgi talep etme</li>
              <li>Eksik veya yanlış verilerin düzeltilmesini isteme</li>
              <li>Mesleki profil verilerinin platformdan kaldırılmasını talep etme</li>
              <li>İşlemeye itiraz etme (meşru menfaat dayanağıyla işlenenlere)</li>
              <li>Zarara uğramanız hâlinde tazminat talep etme</li>
            </ul>
            <div className="mt-3 p-3 bg-[#F0FDF4] rounded-lg text-xs">
              <p className="font-medium text-[#166534]">Başvuru: kvkk@veterineribul.com</p>
              <p className="text-gray-600 mt-1">30 gün içinde yanıt verilmektedir.</p>
            </div>
          </Section>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
            Son güncelleme: Nisan 2026
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
