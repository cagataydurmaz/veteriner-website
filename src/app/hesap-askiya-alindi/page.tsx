import Link from "next/link";
import { AlertTriangle, Ban, Calendar, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  searchParams: Promise<{ reason?: string; until?: string }>;
}

export default async function VetSuspendedPage({ searchParams }: Props) {
  const { reason, until } = await searchParams;
  const isBanned = reason === "banned";

  const untilDate = until
    ? new Date(until).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
        <div className={`p-6 text-center ${isBanned ? "bg-red-600" : "bg-amber-500"}`}>
          {isBanned ? (
            <Ban className="w-12 h-12 text-white mx-auto mb-3" />
          ) : (
            <AlertTriangle className="w-12 h-12 text-white mx-auto mb-3" />
          )}
          <h1 className="text-xl font-black text-white mb-1">
            {isBanned ? "Hesabınız Kalıcı Olarak Kapatıldı" : "Hesabınız Geçici Olarak Askıya Alındı"}
          </h1>
          {!isBanned && untilDate && (
            <p className="text-white/90 text-sm">{untilDate} tarihine kadar</p>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-2">
            {isBanned ? (
              <>
                <p>Hesabınız platform kurallarını ihlal ettiğiniz için <strong>kalıcı olarak kapatılmıştır</strong>.</p>
                <p className="text-gray-500 text-xs">
                  Platform kurallarının tekrarlayan ihlali nedeniyle hesabınız kalıcı olarak kapatılmıştır.
                  Daha fazla bilgi için destek ekibimizle iletişime geçebilirsiniz.
                </p>
              </>
            ) : (
              <>
                <p>Hesabınız platform kurallarını ihlal ettiğiniz için <strong>geçici olarak askıya alınmıştır</strong>.</p>
                <p className="text-gray-500 text-xs">
                  Platform kuralları ihlali nedeniyle hesabınız askıya alınmıştır.
                  Askı süresi dolduğunda hesabınıza tekrar erişebilirsiniz.
                </p>
                {untilDate && (
                  <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-medium">Erişim tarihi: {untilDate}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-800 mb-2">Platform Kuralları Hatırlatıcısı:</p>
            <ul className="text-xs text-red-700 space-y-1">
              <li>• Platform dışında iletişim ve anlaşma yapılması yasaktır</li>
              <li>• Diğer kullanıcılara kötü muamele kabul edilmez</li>
              <li>• Doğruluk ilkesine aykırı davranışlar yasaktır</li>
              <li>• Tüm işlemler platform üzerinden gerçekleştirilmelidir</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <a href="mailto:destek@veterineribul.com">
              <Button variant="outline" className="w-full">
                <Mail className="w-4 h-4 mr-2" />
                Destek ile İletişime Geç
              </Button>
            </a>
            <Link href="/">
              <Button variant="ghost" className="w-full text-gray-500">
                Ana Sayfaya Dön
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
