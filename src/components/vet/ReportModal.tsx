"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle } from "lucide-react";

const REASONS = [
  "Kullanıcı gelmedi",
  "Kötü davranış",
  "Ödeme sorunu",
  "Diğer",
];

interface Props {
  appointmentId: string;
  appointmentStatus: string;
}

export default function ReportModal({ appointmentId, appointmentStatus }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Only show for completed or cancelled
  if (!["completed", "cancelled"].includes(appointmentStatus)) return null;

  const handleSubmit = async () => {
    if (!reason) { toast.error("Lütfen bir neden seçin"); return; }
    if (description.length < 20) { toast.error("Açıklama en az 20 karakter olmalıdır"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/complaints/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointmentId, reason, description, reporter_type: "vet" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setSubmitted(true);
          setOpen(false);
          toast.info("Bu randevu için zaten bir sorun bildirdiniz");
          return;
        }
        throw new Error(data.error || "Hata oluştu");
      }
      setSubmitted(true);
      setOpen(false);
      toast.success("Sorun bildiriminiz alındı, 48 saat içinde incelenecek");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <CheckCircle className="w-4 h-4 shrink-0" />
        Sorun bildiriminiz alındı, 48 saat içinde incelenecek
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1.5 transition-colors"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Sorun Bildir
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Sorun Bildir
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              Bildiriminiz incelenerek 48 saat içinde sonuçlandırılacaktır.
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Neden</label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Neden seçin...</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Açıklama <span className="text-gray-400 font-normal">(en az 20 karakter)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="Yaşadığınız sorunu detaylı açıklayın..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-base resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-xs text-gray-400 text-right">{description.length} / min. 20</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !reason || description.length < 20}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {loading ? "Gönderiliyor..." : "Bildirimi Gönder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
