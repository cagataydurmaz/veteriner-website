"use client";

import { PawPrint, Zap } from "lucide-react";

export default function HomeLogoLink() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="flex items-center gap-2.5 whitespace-nowrap cursor-pointer min-h-[44px]"
      aria-label="Sayfanın başına git"
    >
      <PawPrint size={28} color="#1A6B4A" />
      <div className="flex items-center gap-1.5">
        <span className="font-black text-[#1A6B4A] text-lg tracking-tight">Veterineri Bul</span>
        <span className="inline-flex items-center gap-0.5 bg-[#3D6B5E] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          <Zap className="w-2.5 h-2.5" /> AI
        </span>
      </div>
    </button>
  );
}
