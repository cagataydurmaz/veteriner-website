"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, PawPrint,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-reload when connection is restored
      setTimeout(() => window.location.replace("/"), 800);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className={`w-24 h-24 rounded-3xl flex items-center justify-center transition-colors duration-500 ${
              isOnline ? "bg-green-100" : "bg-gray-100"
            }`}
          >
            {isOnline ? (
              <RefreshCw className="w-12 h-12 text-green-500 animate-spin" />
            ) : (
              <WifiOff className="w-12 h-12 text-gray-400" />
            )}
          </div>
        </div>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <PawPrint size={28} color="#1A6B4A" />
          <span className="font-black text-gray-900 text-lg">Veterineri Bul</span>
        </div>

        {/* Message */}
        {isOnline ? (
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-green-700">Bağlantı Sağlandı!</h1>
            <p className="text-sm text-gray-500">Ana sayfaya yönlendiriliyorsunuz…</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-gray-900">İnternet Bağlantınız Yok</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Bağlantı sağlandığında otomatik olarak yenilenecektir.
              Lütfen Wi-Fi veya mobil verinizi kontrol edin.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => window.location.reload()}
            className="w-full bg-[#166534] hover:bg-[#14532D] text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Tekrar Dene
          </Button>
          <Link href="/">
            <Button variant="outline" className="w-full">
              Ana Sayfaya Dön
            </Button>
          </Link>
        </div>

        {/* Hint */}
        <p className="text-xs text-gray-400">
          Daha önce ziyaret ettiğiniz sayfalar çevrimdışı görüntülenebilir.
        </p>
      </div>
    </div>
  );
}
