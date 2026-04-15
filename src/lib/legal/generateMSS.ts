/**
 * Mesafeli Satış Sözleşmesi (MSS) Generator
 *
 * Turkish Law Basis:
 *   - 6502 Sayılı Tüketicinin Korunması Hakkında Kanun (Consumer Protection Law)
 *   - Mesafeli Sözleşmeler Yönetmeliği (Remote Sales Regulation), 27 November 2014
 *
 * Generates a legally-required "Mesafeli Satış Sözleşmesi" as plain text.
 * The returned string should be presented to the user before payment and
 * their acceptance logged in legal_consent_logs.
 */

export interface MSSData {
  // Appointment
  appointmentId:    string;
  appointmentType:  "clinic" | "online" | "emergency";
  appointmentDate:  string;   // "15 Nisan 2026 Saat 10:30"
  serviceName:      string;   // e.g. "Online Video Veteriner Görüşmesi"
  serviceAmount:    number;   // TRY
  commissionPct?:   number;   // platform commission %

  // Vet (Satıcı / Hizmet Sağlayıcı)
  vetFullName:      string;
  vetClinicName?:   string;
  vetLicenseNo?:    string;
  vetCity:          string;
  vetPhone?:        string;

  // Owner (Alıcı / Tüketici)
  ownerFullName:    string;
  ownerEmail:       string;
  ownerPhone?:      string;
  ownerCity?:       string;

  // Pet
  petName:          string;
  petSpecies:       string;

  // Timestamps
  generatedAt?:     Date;
}

export interface MSSResult {
  text:    string;   // Full agreement text in Turkish
  version: string;   // Semver string for audit trail
}

/** Current MSS template version — bump when legal text changes */
const MSS_VERSION = "1.0.0";

export function generateMSS(data: MSSData): MSSResult {
  const now = data.generatedAt ?? new Date();
  const generatedStr = now.toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const serviceTypeLabel =
    data.appointmentType === "online"    ? "Uzaktan Video Veteriner Danışmanlık Hizmeti" :
    data.appointmentType === "emergency" ? "Acil Uzaktan Veteriner Danışmanlık Hizmeti"  :
    "Klinik Veteriner Muayene Hizmeti";

  const isRemote = data.appointmentType === "online" || data.appointmentType === "emergency";

  // Cancellation policy text (6502 Art. 49 — scheduled services)
  const cancellationPolicy = isRemote
    ? `Tüketici, hizmet tarihinden 24 (yirmi dört) saat öncesine kadar herhangi bir gerekçe göstermeksizin ücretin tamamı iade edilmek suretiyle sözleşmeden dönme hakkına sahiptir. Hizmet tarihine 24 saatten az kaldığında iptal taleplerinde ücret iadesi yapılmaz. Hizmet tarihine 2 saatten az kaldığında ücret iadesi yapılmaz ve veteriner hekime ödeme aktarılır.`
    : `Tüketici, randevu tarihinden 24 (yirmi dört) saat öncesine kadar iptal edebilir; bu durumda ödeme iadesi platform politikasına göre işlenir. Klinik randevularında ödeme klinik bünyesinde tahsil edilir.`;

  const text = `
══════════════════════════════════════════════════════════════════
             MESAFELİ SATIŞ SÖZLEŞMESİ (MSS)
══════════════════════════════════════════════════════════════════
Sözleşme Tarihi   : ${generatedStr}
Sözleşme No       : MSS-${data.appointmentId.slice(0, 8).toUpperCase()}
MSS Sürüm         : ${MSS_VERSION}

──────────────────────────────────────────────────────────────────
MADDE 1 — TARAFLAR
──────────────────────────────────────────────────────────────────
SATICI (Hizmet Sağlayıcı)
  Unvan       : ${data.vetClinicName ?? `Vet. Hek. ${data.vetFullName}`}
  Ad Soyad    : ${data.vetFullName}
  ${data.vetLicenseNo ? `Lisans No   : ${data.vetLicenseNo}\n  ` : ""}Şehir       : ${data.vetCity}
  ${data.vetPhone ? `Telefon     : ${data.vetPhone}` : ""}

PLATFORM (Aracı Hizmet Sağlayıcı)
  Unvan       : Veterineri Bul Teknoloji A.Ş.
  Adres       : Türkiye
  E-Posta     : destek@veterineribul.com
  Web         : https://veterineribul.com

ALICI (Tüketici)
  Ad Soyad    : ${data.ownerFullName}
  E-Posta     : ${data.ownerEmail}
  ${data.ownerPhone ? `Telefon     : ${data.ownerPhone}` : ""}
  ${data.ownerCity  ? `Şehir       : ${data.ownerCity}`  : ""}

──────────────────────────────────────────────────────────────────
MADDE 2 — HİZMETİN KONUSU
──────────────────────────────────────────────────────────────────
Hizmet Türü       : ${serviceTypeLabel}
Evcil Hayvan      : ${data.petName} (${data.petSpecies})
Randevu Tarihi    : ${data.appointmentDate}
Hizmet Bedeli     : ₺${data.serviceAmount.toFixed(2)} (KDV Dahil)
Ödeme Yöntemi     : Kredi / Banka Kartı (Iyzico Güvenceli Ödeme)

──────────────────────────────────────────────────────────────────
MADDE 3 — HİZMET KAPSAMI VE SINIRLAMALAR
──────────────────────────────────────────────────────────────────
${isRemote
  ? `Bu sözleşme kapsamında sunulan hizmet, platform üzerinden gerçekleştirilen uzaktan veteriner DANIŞMANLIĞI niteliğindedir.

⚠️  ÖNEMLİ UYARI:
    • Bu hizmet TANI ve TEDAVİ yerine geçmez.
    • Fiziksel muayene yapılmaz; uzaktan değerlendirme yapılır.
    • Reçeteli ilaç yazılmaz (5996 Sayılı Veteriner Hizmetleri Kanunu).
    • Acil ve hayatı tehdit eden durumlarda fiziksel veteriner kliniğine başvurun.`
  : `Bu sözleşme kapsamında sunulan hizmet, klinik ortamında yüz yüze gerçekleştirilen veteriner muayenesidir.`}

──────────────────────────────────────────────────────────────────
MADDE 4 — ÖDEME VE EMANET (ESCROW) KOŞULLARI
──────────────────────────────────────────────────────────────────
${isRemote
  ? `Hizmet bedeli olan ₺${data.serviceAmount.toFixed(2)}, ödeme aşamasında Iyzico aracılığıyla kredi kartından tahsil edilir ve platform bünyesinde emanet (escrow) hesabında tutulur. Hizmetin başarıyla tamamlanmasının ardından veterinere aktarılır.

Platform Hizmet Bedeli: Hizmet bedelinin %${data.commissionPct ?? 15}'i platform aracılık komisyonu olarak kesilir.`
  : `Klinik muayenelerde ödeme doğrudan veteriner kliniğinde tahsil edilir. Platform bu işlemde ödeme aracılığı yapmaz.`}

──────────────────────────────────────────────────────────────────
MADDE 5 — İPTAL VE İADE KOŞULLARI
──────────────────────────────────────────────────────────────────
${cancellationPolicy}

Veteriner tarafından gerçekleştirilen iptallerde hizmet bedelinin tamamı iade edilir.

İade işlemleri, 6502 Sayılı Kanun'un 49. maddesi ve Mesafeli Sözleşmeler Yönetmeliği uyarınca, iade talebinin onaylanmasından itibaren 14 (on dört) iş günü içinde tamamlanır.

──────────────────────────────────────────────────────────────────
MADDE 6 — KİŞİSEL VERİLERİN KORUNMASI (KVKK)
──────────────────────────────────────────────────────────────────
6698 Sayılı Kişisel Verilerin Korunması Kanunu kapsamında, bu işlem sırasında toplanan kişisel veriler (ad, e-posta, telefon, IP adresi, randevu bilgileri) yalnızca hizmetin ifası, yasal yükümlülüklerin yerine getirilmesi ve olası uyuşmazlıkların çözümü amacıyla işlenmektedir.

Verileriniz üçüncü taraflarla, hizmetin ifası için zorunlu olan alt yükleniciler (Iyzico Ödeme Hizmetleri A.Ş., Supabase Inc.) dışında paylaşılmaz.

Kişisel veri haklarınız (erişim, düzeltme, silme, itiraz) için: kvkk@veterineribul.com

──────────────────────────────────────────────────────────────────
MADDE 7 — UYUŞMAZLIK ÇÖZÜMÜ
──────────────────────────────────────────────────────────────────
Bu sözleşmeden doğan uyuşmazlıklarda Türk Hukuku uygulanır. Tüketici şikâyetleri için:
  • Tüketici Hakem Heyeti (₺77.892 altı uyuşmazlıklar)
  • Tüketici Mahkemeleri (₺77.892 üzeri uyuşmazlıklar)

──────────────────────────────────────────────────────────────────
MADDE 8 — YÜRÜRLÜK
──────────────────────────────────────────────────────────────────
Bu sözleşme, alıcının "Ödemeyi Tamamla" veya "Randevu Onayla" butonuna tıklamasıyla kabul edilmiş sayılır ve bu tarihten itibaren yürürlüğe girer.

Sözleşme Tarihi: ${generatedStr}
══════════════════════════════════════════════════════════════════
`.trim();

  return { text, version: MSS_VERSION };
}

/**
 * Returns a short one-line summary of the key financial terms for inline display.
 * Use this in checkout UIs before the full MSS link.
 */
export function getMSSSummary(data: Pick<MSSData, "serviceAmount" | "appointmentType" | "appointmentDate">): string {
  const isRemote = data.appointmentType === "online" || data.appointmentType === "emergency";
  if (isRemote) {
    return `₺${data.serviceAmount.toFixed(2)} tahsil edilecek. ${data.appointmentDate} tarihine 24 saat kala iptal = tam iade. 2 saat kala veya sonrası iptal = iade yok.`;
  }
  return `Klinik muayene ücreti klinikte tahsil edilir. Randevunuzu 24 saat öncesinden iptal edebilirsiniz.`;
}
