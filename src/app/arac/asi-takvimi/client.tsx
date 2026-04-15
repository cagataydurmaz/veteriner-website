"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const DOG_VACCINES = [
  { name: "İlk Karma Aşı (DHPPi)", weeksFromBirth: 6, notes: "Distemper, Hepatit, Parvovirüs, Parainfluenza" },
  { name: "2. Karma Aşı", weeksFromBirth: 9, notes: "Booster" },
  { name: "3. Karma Aşı + Kuduz", weeksFromBirth: 12, notes: "Yıllık tekrar gerekli" },
  { name: "4. Karma Aşı (opsiyonel)", weeksFromBirth: 16, notes: "Yüksek riskli bölgeler için" },
  { name: "Yıllık Hatırlatma", weeksFromBirth: 52, notes: "Her yıl tekrar" },
  { name: "Leptospiroz", weeksFromBirth: 12, notes: "2 doz, 2-4 hafta arayla" },
  { name: "Kennel Cough (Kennel Öksürüğü)", weeksFromBirth: 8, notes: "Toplu yaşam alanlarında önerilir" },
];

const CAT_VACCINES = [
  { name: "İlk Karma Aşı (FVRCP)", weeksFromBirth: 8, notes: "Herpes, Calici, Panleukopeni" },
  { name: "2. Karma Aşı", weeksFromBirth: 12, notes: "Booster" },
  { name: "Kuduz Aşısı", weeksFromBirth: 12, notes: "Yasal zorunluluk" },
  { name: "3. Karma Aşı (opsiyonel)", weeksFromBirth: 16, notes: "Dış mekân kediler için" },
  { name: "FeLV (Lösemi)", weeksFromBirth: 9, notes: "Dış mekân kediler için önerilir" },
  { name: "Yıllık Hatırlatma", weeksFromBirth: 52, notes: "Her yıl tekrar" },
];

export default function AsiTakvimiClient() {
  const [petType, setPetType] = useState<"dog" | "cat" | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [schedule, setSchedule] = useState<{ name: string; date: Date; notes: string; overdue: boolean }[] | null>(null);

  const calculate = () => {
    if (!petType || !birthDate) return;
    const birth = new Date(birthDate);
    const vaccines = petType === "dog" ? DOG_VACCINES : CAT_VACCINES;
    const today = new Date();

    const result = vaccines.map((v) => {
      const date = new Date(birth);
      date.setDate(date.getDate() + v.weeksFromBirth * 7);
      return { name: v.name, date, notes: v.notes, overdue: date < today };
    });

    setSchedule(result.sort((a, b) => a.date.getTime() - b.date.getTime()));
  };

  const fmt = (d: Date) =>
    d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#F0FDF4]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <p className="font-semibold text-sm text-gray-900">Aşı Takvimi Hesaplayıcı</p>
            <p className="text-xs text-gray-500">Köpek ve kedi aşı programı</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <div className="bg-white rounded-2xl p-6 border border-[#DCFCE7]">
          <h1 className="text-xl font-bold text-gray-900 mb-5">Aşı Takvimi Hesapla</h1>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Hayvan Türü</Label>
              <div className="grid grid-cols-2 gap-3">
                {[{ v: "dog" as const, emoji: "🐕", label: "Köpek" }, { v: "cat" as const, emoji: "🐈", label: "Kedi" }].map((opt) => (
                  <button key={opt.v} onClick={() => setPetType(opt.v)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${petType === opt.v ? "border-[#166534] bg-[#F0FDF4]" : "border-gray-200 hover:border-[#166534]"}`}>
                    <span className="text-3xl">{opt.emoji}</span>
                    <span className="font-medium text-gray-800">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="birthdate" className="text-sm font-medium text-gray-700 mb-1 block">Doğum Tarihi</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="birthdate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
            </div>

            <Button onClick={calculate} disabled={!petType || !birthDate} className="w-full bg-[#F97316] hover:bg-[#EA6A0A] text-white">
              Takvimi Hesapla <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {schedule && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Aşı Programı</h2>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1 text-red-600"><AlertCircle className="w-3.5 h-3.5" />Gecikmiş</span>
                <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3.5 h-3.5" />Bekliyor</span>
              </div>
            </div>

            {schedule.map((v, i) => (
              <div key={i} className={`bg-white rounded-xl p-4 border ${v.overdue ? "border-red-200" : "border-[#DCFCE7]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {v.overdue
                        ? <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        : <CheckCircle className="w-4 h-4 text-[#166534] shrink-0" />}
                      <p className="font-medium text-sm text-gray-900">{v.name}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-6">{v.notes}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold ${v.overdue ? "text-red-600" : "text-[#166534]"}`}>{fmt(v.date)}</p>
                    {v.overdue && <p className="text-xs text-red-500">GECİKMİŞ</p>}
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-2xl p-5 border border-[#DCFCE7]">
              <p className="text-sm text-gray-600 mb-3">
                {schedule.some((v) => v.overdue) ? "Gecikmiş aşılar için " : "Aşı randevusu almak için "}
                yakınınızdaki veterineri bulun:
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
