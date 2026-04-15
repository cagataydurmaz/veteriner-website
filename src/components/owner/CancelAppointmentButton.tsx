"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  appointmentId: string;
  appointmentType: "video" | "in_person";
  paymentStatus: string;
  datetime: string; // ISO string
}

export default function CancelAppointmentButton({ appointmentId, appointmentType, paymentStatus, datetime }: Props) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();

  const isVideo = appointmentType === "video";
  const hasPendingPayment = paymentStatus === "held";
  const hoursUntil = (new Date(datetime).getTime() - Date.now()) / 3_600_000;
  const isLateCancel = hoursUntil < 24 && hoursUntil > 0;

  const cancel = async () => {
    setLoading(true);
    try {
      // Use server-side API route for all cancellations — avoids RLS trigger issues
      // and handles refunds for video appointments automatically.
      const res = await fetch("/api/owner/cancel-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İptal başarısız");
      toast.success(data.message || "Randevu iptal edildi");
      router.push("/owner/appointments");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "İptal edilemedi");
    } finally {
      setLoading(false);
    }
  };

  if (!confirm) {
    return (
      <Button
        data-testid="cancel-appointment-trigger"
        variant="outline"
        className="w-full text-red-600 border-red-200 hover:bg-red-50"
        onClick={() => setConfirm(true)}
      >
        <X className="w-4 h-4 mr-2" /> Randevuyu İptal Et
      </Button>
    );
  }

  return (
    <div data-testid="cancel-confirm-panel" className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
      <p className="text-sm text-red-800 font-medium">Randevuyu iptal etmek istediğinizden emin misiniz?</p>

      {isVideo && hasPendingPayment && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            {isLateCancel
              ? "Görüşmeye 24 saatten az kaldığı için %50 iade yapılacak."
              : "Ödemenizin tamamı iade edilecek."}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          data-testid="cancel-appointment-confirm"
          size="sm"
          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          onClick={cancel}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Evet, İptal Et"}
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirm(false)}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}
