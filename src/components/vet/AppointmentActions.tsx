"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  appointmentId: string;
}

export default function AppointmentActions({ appointmentId }: Props) {
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null);
  const router = useRouter();

  const act = async (action: "confirm" | "cancel") => {
    setLoading(action);
    try {
      if (action === "confirm") {
        // Use secure API route — verifies vet ownership server-side
        const res = await fetch("/api/vet/confirm-appointment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Randevu onaylanamadı");
        toast.success("Randevu onaylandı");
      } else {
        // Cancel without reason from quick-action button
        const res = await fetch("/api/vet/cancel-appointment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Randevu iptal edilemedi");
        toast.success("Randevu reddedildi");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-1.5 shrink-0" onClick={(e) => e.preventDefault()}>
      <button
        data-testid="btn-confirm-apt"
        onClick={() => act("confirm")}
        disabled={loading !== null}
        title="Onayla"
        aria-label="Randevuyu onayla"
        className="w-7 h-7 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
      >
        {loading === "confirm" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
      </button>
      <button
        data-testid="btn-cancel-apt"
        onClick={() => act("cancel")}
        disabled={loading !== null}
        title="Reddet"
        aria-label="Randevuyu reddet"
        className="w-7 h-7 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
      >
        {loading === "cancel" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <X className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
