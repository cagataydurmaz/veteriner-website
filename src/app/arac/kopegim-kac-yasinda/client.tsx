"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const BREEDS = [
  { value: "small", label: "Küçük Irk (< 10 kg)", desc: "Chihuahua, Yorkshire, Maltese..." },
  { value: "medium", label: "Orta Irk (10-25 kg)", desc: "Beagle, Bulldog, Labrador..." },
  { value: "large", label: "Büyük Irk (25-45 kg)", desc: "Golden Retriever, Husky..." },
  { value: "giant", label: "Dev Irk (> 45 kg)", desc: "Great Dane, Mastiff, Bernese..." },
];

// Human-equivalent age table based on size and age
// [size][dogAge] = humanAge
const AGE_TABLE: Record<string, number[]> = {
  small:  [0,15,24,28,32,36,40,44,48,52,56,60,64,68,72,76,80,84,88,92,96],
  medium: [0,15,24,28,32,36,40,44,48,52,56,60,64,68,72,76,80,84,88,92,96],
  large:  [0,15,24,28,32,36,42,47,51,56,60,64,69,72,77,81,85,89,93,97,100],
  giant:  [0,15,22,31,38,45,49,56,64,71,79,86,93,100,107,114,121,128,135,142,149],
};

const LIFE_STAGE: Record<string, { label: string; emoji: string; desc: string }> = {
  small:  { label: "Uzun Yaşamlı",  emoji: "🎉", desc: "Küçük ırklar genellikle 12-16 yıl yaşar." },
  medium: { label: "Orta Yaşamlı",  emoji: "🐕", desc: "Orta ırklar genellikle 10-14 yıl yaşar." },
  large:  { label: "Aktif Hayat",   emoji: "💪", desc: "Büyük ırklar genellikle 9-12 yıl yaşar." },
  giant:  { label: "Dev Kalp",      emoji: "❤️", desc: "Dev ırklar genellikle 7-10 yıl yaşar." },
};

export default function KopegimKacYasindaClient() {
  const [size, setSize] = useState<string | null>(null);
  const [dogAge, setDogAge] = useState<number>(3);
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    if (!size) return;
    const table = AGE_TABLE[size];
    const idx = Math.min(dogAge, table.length - 1);
    setResult(table[idx]);
  };

  const stage = size ? LIFE_STAGE[size] : null;

  return (
    <div className="min-h-screen bg-[#F0FDF4]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <p className="font-semibold text-sm text-gray-900">Köpeğim Kaç Yaşında?</p>
            <p className="text-xs text-gray-500">İnsan yaşı karşılığı</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <div className="bg-white rounded-2xl p-6 border border-[#DCFCE7]">
          <h1 className="text-xl font-bold text-gray-900 mb-5">Köpeğimin İnsan Yaşı Kaç?</h1>

          <div className="space-y-5">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Irk Büyüklüğü</Label>
              <div className="space-y-2">
                {BREEDS.map((b) => (
                  <button key={b.value} onClick={() => { setSize(b.value); setResult(null); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${size === b.value ? "border-[#166534] bg-[#F0FDF4]" : "border-gray-200 hover:border-gray-300"}`}>
                    <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${size === b.value ? "border-[#166534] bg-[#166534]" : "border-gray-300"}`} />
                    <div>
                      <p className="font-medium text-sm text-gray-900">{b.label}</p>
                      <p className="text-xs text-gray-500">{b.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Köpeğinizin Yaşı: <span className="text-[#166534] font-bold">{dogAge} yaş</span>
              </Label>
              <input
                type="range"
                min={1} max={20} value={dogAge}
                onChange={(e) => { setDogAge(Number(e.target.value)); setResult(null); }}
                className="w-full accent-[#166534]"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 yaş</span><span>10 yaş</span><span>20 yaş</span>
              </div>
            </div>

            <Button onClick={calculate} disabled={!size} className="w-full bg-[#F97316] hover:bg-[#EA6A0A] text-white">
              Hesapla <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {result !== null && stage && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-[#DCFCE7] text-center">
              <div className="text-5xl mb-3">{stage.emoji}</div>
              <p className="text-gray-500 text-sm mb-1">Köpeğinizin insan yaşı karşılığı:</p>
              <p className="text-5xl font-bold text-[#166534] mb-2">{result}</p>
              <p className="text-gray-500 text-sm">insan yaşına eşdeğer</p>
              <div className="mt-4 bg-[#F0FDF4] rounded-xl p-3">
                <p className="text-sm font-semibold text-[#166534]">{stage.label}</p>
                <p className="text-xs text-gray-600 mt-1">{stage.desc}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-[#DCFCE7]">
              <p className="text-sm text-gray-700 font-medium mb-1">
                {dogAge >= 7 ? "🐾 Yaşlı köpeğiniz için veteriner kontrolü önemlidir!" : "🐾 Düzenli sağlık kontrolleri öneririz."}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                {dogAge >= 7
                  ? "Yaşlı köpekler yılda 2 kez sağlık kontrolünden geçirilmelidir."
                  : "Genç ve orta yaşlı köpekler yılda 1 kez kontrol gerektirir."}
              </p>
              <Link href="/auth/register">
                <Button className="w-full bg-[#166534] hover:bg-[#14532D] text-white">
                  Veterineri Bul ve Randevu Al <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
