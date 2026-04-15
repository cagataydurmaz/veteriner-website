"use client";

import { useState } from "react";
import { Star, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  appointmentId: string;
  vetId: string;
  existingRating?: number;
  existingComment?: string;
}

export default function RateVetButton({ appointmentId, vetId, existingRating, existingComment }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existingRating || 0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(existingComment || "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!!existingRating);

  const submit = async () => {
    if (!rating) { toast.error("Lütfen bir puan seçin"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, vetId, rating, comment: comment.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Değerlendirme gönderilemedi"); return; }
      toast.success("Değerlendirmeniz kaydedildi");
      setDone(true);
      setOpen(false);
    } catch { toast.error("Bir hata oluştu"); }
    finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#166534] bg-[#F0FDF4] px-3 py-2 rounded-lg">
        <Check className="w-4 h-4" />
        <span>Değerlendirdiniz</span>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map(s => (
            <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
          ))}
        </div>
        <button onClick={() => { setDone(false); setOpen(true); }} className="text-xs text-gray-400 hover:underline ml-1">Düzenle</button>
      </div>
    );
  }

  return (
    <>
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-[#166534] border-[#166534]">
          <Star className="w-4 h-4 mr-1.5" />
          Veterineri Değerlendir
        </Button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Veterineri Değerlendirin</p>
          {/* Stars */}
          <div className="flex gap-1">
            {[1,2,3,4,5].map(s => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(s)}
              >
                <Star className={`w-7 h-7 transition-colors ${s <= (hovered || rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`} />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Deneyiminizi paylaşın (opsiyonel)…"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
          />
          <div className="flex gap-2">
            <Button size="sm" className="bg-[#166534] hover:bg-[#14532D] text-white" onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gönder"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
          </div>
        </div>
      )}
    </>
  );
}
