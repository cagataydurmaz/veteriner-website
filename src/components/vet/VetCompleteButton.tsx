"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Props {
  appointmentId: string;
  appointmentType?: "video" | "in_person";
  petName?: string;
  complaint?: string;
}

type Status = "iyi" | "orta" | "dikkat" | "";

const STATUS_OPTIONS: { value: Status; label: string; color: string; bg: string }[] = [
  { value: "iyi",    label: "İyi",                 color: "text-green-700",  bg: "bg-green-50 border-green-400" },
  { value: "orta",   label: "Orta",                color: "text-amber-700",  bg: "bg-amber-50 border-amber-400" },
  { value: "dikkat", label: "Dikkat Gerektiriyor", color: "text-red-700",    bg: "bg-red-50 border-red-400" },
];

export default function VetCompleteButton({ appointmentId, appointmentType = "video", petName, complaint }: Props) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Form state
  const [status,   setStatus]   = useState<Status>("");
  const [bulgular, setBulgular] = useState("");
  const [oneri,    setOneri]    = useState("");
  const [ilac,     setIlac]     = useState("");
  const [takipGun, setTakipGun] = useState<number | null>(null);

  const label = appointmentType === "in_person" ? "Muayene Bitti" : "Tamamla";

  const complete = async (withNotes: boolean) => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { appointmentId };

      if (withNotes && (status || bulgular || oneri)) {
        body.consultationNotes = {
          genel_durum: status || "belirtilmedi",
          bulgular:    bulgular.trim() || null,
          oneri:       oneri.trim()    || null,
          ilac_notu:   ilac.trim()     || null,
          takip_gunu:  takipGun,
        };
      }

      const res  = await fetch("/api/appointments/complete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tamamlanamadı");

      toast.success(data.message || "Randevu tamamlandı");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <Button
        size="sm"
        className="bg-green-600 hover:bg-green-700 text-white"
        onClick={() => setOpen(true)}
      >
        <Check className="w-3.5 h-3.5 mr-1" /> {label}
      </Button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900">🏁 Görüşme Özeti</p>
                {petName && <p className="text-xs text-gray-500 mt-0.5">{petName} için muayene notu</p>}
              </div>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Complaint (pre-filled, read-only) */}
              {complaint && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Hasta Şikayeti</p>
                  <p className="text-sm text-gray-700">{complaint}</p>
                </div>
              )}

              {/* Genel Durum */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Hayvanın Genel Durumu</p>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        status === opt.value ? `${opt.bg} ${opt.color}` : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulgular */}
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-1.5">
                  Bulgular <span className="text-gray-400 font-normal">(muayenede ne gördünüz?)</span>
                </label>
                <textarea
                  value={bulgular}
                  onChange={e => setBulgular(e.target.value)}
                  rows={3}
                  placeholder="Ör: Karın bölgesinde hassasiyet, hafif ateş (39.2°C), refleksler normal..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400/30"
                />
              </div>

              {/* Öneri */}
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-1.5">
                  Öneri & Tedavi Planı
                </label>
                <textarea
                  value={oneri}
                  onChange={e => setOneri(e.target.value)}
                  rows={3}
                  placeholder="Ör: 3 gün düşük lifli diyet önerildi, bol su, hareket kısıtlaması..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400/30"
                />
              </div>

              {/* İlaç Notu */}
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-1.5">
                  İlaç Önerisi <span className="text-gray-400 font-normal">(opsiyonel)</span>
                </label>
                <textarea
                  value={ilac}
                  onChange={e => setIlac(e.target.value)}
                  rows={2}
                  placeholder="Ör: Metronidazol 250mg — 1x1 — 5 gün (veteriner onaylı reçete ile alınacak)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400/30"
                />
              </div>

              {/* Takip Randevusu */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Takip Randevusu</p>
                <div className="flex flex-wrap gap-2">
                  {[null, 3, 7, 14, 30].map(day => (
                    <button
                      key={day ?? "none"}
                      onClick={() => setTakipGun(day)}
                      className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                        takipGun === day
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {day === null ? "Gerek Yok" : `${day} Gün`}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
                Bu notlar hasta sahibine özet email olarak gönderilecek ve pet profilinde saklanacaktır.
                Tıbbi belge niteliği taşımaz.
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  onClick={() => complete(true)}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <><Check className="w-4 h-4 mr-2" /> Özeti Kaydet ve Tamamla</>
                  )}
                </Button>
                <button
                  onClick={() => complete(false)}
                  disabled={loading}
                  className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors"
                >
                  Atla — Sadece Tamamla <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
