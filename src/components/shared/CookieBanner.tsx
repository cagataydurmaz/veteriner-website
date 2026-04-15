"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Cookie, ToggleLeft, ToggleRight } from "lucide-react";

const STORAGE_KEY = "cookie_consent_v2";
const CONSENT_TTL_DAYS = 395;

interface ConsentData {
  decision: "accepted" | "rejected" | "custom";
  analytics: boolean;
  timestamp: number;
}

function loadConsent(): ConsentData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: ConsentData = JSON.parse(raw);
    const ageMs = Date.now() - data.timestamp;
    if (ageMs > CONSENT_TTL_DAYS * 24 * 60 * 60 * 1000) return null; // expired
    return data;
  } catch {
    return null;
  }
}

function saveConsent(data: Omit<ConsentData, "timestamp">) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...data, timestamp: Date.now() })
  );
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  useEffect(() => {
    const consent = loadConsent();
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    saveConsent({ decision: "accepted", analytics: true });
    setVisible(false);
  };

  const reject = () => {
    saveConsent({ decision: "rejected", analytics: false });
    setVisible(false);
  };

  const saveCustom = () => {
    saveConsent({ decision: "custom", analytics: analyticsEnabled });
    setShowSettings(false);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* Main banner */}
      {!showSettings && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-xl">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Cookie className="w-5 h-5 text-[#166534] shrink-0 hidden sm:block" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 mb-0.5">
                  🍪 Bu site çerezleri kullanır.
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Deneyiminizi iyileştirmek için analitik çerezler kullanıyoruz.{" "}
                  <Link
                    href="/kvkk/cerez-politikasi"
                    className="text-[#166534] hover:underline font-medium"
                  >
                    Çerez Politikası
                  </Link>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-3 py-2.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                >
                  Ayarlar
                </button>
                <button
                  onClick={reject}
                  className="px-3 py-2.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                >
                  Reddet
                </button>
                <button
                  onClick={accept}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-[#166534] rounded-lg hover:bg-[#14532D] transition-colors min-h-[44px]"
                >
                  Kabul Et
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSettings(false)}
          />

          <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl p-6">
            {/* Close */}
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              aria-label="Kapat"
            >
              <X className="w-3.5 h-3.5 text-gray-600" />
            </button>

            <h2 className="text-base font-bold text-gray-900 mb-1">Çerez Ayarları</h2>
            <p className="text-xs text-gray-500 mb-5">
              Hangi çerezlere izin vermek istediğinizi seçin.
            </p>

            {/* Zorunlu çerezler — always on */}
            <div className="flex items-start justify-between gap-4 py-4 border-t border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-900">Zorunlu Çerezler</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Oturum yönetimi ve platformun çalışması için gereklidir. Devre dışı bırakılamaz.
                </p>
              </div>
              <div className="shrink-0 mt-0.5">
                <span className="text-xs font-medium text-[#166534] bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  Her zaman açık
                </span>
              </div>
            </div>

            {/* Analitik çerezler — toggleable */}
            <div className="flex items-start justify-between gap-4 py-4 border-t border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-900">Analitik Çerezler</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Platformu nasıl kullandığınızı anlamamıza yardımcı olur. Kişisel veri içermez.
                </p>
              </div>
              <button
                onClick={() => setAnalyticsEnabled((v) => !v)}
                className="shrink-0 mt-0.5"
                aria-label={analyticsEnabled ? "Analitik çerezleri kapat" : "Analitik çerezleri aç"}
              >
                {analyticsEnabled ? (
                  <ToggleRight className="w-8 h-8 text-[#166534]" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-gray-400" />
                )}
              </button>
            </div>

            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={reject}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Tümünü Reddet
              </button>
              <button
                onClick={saveCustom}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-[#166534] rounded-xl hover:bg-[#14532D] transition-colors"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
