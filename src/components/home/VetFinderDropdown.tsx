"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, MapPin, Video, Siren } from "lucide-react";

const OPTIONS = [
  {
    href: "/veteriner-bul",
    icon: MapPin,
    emoji: "🏥",
    label: "Klinikte Muayene",
    desc: "Yakınındaki kliniği bul",
  },
  {
    href: "/online-veteriner",
    icon: Video,
    emoji: "📹",
    label: "Online Görüşme",
    desc: "Evden video görüşme",
  },
  {
    href: "/nobetci-veteriner",
    icon: Siren,
    emoji: "🚨",
    label: "Acil & Nöbetçi",
    desc: "7/24 acil veteriner bul",
  },
];

export default function VetFinderDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
          open
            ? "bg-[#EEF5F2] text-[#1A6B4A]"
            : "text-[#4A5C52] hover:bg-[#EEF5F2] hover:text-[#1A6B4A]"
        }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Veterineri Bul
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#D4E0D8] overflow-hidden z-50">
          {OPTIONS.map((opt) => (
            <Link
              key={opt.href}
              href={opt.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#F0FDF4] transition-colors group"
            >
              <span className="text-xl leading-none">{opt.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-[#2C3A32] group-hover:text-[#1A6B4A] transition-colors">
                  {opt.label}
                </p>
                <p className="text-xs text-[#7A8F85]">{opt.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
