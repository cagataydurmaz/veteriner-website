import Link from "next/link";
import type { Metadata } from "next";
import { ShieldOff, Home } from "lucide-react";
import BackButton from "@/components/shared/BackButton";

export const metadata: Metadata = {
  title: "Yetkisiz Erişim",
};

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-red-100 rounded-3xl flex items-center justify-center">
            <ShieldOff className="w-12 h-12 text-red-500" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-500 tracking-widest uppercase">
            403 — Yetkisiz Erişim
          </p>
          <h1 className="text-2xl font-bold text-gray-900">
            Bu sayfaya erişim yetkiniz yok
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Bu sayfayı görüntülemek için gerekli izniniz bulunmuyor.
            Yanlış bir sayfaya yönlendirildiyseniz aşağıdaki bağlantıları kullanabilirsiniz.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#166534] text-white rounded-xl font-medium text-sm hover:bg-[#14532D] transition-colors"
          >
            <Home className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>
          <BackButton className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors" />
        </div>

        {/* Help text */}
        <p className="text-xs text-gray-400">
          Sorun devam ederse{" "}
          <Link href="/iletisim" className="text-[#166534] hover:underline">
            destek ekibimizle
          </Link>{" "}
          iletişime geçin.
        </p>
      </div>
    </div>
  );
}
