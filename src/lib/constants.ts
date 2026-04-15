export const VETERINARY_SCHOOLS = [
  "Ankara Üniversitesi Veteriner Fakültesi",
  "Atatürk Üniversitesi Veteriner Fakültesi",
  "Uludağ Üniversitesi Veteriner Fakültesi",
  "Selçuk Üniversitesi Veteriner Fakültesi",
  "Fırat Üniversitesi Veteriner Fakültesi",
  "Erciyes Üniversitesi Veteriner Fakültesi",
  "Ondokuz Mayıs Üniversitesi Veteriner Fakültesi",
  "İstanbul Üniversitesi-Cerrahpaşa Veteriner Fakültesi",
  "Kafkas Üniversitesi Veteriner Fakültesi",
  "Harran Üniversitesi Veteriner Fakültesi",
  "Adnan Menderes Üniversitesi Veteriner Fakültesi",
  "Burdur Mehmet Akif Ersoy Üniversitesi Veteriner Fakültesi",
  "Van Yüzüncü Yıl Üniversitesi Veteriner Fakültesi",
  "Sivas Cumhuriyet Üniversitesi Veteriner Fakültesi",
  "Hatay Mustafa Kemal Üniversitesi Veteriner Fakültesi",
  "Siirt Üniversitesi Veteriner Fakültesi",
  "Kırıkkale Üniversitesi Veteriner Fakültesi",
  "Balıkesir Üniversitesi Veteriner Fakültesi",
  "Kastamonu Üniversitesi Veteriner Fakültesi",
  "Bingöl Üniversitesi Veteriner Fakültesi",
  "Dicle Üniversitesi Veteriner Fakültesi",
  "Aksaray Üniversitesi Veteriner Fakültesi",
  "Ağrı İbrahim Çeçen Üniversitesi Veteriner Fakültesi",
  "Samsun Üniversitesi Veteriner Fakültesi",
  "Iğdır Üniversitesi Veteriner Fakültesi",
  "Gümüşhane Üniversitesi Veteriner Fakültesi",
  "Mehmet Akif Ersoy Üniversitesi Veteriner Fakültesi",
  "Yurt Dışı — Avrupa",
  "Yurt Dışı — Diğer",
];

export const TURKISH_CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya",
  "Artvin", "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu",
  "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır",
  "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun",
  "Gümüşhane", "Hakkari", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir",
  "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya",
  "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş",
  "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop",
  "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak",
  "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale",
  "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük",
  "Kilis", "Osmaniye", "Düzce",
];

export const VETERINARY_SPECIALTIES = [
  // Genel
  "Genel Veterinerlik",
  "Küçük Hayvan Pratiği",
  "Büyük Hayvan Pratiği",
  "Egzotik Hayvanlar",
  "Yaban Hayatı ve Zoo Hayvanları",
  // Cerrahi & Ortopedi
  "Ortopedi ve Cerrahi",
  "Yumuşak Doku Cerrahisi",
  "Nöro Cerrahi",
  // Dahiliye & Organ Sistemleri
  "İç Hastalıklar",
  "Kardiyoloji",
  "Nöroloji",
  "Onkoloji",
  "Dermatoloji",
  "Göz Hastalıkları (Oftalmoloji)",
  "Diş Hekimliği ve Ağız Cerrahisi",
  "Böbrek Hastalıkları (Nefroloji)",
  "Solunum Hastalıkları (Pulmonoloji)",
  "Sindirim Sistemi (Gastroenteroloji)",
  // Özel Alanlar
  "Acil ve Yoğun Bakım",
  "Anesteziyoloji",
  "Görüntüleme ve Radyoloji",
  "Üreme, Doğum ve Jinekoloji",
  "Beslenme ve Diyet",
  "Davranış Bilimleri (Etoloji)",
  "Koruyucu Hekimlik ve Aşılama",
  "Rehabilitasyon ve Fizik Tedavi",
];

// DB'de İngilizce kod saklanır, UI'da Türkçe label gösterilir
export const PET_SPECIES_OPTIONS = [
  { value: "dog",        label: "Köpek"       },
  { value: "cat",        label: "Kedi"        },
  { value: "bird",       label: "Kuş"         },
  { value: "rabbit",     label: "Tavşan"      },
  { value: "hamster",    label: "Hamster"     },
  { value: "fish",       label: "Balık"       },
  { value: "turtle",     label: "Kaplumbağa"  },
  { value: "mouse",      label: "Fare"        },
  { value: "hedgehog",   label: "Kirpi"       },
  { value: "guinea_pig", label: "Guinea Pig"  },
  { value: "other",      label: "Diğer"       },
] as const;

// Geriye dönük uyumluluk için (eski kodlarda kullanılan string[] formatı)
export const PET_SPECIES = PET_SPECIES_OPTIONS.map((s) => s.value);

// Kod → Türkçe label çevirisi için yardımcı fonksiyon
export function getPetSpeciesLabel(value: string): string {
  return PET_SPECIES_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

export const SUBSCRIPTION_TIERS = {
  basic: {
    name: "Basic",
    price: 300,
    color: "gray",
    features: [
      "Takvim yönetimi",
      "Temel randevu sistemi",
      "Hasta kayıtları",
      "E-posta bildirimleri",
    ],
  },
  pro: {
    name: "Pro",
    price: 600,
    color: "blue",
    features: [
      "Basic özellikler",
      "WhatsApp hatırlatıcılar",
      "Analitik dashboard",
      "Öncelikli destek",
      "Gelişmiş raporlama",
    ],
  },
  premium: {
    name: "Premium",
    price: 900,
    color: "purple",
    features: [
      "Pro özellikler",
      "Video görüşme",
      "Sesli not & transkripsiyon",
      "Arama sonuçlarında öncelik",
      "Özel profil sayfası",
    ],
  },
};

export const APPOINTMENT_TYPES = {
  in_person: "Yüz Yüze",
  video: "Video Görüşme",
};

export const URGENCY_COLORS = {
  low:       { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200",  label: "Bekleyebilir", icon: "🟢", timing: "Bu hafta veterinere gidin" },
  medium:    { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200", label: "Yakında Git",  icon: "🟡", timing: "2 gün içinde muayene ettirin" },
  high:      { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", label: "Bugün Git",   icon: "🟠", timing: "Bugün veterinere gidin" },
  emergency: { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200",    label: "ACİL",        icon: "🔴", timing: "En yakın nöbetçi veterinere gidin" },
  critical:  { bg: "bg-red-600",    text: "text-white",      border: "border-red-800",    label: "112'yi Arayın", icon: "🚨", timing: "Veteriner değil, hemen 112'yi arayın" },
};

export const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export const AI_DISCLAIMER = "⚠️ Bu sonuç yapay zeka tarafından oluşturulmuş bilgilendirme amaçlı bir ön değerlendirmedir. Kesin tanı için mutlaka veteriner hekime başvurunuz. Platform sağlık hizmeti sunmamaktadır.";
