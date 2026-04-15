"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function ProgressBarImpl() {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth]     = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // Intercept anchor clicks → start bar immediately for perceived speed
  useEffect(() => {
    const onLinkClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto") ||
        href.startsWith("tel") ||
        anchor.getAttribute("target") === "_blank" ||
        // External links
        (href.startsWith("http") && !href.startsWith(window.location.origin))
      ) return;

      clear();
      setVisible(true);
      setWidth(20);
      timers.current.push(setTimeout(() => setWidth(50), 200));
      timers.current.push(setTimeout(() => setWidth(75), 600));
    };

    document.addEventListener("click", onLinkClick);
    return () => document.removeEventListener("click", onLinkClick);
  }, []);

  // Complete bar when route change is detected
  useEffect(() => {
    clear();
    setWidth(100);
    timers.current.push(setTimeout(() => setVisible(false), 350));
    timers.current.push(setTimeout(() => setWidth(0), 400));
    return clear;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible && width === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 z-[9999] h-[3px] pointer-events-none"
      style={{
        width: `${width}%`,
        background: "linear-gradient(90deg, #166534 0%, #22c55e 100%)",
        transition:
          width === 100
            ? "width 0.2s ease-out, opacity 0.35s ease-out 0.35s"
            : "width 0.4s ease-out",
        opacity: visible ? 1 : 0,
        boxShadow: "0 0 8px rgba(34,197,94,0.6)",
      }}
    />
  );
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBarImpl />
    </Suspense>
  );
}
