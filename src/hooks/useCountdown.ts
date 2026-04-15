"use client";
import { useState, useEffect } from "react";

export function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!targetIso) { setRemaining(0); return; }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetIso]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return {
    remaining,
    label: `${mins} dakika ${String(secs).padStart(2, "0")} saniye`,
  };
}
