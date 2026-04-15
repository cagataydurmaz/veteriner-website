"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const INACTIVITY_MS = 30 * 60 * 1000; // 30 dakika

/** sessionStorage key used to redirect the user back after re-login */
export const RETURN_PATH_KEY = "_return_after_login";

/**
 * Saves the current URL so the login page can restore it after authentication.
 * Called automatically before inactivity logout, but can also be used manually.
 */
export function saveReturnPath(path?: string) {
  try {
    const target = path ?? (window.location.pathname + window.location.search);
    sessionStorage.setItem(RETURN_PATH_KEY, target);
  } catch { /* sessionStorage unavailable */ }
}

/** Reads and clears the saved return path (one-time use). */
export function consumeReturnPath(): string | null {
  try {
    const val = sessionStorage.getItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(RETURN_PATH_KEY);
    return val;
  } catch {
    return null;
  }
}

export function useInactivityLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const logout = async () => {
      // Persist current path so user is returned here after re-login
      saveReturnPath();

      await supabase.auth.signOut();

      toast.warning("Oturumunuz sona erdi, lütfen tekrar giriş yapın", {
        description: "30 dakika hareketsizlik nedeniyle otomatik çıkış yapıldı.",
        duration: 6000,
      });

      window.location.href = "/auth/login?reason=inactivity";
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logout, INACTIVITY_MS);
    };

    const events: string[] = [
      "mousemove", "mousedown", "keydown",
      "touchstart", "scroll", "click", "focus",
    ];

    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // başlangıçta zamanlayıcıyı başlat

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, []);
}
