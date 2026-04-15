"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

export default function OfflineBanner() {
  const [isOffline, setIsOffline]   = useState(false);
  const [justCameBack, setJustCameBack] = useState(false);
  const [retrying, setRetrying]     = useState(false);
  // Track whether the browser actually went offline in this session
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    // Check initial state (SSR-safe)
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      wasOfflineRef.current = true;
    }

    const handleOffline = () => {
      wasOfflineRef.current = true;
      setIsOffline(true);
      setJustCameBack(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      // Only show "reconnected" banner if we were actually offline before
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setJustCameBack(true);
        // Auto-hide "bağlantı kuruldu" after 3 seconds
        setTimeout(() => setJustCameBack(false), 3000);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const handleRetry = useCallback(() => {
    setRetrying(true);
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        setRetrying(false);
      }
    }, 1000);
  }, []);

  // Nothing to show
  if (!isOffline && !justCameBack) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl
        text-sm font-medium whitespace-nowrap
        transition-all duration-300
        ${isOffline
          ? "bg-red-600 text-white"
          : "bg-emerald-600 text-white"
        }
      `}
    >
      {isOffline ? (
        <>
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>İnternet bağlantınız kesildi</span>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="ml-1 flex items-center gap-1.5 underline text-white/80 hover:text-white disabled:opacity-60 transition-opacity"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
            Tekrar Dene
          </button>
        </>
      ) : (
        <>
          <Wifi className="w-4 h-4 shrink-0" />
          <span>Bağlantı yeniden kuruldu ✓</span>
        </>
      )}
    </div>
  );
}
