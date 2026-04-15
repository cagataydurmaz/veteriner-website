import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Kullanım Koşulları — Veterineri Bul",
  description:
    "Veterineri Bul platformunu kullanmadan önce lütfen bu koşulları okuyunuz.",
};

export default function KullanimKosullariPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Ana Sayfa
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Kullanım Koşulları</h1>
            <p className="text-sm text-gray-500">
              Son güncelleme: Nisan 2026 · 6502 ve 6563 sayılı Kanunlar kapsamında hazırlanmıştır.
            </p>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            Bu platformu kullanmaya devam etmekle aşağıdaki koşulları okuduğunuzu, anladığınızı ve
            kabul ettiğinizi beyan etmiş olursunuz. Kabul etmiyorsanız platformu kullanmayınız.
          </div>

          <Section title="1. Taraflar ve Kapsam">
            <p>
              Bu Kullanım Koşulları; <strong>Veterineri Bul Teknoloji A.Ş.</strong> (&quot;Platform&quot;,
              &quot;Şirket&quot; veya &quot;Biz&quot;) ile platformu kullanan gerçek veya tüzel kişiler
              (&quot;Kullanıcı&quot;) arasındaki hukuki ilişkiyi düzenler.
            </p>
            <p className="mt-2">
              Platform; hayvan sahiplerinin kayıtlı veteriner hekimlerle randevu almasını, online
              görüşme yapmasını ve evcil hayvan sağlık takibini yönetmesini sağlayan bir aracı
              teknoloji hizmetidir. Platform, veterinerlik hizmeti sunmamakta; bu hizmeti sunan
              veteriner hekimler ile hayvan sahiplerini buluşturmaktadır.
            </p>
          </Section>

          <Section title="2. Tanımlar">
            <ul className="list-none space-y-2">
              {[
                ["Pet Sahibi", "Evcil hayvanı için randevu alan veya hizmet satın alan kullanıcı"],
                ["Veteriner Hekim", "TVHB'ye kayıtlı, platform üzerinden hizmet sunan meslek mensubu"],
                ["Randevu", "Veteriner hekim ile yüz yüze veya video görüşme talebi"],
                ["Platform Hizmeti", "Randevu aracılığı, ödeme altyapısı, mesajlaşma ve AI araçları"],
                ["İçerik", "Kullanıcıların platforma yüklediği metin, fotoğraf, video ve notlar"],
              ].map(([term, def]) => (
                <li key={term as string} className="flex gap-2">
                  <span className="font-semibold text-gray-800 shrink-0">{term}:</span>
                  <span className="text-gray-600">{def}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="3. Kayıt ve Hesap">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Platforma kayıt olmak için 18 yaşını doldurmuş olmanız gerekmektedir. 18 yaşından
                küçük kullanıcılar ancak ebeveyn/vasi gözetiminde platformu kullanabilir.
              </li>
              <li>
                Kayıt sırasında verdiğiniz bilgilerin doğru, güncel ve eksiksiz olduğunu beyan
                edersiniz.
              </li>
              <li>
                Hesap güvenliğiniz sizin sorumluluğunuzdadır. Şifrenizin üçüncü kişilerle
                paylaşılması sonucu oluşacak zararlardan Platform sorumlu tutulamaz.
              </li>
              <li>
                Veteriner hekimlerin kayıt sırasında geçerli TVHB üye numarası ve diploma belgesi
                sunması zorunludur. Yanıltıcı belge sunulması hesabın derhal askıya alınması ve
                yasal işlem başlatılmasına neden olabilir.
              </li>
            </ul>
          </Section>

          <Section title="4. Hizmetin Kapsamı ve Sınırları">
            <div className="space-y-3">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                <p className="font-semibold mb-1">Önemli Uyarı — Acil Durumlar</p>
                <p>
                  Platform acil veterinerlik hizmetleri sunmamaktadır. Hayvanınızın acil müdahale
                  gerektirdiğini düşündüğünüz durumlarda derhal bir veteriner kliniğine veya nöbetçi
                  veterinere başvurunuz.
                </p>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Platform, veteriner hekimler arasında aracılık yapar; doğrudan veterinerlik
                  hizmeti sunmaz.
                </li>
                <li>
                  AI semptom analizi aracı yalnızca bilgi amaçlıdır; tıbbi teşhis veya tedavi
                  önerisi niteliği taşımaz.
                </li>
                <li>
                  Video görüşmelerin kalitesi internet bağlantısına bağlıdır; teknik aksaklıklar
                  nedeniyle ücret iadesi yapılmaz, görüşme yeniden planlanır.
                </li>
                <li>
                  Platform üzerinden verilen reçeteler 5996 sayılı Kanun kapsamında sadece elektronik
                  ortamda geçerlidir; eczaneden ilaç alımı için veterinerin ayrıca resmi reçete
                  düzenlemesi gerekebilir.
                </li>
              </ul>
            </div>
          </Section>

          <Section title="5. Hayvan Sahiplerinin Yükümlülükleri">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Randevu bilgilerini (şikayet, geçmiş hastalık, ilaç kullanımı) eksiksiz ve doğru
                girmeyi kabul edersiniz.
              </li>
              <li>
                Belirlenen randevu saatine uymak zorundasınız. İptal için randevudan en az{" "}
                <strong>2 saat önce</strong> platform üzerinden bildirim yapılması gerekir.
              </li>
              <li>
                Veteriner hekimlere veya platform çalışanlarına hakaret, tehdit veya taciz içeren
                davranışlarda bulunulması hesabın kalıcı olarak kapatılmasına neden olur.
              </li>
              <li>
                Platform dışına yönlendirme (telefon numarası, sosyal medya paylaşımı) yasaktır ve
                hesabın askıya alınmasına yol açar.
              </li>
            </ul>
          </Section>

          <Section title="6. Veteriner Hekimlerin Yükümlülükleri">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Veteriner hekimler, 5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem
                Kanunu ile Türk Veteriner Hekimleri Birliği Etik Kuralları&apos;na uymakla yükümlüdür.
              </li>
              <li>
                Muayene notlarını (SOAP formatı) randevudan sonraki 24 saat içinde platforma
                girilmesi zorunludur.
              </li>
              <li>
                İhbar zorunluluğu gerektiren hastalıklar (şap, kuduz vb.) tespit edildiğinde
                veteriner hekim ilgili mercilere bildirmekle yükümlüdür; platform hatırlatma araçları
                sunmakla birlikte bu yasal sorumluluk hekime aittir.
              </li>
              <li>
                Platform komisyonu dışında pet sahibinden ek ücret talep edilemez; fiyat listesi
                profile eksiksiz girilmelidir.
              </li>
              <li>
                Profil fotoğrafı ve bilgilerinin gerçeği yansıtması zorunludur; sahte veya yanıltıcı
                profil oluşturulması yasal işlem başlatılmasına neden olur.
              </li>
            </ul>
          </Section>

          <Section title="7. Ödeme Koşulları">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Ödemeler iyzico Ödeme Hizmetleri A.Ş. üzerinden işlenir. Kart bilgileri Platform
                tarafından saklanmaz.
              </li>
              <li>
                Video görüşme ücreti, görüşme tamamlandıktan sonra tahsil edilir.
              </li>
              <li>
                Yüz yüze randevularda ücret muayenehane tarafından belirlenir; platform aracılık
                komisyonu randevudan sonra tahsil edilir.
              </li>
              <li>
                6502 sayılı Tüketicinin Korunması Hakkında Kanun uyarınca; hizmet ifa edilmemişse
                tam iade yapılır. Hizmet kısmen ifa edilmişse orantılı iade uygulanır.
              </li>
              <li>
                İade talepleri{" "}
                <strong>destek@veterineribul.com</strong> adresine en geç randevudan{" "}
                <strong>7 gün içinde</strong> iletilmelidir.
              </li>
            </ul>
          </Section>

          <Section title="8. Abonelik Planları">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Veteriner hekimlere sunulan abonelik planları (Basic, Pro, Premium) aylık veya
                taahhütlü dönemler için aktif edilir.
              </li>
              <li>
                Taahhütlü planlarda sözleşme süresi dolmadan iptal edilmesi durumunda kalan ay
                ücreti tahsil edilebilir.
              </li>
              <li>
                Abonelik iptali için <strong>en az 30 gün önceden</strong> yazılı bildirim
                yapılması gerekmektedir.
              </li>
              <li>
                Platform, plan fiyatlarında değişiklik yapma hakkını saklı tutar; değişiklikler en
                az 30 gün önceden bildirilir.
              </li>
            </ul>
          </Section>

          <Section title="9. Fikri Mülkiyet">
            <p>
              Platform üzerindeki tüm yazılım, tasarım, logo, içerik ve marka unsurları Veteriner
              Bul Teknoloji A.Ş.&apos;ye aittir veya lisanslıdır. İzinsiz kopyalanması, dağıtılması veya
              ticari amaçla kullanılması yasaktır.
            </p>
            <p className="mt-2">
              Kullanıcıların platforma yüklediği içerikler (fotoğraf, not, değerlendirme) üzerindeki
              haklar kullanıcıya ait olmaya devam eder; ancak kullanıcı söz konusu içerikleri
              platformun hizmet sunması amacıyla kullanmasına ücretsiz olarak izin vermiş sayılır.
            </p>
          </Section>

          <Section title="10. Gizlilik">
            <p>
              Kişisel verilerinizin işlenmesine ilişkin detaylı bilgi için{" "}
              <Link href="/kvkk" className="text-[#166534] hover:underline font-medium">
                KVKK Aydınlatma Metni
              </Link>
              &apos;ni inceleyiniz.
            </p>
          </Section>

          <Section title="11. Sorumluluk Sınırlaması">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Platform, veteriner hekimler ile hayvan sahipleri arasındaki bir aracıdır. Verilen
                veterinerlik hizmetinin kalitesi veya sonuçları konusunda Platform&apos;un doğrudan
                sorumluluğu bulunmamaktadır.
              </li>
              <li>
                Mücbir sebepler (deprem, sel, pandemi, internet kesintisi vb.) nedeniyle oluşacak
                aksaklıklarda Platform sorumlu tutulamaz.
              </li>
              <li>
                Kullanıcıların birbirlerine veya üçüncü kişilere verdiği zararlardan Platform
                sorumlu değildir.
              </li>
              <li>
                AI semptom analizi yanlış veya eksik sonuç üretebilir; bu sonuçlara dayanılarak
                alınan kararlardan Platform sorumlu değildir.
              </li>
            </ul>
          </Section>

          <Section title="12. Hesap Askıya Alma ve Fesih">
            <p>Aşağıdaki durumlarda Platform hesabınızı uyarı vermeksizin askıya alabilir veya kapatabilir:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Bu koşulların ihlali</li>
              <li>Sahte veya yanıltıcı bilgi sunulması</li>
              <li>Platform dışına yönlendirme girişimi</li>
              <li>Ödeme yükümlülüklerinin yerine getirilmemesi</li>
              <li>Kullanıcılara zarar verici davranış</li>
              <li>Türk hukukuna aykırı faaliyetler</li>
            </ul>
            <p className="mt-2">
              Hesap kapatma sonrası tıbbi kayıtlarınızı talep etme hakkınız{" "}
              <strong>5996 sayılı Kanun</strong> uyarınca 10 yıl süreyle saklıdır.
            </p>
          </Section>

          <Section title="13. Değişiklikler">
            <p>
              Platform bu koşulları değiştirme hakkını saklı tutar. Önemli değişiklikler kayıtlı
              e-posta adresinize en az <strong>30 gün önceden</strong> bildirilir. Değişiklik
              sonrası platformu kullanmaya devam etmeniz yeni koşulları kabul ettiğiniz anlamına
              gelir.
            </p>
          </Section>

          <Section title="14. Uygulanacak Hukuk ve Uyuşmazlık Çözümü">
            <p>
              Bu koşullar <strong>Türk Hukuku</strong>&apos;na tabidir ve Türk mahkemelerinde
              yorumlanır.
            </p>
            <p className="mt-2">
              Tüketici sıfatıyla platformu kullanan hayvan sahipleri, uyuşmazlıklarda{" "}
              <strong>6502 sayılı Tüketicinin Korunması Hakkında Kanun</strong> kapsamında yetkili
              Tüketici Hakem Heyetlerine veya Tüketici Mahkemelerine başvurabilir.
            </p>
            <p className="mt-2">
              Ticari kullanıcılar (veteriner hekimler) için yetkili mahkeme{" "}
              <strong>İstanbul Merkez Mahkemeleri</strong>&apos;dir.
            </p>
          </Section>

          <Section title="15. İletişim">
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              {[
                { label: "Genel destek", value: "destek@veterineribul.com" },
                { label: "KVKK başvuruları", value: "kvkk@veterineribul.com" },
                { label: "Hukuki bildirimler", value: "hukuk@veterineribul.com" },
                { label: "Şirket adı", value: "Veterineri Bul Teknoloji A.Ş." },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400">{item.label}</p>
                  <p className="font-medium text-gray-800">{item.value}</p>
                </div>
              ))}
            </div>
          </Section>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
            Son güncelleme: Nisan 2026 · 6502 sayılı TKHK, 6563 sayılı ETK ve 5996 sayılı VHK
            kapsamında hazırlanmıştır.
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
