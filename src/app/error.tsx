"use client";

import { useEffect } from "react";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="tr">
      <body>
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <p className="text-7xl font-black text-red-200 leading-none mb-2">500</p>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Bir Sorun Oluştu
            </h1>
            <p className="text-gray-500 mb-2 leading-relaxed">
              Sunucuda beklenmeyen bir hata meydana geldi.
              Özür dileriz, lütfen tekrar deneyin.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 mb-6 font-mono">
                Hata kodu: {error.digest}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Tekrar Dene
              </button>
              {/* Native <a> required — this is the global error boundary which renders
                  outside the Next.js App Router context; next/link won't work here */}
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                <Home className="w-4 h-4" />
                Ana Sayfaya Dön
              </a>
            </div>

            <p className="mt-8 text-xs text-gray-400">
              Sorun devam ederse{" "}
              <a href="mailto:destek@veterineribul.com" className="text-[#166534] hover:underline">
                destek@veterineribul.com
              </a>{" "}
              adresine yazın.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
