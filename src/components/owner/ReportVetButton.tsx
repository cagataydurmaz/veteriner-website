"use client";

import { useState } from "react";
import { Flag, Loader2, X, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const REASONS = [
  { value: "platform_disina_yonlendirdi", label: "Platform dışına yönlendirdi" },
  { value: "iletisim_bilgisi_paylasti", label: "İletişim bilgisi paylaştı" },
  { value: "uygunsuz_davranis", label: "Uygunsuz davranış" },
  { value: "diger", label: "Diğer" },
];

interface Props {
  vetId: string;
  appointmentId?: string;
}

export default function ReportVetButton({ vetId, appointmentId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!reason) { toast.error("Lütfen bir neden seçin"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vetId, appointmentId, reason, details }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubmitted(true);
      toast.success(data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rapor gönderilemedi");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        <Flag className="w-3.5 h-3.5" />
        Kural İhlali Bildir
      </button>
    );
  }

  return (
    <div className="bg-white border border-red-200 rounded-2xl p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-red-500" />
          <p className="font-semibold text-gray-900 text-sm">Kural İhlali Bildir</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {submitted ? (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl px-4 py-3">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Raporunuz alındı. İncelendikten sonra gerekli işlem yapılacaktır.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">İhlal türünü seçin:</p>
            {REASONS.map(r => (
              <label key={r.value} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="w-4 h-4 text-red-500 border-gray-300 focus:ring-red-400"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{r.label}</span>
              </label>
            ))}
          </div>

          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Açıklama (isteğe bağlı):</p>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Yaşanan durumu kısaca açıklayın…"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm"
              onClick={submit}
              disabled={loading || !reason}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Raporu Gönder"}
            </Button>
            <Button variant="outline" className="flex-1 text-sm" onClick={() => setOpen(false)}>
              İptal
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
