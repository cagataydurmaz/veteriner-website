"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "_scroll_pos";

function loadPositions(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function savePosition(path: string, y: number) {
  try {
    const map = loadPositions();
    map[path] = y;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // sessionStorage unavailable — ignore silently
  }
}

/**
 * Saves the scroll position for the current route in sessionStorage
 * and restores it when the user navigates back to the same route.
 *
 * Usage: call this hook once inside any list/search page component.
 */
export function useScrollRestoration() {
  const pathname = usePathname();

  // Restore saved position whenever the path mounts
  useEffect(() => {
    const saved = loadPositions()[pathname];
    if (saved !== undefined && saved > 0) {
      // Defer to ensure the DOM has fully rendered
      requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: "instant" }));
    }
  }, [pathname]);

  // Persist current scroll position as the user scrolls
  useEffect(() => {
    let raf: number;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => savePosition(pathname, window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);
}
