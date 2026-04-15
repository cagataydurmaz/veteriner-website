"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const NOTIFIABLE_DISEASES = [
  { keyword: "kuduz", label: "Kuduz" },
  { keyword: "şap", label: "Şap" },
  { keyword: "brucella", label: "Brucella" },
  { keyword: "brusella", label: "Bruselloz" },
  { keyword: "tüberküloz", label: "Tüberküloz" },
  { keyword: "tuberculoz", label: "Tüberküloz" },
  { keyword: "şarbon", label: "Şarbon" },
  { keyword: "antraks", label: "Anthrax/Şarbon" },
  { keyword: "newcastle", label: "Newcastle" },
  { keyword: "influenza", label: "Influenza" },
  { keyword: "african swine", label: "Afrika Domuz Vebası" },
];

interface DiagnosisNotesProps {
  appointmentId: string;
}

export default function DiagnosisNotes({ appointmentId }: DiagnosisNotesProps) {
  const [notes, setNotes] = useState("");
  const [detectedDiseases, setDetectedDiseases] = useState<string[]>([]);
  const [reminderLogged, setReminderLogged] = useState(false);
  const loggedRef = useRef(false);

  useEffect(() => {
    const lower = notes.toLowerCase();
    const found = NOTIFIABLE_DISEASES
      .filter((d) => lower.includes(d.keyword))
      .map((d) => d.label);
    const unique = [...new Set(found)];
    setDetectedDiseases(unique);

    if (unique.length > 0 && !loggedRef.current) {
      loggedRef.current = true;
      setReminderLogged(true);
      fetch("/api/vet/disease-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, keywords: unique }),
      }).catch(() => null);
    }
  }, [notes, appointmentId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(notes);
    toast.success("Not kopyalandı");
  };

  return (
    <div className="space-y-3">
      <textarea
        className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#166534] min-h-[100px]"
        placeholder="Tanı notlarınızı buraya girin..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {detectedDiseases.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-amber-800 text-sm mb-1">İhbar Zorunluluğu Uyarısı</p>
              <p className="text-xs text-amber-700 leading-relaxed mb-2">
                Notlarınızda tespit edilen hastalık(lar):{" "}
                <strong>{detectedDiseases.join(", ")}</strong>
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                ⚠️ Bu hastalık(lar) 5996 sayılı Kanun kapsamında Tarım ve Orman Bakanlığı&apos;na
                ihbar zorunluluğu gerektirebilir. Lütfen ilgili mevzuatı kontrol ediniz ve
                gerekirse yetkili mercilere bildirimde bulununuz.
              </p>
              {reminderLogged && (
                <p className="text-xs text-amber-500 mt-2">✓ Bu uyarı kayıt altına alındı.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Notu kopyala
        </button>
      )}
    </div>
  );
}
