import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni (Pet Sahibi) — Veterineri Bul",
  description: "Pet sahiplerine yönelik kişisel verilerin korunması aydınlatma metni",
};

export default function KVKKHayvanSahibiPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Ana Sayfa
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">KVKK Aydınlatma Metni</h1>
            <p className="text-sm text-gray-500">Hayvan Sahipleri İçin — 6698 sayılı KVKK m. 10</p>
          </div>

          <Section title="1. Veri Sorumlusu">
            <p>
              Veterineri Bul Teknoloji A.Ş. (&quot;Platform&quot; veya &quot;Şirket&quot;), 6698 sayılı Kişisel Verilerin
              Korunması Kanunu (&quot;KVKK&quot;) kapsamında veri sorumlusudur.
            </p>
          </Section>

          <Section title="2. İşlenen Kişisel Veriler">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Kimlik verileri:</strong> Ad, soyad</li>
              <li><strong>İletişim verileri:</strong> E-posta adresi, telefon numarası, şehir</li>
              <li><strong>Hesap verileri:</strong> Kullanıcı adı, şifreli kimlik bilgileri</li>
              <li><strong>Evcil hayvan verileri:</strong> Hayvan adı, türü, ırkı, sağlık bilgileri, aşı kayıtları</li>
              <li><strong>Randevu verileri:</strong> Randevu tarihleri, şikayetler, muayene notları</li>
              <li><strong>Ödeme verileri:</strong> İşlem numarası, tutar (kart/IBAN bilgileri iyzico tarafından işlenir)</li>
              <li><strong>Teknik veriler:</strong> IP adresi, cihaz bilgisi, çerezler</li>
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
                  ["Hesap oluşturma ve kimlik doğrulama", "Sözleşmenin ifası"],
                  ["Randevu yönetimi", "Sözleşmenin ifası"],
                  ["Veteriner ile eşleştirme", "Sözleşmenin ifası"],
                  ["Ödeme işlemleri", "Kanuni yükümlülük (VUK)"],
                  ["AI semptom analizi", "Açık rıza"],
                  ["Video görüşme hizmeti", "Sözleşmenin ifası"],
                  ["SMS/WhatsApp bildirimleri", "Açık rıza / Kanuni yükümlülük"],
                  ["Hizmet kalitesi iyileştirme", "Meşru menfaat"],
                  ["Yasal yükümlülüklerin yerine getirilmesi", "Kanuni yükümlülük"],
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
                  ["Tıbbi/veteriner kayıtları", "10 yıl", "5996 sayılı Veteriner Hizmetleri Kanunu"],
                  ["Ödeme kayıtları", "10 yıl", "213 sayılı Vergi Usul Kanunu"],
                  ["Kullanıcı hesabı", "Silme talebine kadar", "KVKK m.7"],
                  ["İletişim kayıtları", "3 yıl", "Zamanaşımı"],
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
            <p className="mb-3">Kişisel verileriniz aşağıdaki hizmet sağlayıcılara aktarılmaktadır:</p>
            <div className="space-y-2">
              {[
                { name: "iyzico Ödeme Hizmetleri A.Ş.", purpose: "Ödeme işlemleri", country: "Türkiye" },
                { name: "İleti Merkezi", purpose: "SMS / WhatsApp bildirimleri", country: "Türkiye" },
                { name: "Agora.io", purpose: "Video görüşme altyapısı", country: "ABD (SCC kapsamında)" },
                { name: "Supabase Inc.", purpose: "Veri tabanı ve depolama", country: "ABD (SCC kapsamında)" },
                { name: "Anthropic PBC", purpose: "Yapay zeka semptom analizi", country: "ABD (SCC kapsamında)" },
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

          <Section title="6. Haklarınız (KVKK m.11)">
            <p className="mb-2">Veri sahibi olarak aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
              <li>Eksik veya yanlış işlenmiş ise düzeltilmesini isteme</li>
              <li>Silinmesini veya yok edilmesini isteme</li>
              <li>Otomatik sistemler aracılığıyla işlenen veriler dolayısıyla aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
              <li>Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
            </ul>
            <div className="mt-3 p-3 bg-[#F0FDF4] rounded-lg text-xs">
              <p className="font-medium text-[#166534]">Başvuru: kvkk@veterineribul.com</p>
              <p className="text-gray-600 mt-1">30 gün içinde yanıt verilmektedir.</p>
            </div>
          </Section>

          <Section title="7. Veri İhlali Bildirimi">
            <p>
              Kişisel verilerinizin güvenliğini tehdit eden bir ihlal tespit edilmesi durumunda,
              KVKK m. 12/5 uyarınca 72 saat içinde Kişisel Verileri Koruma Kurulu&apos;na bildirimde
              bulunulacak ve makul süre içinde ilgili kişiler haberdar edilecektir.
            </p>
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
