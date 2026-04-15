import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Clock, Shield, PawPrint } from "lucide-react";

export const metadata: Metadata = {
  title: "İletişim — Veterineri Bul",
  description:
    "Veterineri Bul destek ekibiyle iletişime geçin. Sorularınız, şikayetleriniz ve önerileriniz için buradayız.",
};

export default function IletisimPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1A6B4A] text-white py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors">
            <PawPrint className="w-4 h-4" />
            Veterineri Bul
          </Link>
          <h1 className="text-3xl font-black mb-2">İletişim</h1>
          <p className="text-white/80 text-sm">
            Sorularınız için destek ekibimize ulaşabilirsiniz.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Contact Cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#E8F5EE] rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#1A6B4A]" />
              </div>
              <h2 className="font-bold text-gray-900">Destek E-postası</h2>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Genel destek, hesap sorunları ve teknik yardım için.
            </p>
            <a
              href="mailto:destek@veterineribul.com"
              className="inline-block text-[#1A6B4A] font-semibold text-sm hover:underline"
            >
              destek@veterineribul.com
            </a>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#E8F5EE] rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#1A6B4A]" />
              </div>
              <h2 className="font-bold text-gray-900">Yanıt Süresi</h2>
            </div>
            <p className="text-sm text-gray-500">
              Tüm e-postalara en geç <strong>1–2 iş günü</strong> içinde yanıt veriyoruz.
              Acil durumlar için lütfen konuyu belirtiniz.
            </p>
          </div>
        </div>

        {/* KVKK contact */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="font-bold text-gray-900">KVKK Başvuruları</h2>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Kişisel verilerinize ilişkin başvurularınızı (erişim, düzeltme, silme, itiraz)
            aşağıdaki adrese iletebilirsiniz. Başvurular 30 gün içinde yanıtlanır.
          </p>
          <a
            href="mailto:kvkk@veterineribul.com"
            className="inline-block text-blue-600 font-semibold text-sm hover:underline"
          >
            kvkk@veterineribul.com
          </a>
          <p className="text-xs text-gray-400 mt-2">
            Detaylı bilgi için:{" "}
            <Link href="/kvkk" className="text-[#1A6B4A] hover:underline">
              KVKK Aydınlatma Metinleri
            </Link>
          </p>
        </div>

        {/* Common topics */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Sık Sorulan Konular</h2>
          <ul className="space-y-3 text-sm text-gray-600">
            {[
              { topic: "Hesap açma / giriş sorunu", hint: "E-posta veya şifre sorunları için destek yazın." },
              { topic: "Randevu iptali / iadesi", hint: "Ödeme iadesi en geç 5–7 iş günü içinde yapılır." },
              { topic: "Veteriner kayıt süreci", hint: "Diploma doğrulaması için belgelerinizi hazır bulundurun." },
              { topic: "Şikayet / ihbar", hint: "Platform dışı yönlendirme veya uygunsuz davranış bildirin." },
              { topic: "Veri silme talebi", hint: "KVKK kapsamında hesabınızı ve verilerinizi silebilirsiniz." },
            ].map(({ topic, hint }) => (
              <li key={topic} className="flex gap-3">
                <span className="w-1.5 h-1.5 mt-2 rounded-full bg-[#1A6B4A] flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">{topic}</p>
                  <p className="text-gray-400 text-xs">{hint}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Veterineri Bul, veteriner hekimler ile hayvan sahiplerini buluşturan aracı bir platformdur.
          Doğrudan veterinerlik hizmeti sunmaz.{" "}
          <Link href="/kvkk" className="hover:underline">Gizlilik Politikası</Link>
          {" · "}
          <Link href="/kullanim-kosullari" className="hover:underline">Kullanım Koşulları</Link>
        </p>
      </main>
    </div>
  );
}
