"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
  };

  const minimal = () => {
    localStorage.setItem("cookie_consent", "minimal");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 mb-1">🍪 Çerez Bildirimi</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            Platformun çalışması için zorunlu çerezler kullanılmaktadır. Deneyimi iyileştirmek
            için analitik çerezler kullanmak istiyoruz.{" "}
            <Link href="/kvkk/hayvan-sahibi" className="text-[#166534] hover:underline font-medium">
              KVKK Aydınlatma Metni
            </Link>{" "}
            ve{" "}
            <Link href="/kvkk/cerez-politikasi" className="text-[#166534] hover:underline font-medium">
              Çerez Politikası
            </Link>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={minimal}
            className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Sadece Zorunlu
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-xs font-medium text-white bg-[#166534] rounded-lg hover:bg-[#14532D] transition-colors"
          >
            Tümünü Kabul Et
          </button>
        </div>
      </div>
    </div>
  );
}
