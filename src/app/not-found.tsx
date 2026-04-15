"use client";

import Link from "next/link";
import { Home, Search, ArrowLeft, PawPrint,
} from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Logo */}
        <PawPrint size={28} color="#1A6B4A" />

        {/* 404 */}
        <p className="text-8xl font-black text-[#166534] opacity-20 leading-none mb-2">404</p>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Sayfa Bulunamadı
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Aradığınız sayfa taşınmış, silinmiş veya hiç olmamış olabilir.
          Lütfen adresi kontrol edin ya da ana sayfaya dönün.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#166534] text-white rounded-xl font-medium hover:bg-[#14532d] transition-colors"
          >
            <Home className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Geri Git
          </button>
        </div>

        {/* Helpful links */}
        <div className="mt-10 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-400 mb-4">Belki bunlara gitmek istersiniz?</p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <Link href="/auth/login" className="text-[#166534] hover:underline">Giriş Yap</Link>
            <span className="text-gray-300">·</span>
            <Link href="/auth/register" className="text-[#166534] hover:underline">Kayıt Ol</Link>
            <span className="text-gray-300">·</span>
            <Link href="/owner/dashboard" className="text-[#166534] hover:underline">Paneliniz</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
