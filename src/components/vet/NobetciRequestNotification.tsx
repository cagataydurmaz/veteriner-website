"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Video, X, Clock, AlertTriangle, Check, Loader2 } from "lucide-react";

interface Request {
  id: string;
  complaint: string;
  fee: number;
  expires_at: string;
  pet?: { name: string; species: string } | null;
  owner?: { full_name: string } | null;
}

interface Props {
  vetId: string;
}

/**
 * NobetciRequestNotification
 *
 * Mounts on the vet dashboard.
 * Subscribes to instant_requests via Supabase Realtime.
 * When a new pending request arrives → shows a fullscreen alert with:
 *   - 90-second countdown
 *   - Pet info + complaint
 *   - Accept / Decline buttons
 */
export default function NobetciRequestNotification({ vetId }: Props) {
  const router              = useRouter();
  const [request, setRequest] = useState<Request | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [loading, setLoading]         = useState<"accept" | "decline" | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Start countdown when request arrives ─────────────────────────────────
  useEffect(() => {
    if (!request) {
      if (timerRef.current) clearInterval(timerRef.current);
      setSecondsLeft(90);
      return;
    }

    // Calculate real seconds from expires_at
    const expiresAt = new Date(request.expires_at).getTime();
    const updateTimer = () => {
      const diff = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        setRequest(null);
        toast.info("İstek süresi doldu. Nöbet durumunuz kapatıldı.");
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    // Play alert sound
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/alert.mp3");
        audioRef.current.volume = 0.7;
      }
      audioRef.current.play().catch(() => null);
    } catch { /* no audio permission, ignore */ }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [request]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    // Load any already-pending requests on mount (e.g. page reload during active request)
    (async () => {
      const { data } = await supabase
        .from("instant_requests")
        .select(`
          id, complaint, fee, expires_at,
          pet:pets!pet_id(name, species),
          owner:users!owner_id(full_name)
        `)
        .eq("vet_id", vetId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data) {
        const r = data as unknown as Request;
        setRequest(r);
      }
    })();

    const channel = supabase
      .channel(`nobetci-requests-vet-${vetId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "instant_requests",
          filter: `vet_id=eq.${vetId}`,
        },
        async (payload) => {
          const row = payload.new as { id: string; status: string; expires_at: string };
          if (row.status !== "pending") return;

          // Fetch full row with relations
          const { data } = await supabase
            .from("instant_requests")
            .select(`
              id, complaint, fee, expires_at,
              pet:pets!pet_id(name, species),
              owner:users!owner_id(full_name)
            `)
            .eq("id", row.id)
            .maybeSingle();

          if (data) {
            setRequest(data as unknown as Request);
          }
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [vetId]);

  // ── Accept / Decline ──────────────────────────────────────────────────────
  const respond = useCallback(async (action: "accept" | "decline") => {
    if (!request || loading) return;
    setLoading(action);

    try {
      const res  = await fetch("/api/nobetci/respond", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ requestId: request.id, action }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "İşlem başarısız");

      setRequest(null);

      if (action === "accept") {
        toast.success("İstek kabul edildi! Video odası açılıyor…");
        router.push(data.videoRoomUrl || `/video/${data.appointmentId}`);
      } else {
        toast.info("İstek reddedildi. Ödeme iade edildi.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setLoading(null);
    }
  }, [request, loading, router]);

  if (!request) return null;

  const owner = Array.isArray(request.owner) ? request.owner[0] : request.owner;
  const pet   = Array.isArray(request.pet)   ? request.pet[0]   : request.pet;

  const urgencyColor = secondsLeft <= 20
    ? "bg-red-500"
    : secondsLeft <= 45
    ? "bg-amber-500"
    : "bg-green-500";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      {/* Pulsing border animation */}
      <div className="absolute inset-0 pointer-events-none animate-pulse bg-red-500/5" />

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden">
        {/* Top urgency stripe */}
        <div className={`h-2 w-full ${urgencyColor} transition-colors duration-500`} />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-2xl animate-bounce">🚨</span>
            </div>
            <div className="flex-1">
              <p className="font-black text-gray-900 text-lg">Acil Video İsteği!</p>
              <p className="text-sm text-gray-500">{owner?.full_name || "Hasta sahibi"} bağlantı istiyor</p>
            </div>
            {/* Countdown ring */}
            <div className={`relative w-14 h-14 rounded-full flex items-center justify-center font-black text-xl text-white ${urgencyColor} transition-colors duration-500`}>
              {secondsLeft}
              <span className="absolute -bottom-0.5 -right-0.5">
                <Clock className="w-4 h-4 text-white/70" />
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-3">
          {pet && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <span className="text-xl">{pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : "🐾"}</span>
              <div>
                <p className="text-sm font-semibold text-blue-900">{pet.name}</p>
                <p className="text-xs text-blue-600 capitalize">{pet.species}</p>
              </div>
            </div>
          )}

          {request.complaint && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-0.5">Şikayet</p>
                  <p className="text-sm text-amber-900 leading-snug">{request.complaint}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <span className="text-sm text-green-700 font-medium">Görüşme Ücreti</span>
            <span className="font-black text-green-800 text-lg">₺{request.fee}</span>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Kabul etmezseniz ödeme iade edilir ve nöbet durumunuz kapanır.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={() => respond("decline")}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-gray-200 hover:border-gray-300 text-gray-700 rounded-2xl font-semibold text-sm transition-all disabled:opacity-50"
          >
            {loading === "decline" ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Reddet
          </button>

          <button
            onClick={() => respond("accept")}
            disabled={!!loading}
            className="flex-2 flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-green-200"
          >
            {loading === "accept" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <Video className="w-4 h-4" />
                Kabul Et ve Bağlan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
