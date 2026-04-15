"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  MessageSquare, Users, Shield, Loader2, PawPrint,
  AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import type AgoraRTC from "agora-rtc-sdk-ng";

type IAgoraRTCClient   = import("agora-rtc-sdk-ng").IAgoraRTCClient;
type ILocalVideoTrack  = import("agora-rtc-sdk-ng").ILocalVideoTrack;
type ILocalAudioTrack  = import("agora-rtc-sdk-ng").ILocalAudioTrack;
type IRemoteVideoTrack = import("agora-rtc-sdk-ng").IRemoteVideoTrack;
type IRemoteAudioTrack = import("agora-rtc-sdk-ng").IRemoteAudioTrack;

const SESSION_SECONDS   = 30 * 60; // 30 dakika
const WARN_AT_SECONDS   = 5  * 60; // 5 dk kala uyarı
const GRACE_SECONDS     = 3  * 60; // 3 dk kopukluk grace period

export default function VideoRoomPage() {
  const params        = useParams();
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const roomId        = params.roomId as string;
  const appointmentId = searchParams.get("appointment");
  const supabase      = useMemo(() => createClient(), []);

  const [joined,       setJoined]       = useState(false);
  const [micOn,        setMicOn]        = useState(true);
  const [camOn,        setCamOn]        = useState(true);
  const [elapsed,      setElapsed]      = useState(0);      // total elapsed seconds since join
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [remoteUsers,  setRemoteUsers]  = useState<string[]>([]);
  const [prescriptionAcknowledged, setPrescriptionAcknowledged] = useState(false);

  // Session state
  const [sessionEnded, setSessionEnded] = useState(false);
  const [completing,   setCompleting]   = useState(false);
  const [role,         setRole]         = useState<"vet" | "owner" | null>(null);

  // Mid-session disconnect
  const [disconnectGrace, setDisconnectGrace] = useState<number | null>(null); // seconds left in grace
  const [showRefundBanner, setShowRefundBanner] = useState(false);
  const [refundLoading,    setRefundLoading]    = useState(false);
  const [refundDone,       setRefundDone]       = useState(false);

  const clientRef         = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef     = useRef<ILocalVideoTrack | null>(null);
  const localAudioRef     = useRef<ILocalAudioTrack | null>(null);
  const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRefreshRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVideoElRef   = useRef<HTMLDivElement>(null);
  const remoteVideoElRef  = useRef<HTMLDivElement>(null);
  const sessionEndedRef   = useRef(false);

  // ── Fetch role on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!appointmentId) return;
    (async () => {
      try {
        const res = await fetch(`/api/video/agora-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelName: roomId, uid: 0 }),
        });
        const data = await res.json();
        if (data.role) setRole(data.role as "vet" | "owner");
      } catch { /* role stays null */ }
    })();
  }, [appointmentId, roomId]);

  // ── Elapsed timer + session end ───────────────────────────────────────────
  useEffect(() => {
    if (joined && !sessionEnded) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next >= SESSION_SECONDS && !sessionEndedRef.current) {
            sessionEndedRef.current = true;
            setSessionEnded(true);
          }
          return next;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [joined, sessionEnded]);

  // ── Auto-complete when session ends (vet only) ────────────────────────────
  useEffect(() => {
    if (sessionEnded && role === "vet" && !completing) {
      markComplete();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEnded, role]);

  // ── Realtime: detect remote completion (owner side) ───────────────────────
  // When the vet marks the appointment completed from ConsultationClient or
  // any other path, the appointment row gets status=completed.
  // The owner's browser picks this up instantly and redirects to their
  // appointments page — no manual refresh needed.
  useEffect(() => {
    if (!appointmentId) return;

    const channel = supabase
      .channel(`video-apt-status-${appointmentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${appointmentId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status;
          if (newStatus === "completed" && !sessionEndedRef.current) {
            sessionEndedRef.current = true;
            setSessionEnded(true);
            // Owner: redirect to appointment detail after short delay
            // Vet on this page: just show the completed banner
            if (role === "owner") {
              setTimeout(() => {
                router.push(`/owner/appointments/${appointmentId}`);
              }, 2500);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appointmentId, role, router, supabase]);

  // ── Token renewal ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!joined) return;
    const delay = (3600 - 600) * 1000;
    tokenRefreshRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/video/agora-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelName: roomId, uid: 0 }),
        });
        const { token, error: tokenError } = await res.json();
        if (tokenError || !token) return;
        if (clientRef.current) await clientRef.current.renewToken(token);
      } catch { console.warn("[video] token renewal failed"); }
    }, delay);
    return () => { if (tokenRefreshRef.current) clearTimeout(tokenRefreshRef.current); };
  }, [joined, roomId]);

  // ── Grace period countdown ────────────────────────────────────────────────
  const startGrace = useCallback(() => {
    if (graceIntervalRef.current) return; // already running
    setDisconnectGrace(GRACE_SECONDS);
    graceIntervalRef.current = setInterval(() => {
      setDisconnectGrace(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(graceIntervalRef.current!);
          graceIntervalRef.current = null;
          setShowRefundBanner(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const clearGrace = useCallback(() => {
    if (graceIntervalRef.current) {
      clearInterval(graceIntervalRef.current);
      graceIntervalRef.current = null;
    }
    setDisconnectGrace(null);
    setShowRefundBanner(false);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const markComplete = async () => {
    if (!appointmentId || completing) return;
    setCompleting(true);
    try {
      // Use the Phase 5 complete route which runs escrow release + commission split.
      // Falls back gracefully if already completed (idempotent).
      await fetch("/api/appointments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
    } catch { /* best-effort; cron will catch stragglers */ }
    setCompleting(false);
  };

  const requestRefund = async () => {
    if (!appointmentId) return;
    setRefundLoading(true);
    try {
      const res = await fetch("/api/payments/video-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, refundType: "owner_early" }),
      });
      if (res.ok) setRefundDone(true);
    } catch { /* ignore */ }
    setRefundLoading(false);
  };

  // ── Join ──────────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    setLoading(true);
    setError("");
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      testStream.getTracks().forEach(t => t.stop());
    } catch {
      setError("Kamera ve mikrofon erişimine izin vermeniz gerekiyor.");
      setLoading(false);
      return;
    }

    try {
      const tokenRes = await fetch("/api/video/agora-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelName: roomId, uid: 0 }),
      });
      const { token, appId, role: fetchedRole, error: tokenError } = await tokenRes.json();
      if (tokenError) throw new Error(tokenError);
      if (fetchedRole) setRole(fetchedRole as "vet" | "owner");

      const AgoraRTCModule = (await import("agora-rtc-sdk-ng")).default as typeof AgoraRTC;
      AgoraRTCModule.setLogLevel(3);
      const client = AgoraRTCModule.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video" && remoteVideoElRef.current) {
          (user.videoTrack as IRemoteVideoTrack)?.play(remoteVideoElRef.current);
          setRemoteUsers(prev => [...new Set([...prev, String(user.uid)])]);
          clearGrace(); // they reconnected
        }
        if (mediaType === "audio") (user.audioTrack as IRemoteAudioTrack)?.play();
      });

      client.on("user-unpublished", (user) => {
        setRemoteUsers(prev => {
          const next = prev.filter(u => u !== String(user.uid));
          // If we had remote users and now we don't → start grace period
          if (prev.length > 0 && next.length === 0) startGrace();
          return next;
        });
      });

      await client.join(appId, roomId, token, null);

      const [audioTrack, videoTrack] = await AgoraRTCModule.createMicrophoneAndCameraTracks(
        { ANS: true, AEC: true, AGC: true },
        { encoderConfig: { width: 1280, height: 720, frameRate: 30, bitrateMin: 600, bitrateMax: 1500 }, facingMode: "user" }
      );
      localAudioRef.current = audioTrack;
      localVideoRef.current = videoTrack;
      if (localVideoElRef.current) videoTrack.play(localVideoElRef.current);
      await client.publish([audioTrack, videoTrack]);
      setJoined(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bağlantı kurulamadı");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = useCallback(async () => {
    localVideoRef.current?.stop();
    localVideoRef.current?.close();
    localAudioRef.current?.stop();
    localAudioRef.current?.close();
    await clientRef.current?.leave();
    clientRef.current = null;
    localVideoRef.current = null;
    localAudioRef.current = null;
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearGrace();
    setJoined(false);
    setElapsed(0);
    setRemoteUsers([]);
  }, [clearGrace]);

  const toggleMic = async () => {
    if (localAudioRef.current) { await localAudioRef.current.setEnabled(!micOn); setMicOn(m => !m); }
  };
  const toggleCam = async () => {
    if (localVideoRef.current) { await localVideoRef.current.setEnabled(!camOn); setCamOn(c => !c); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const remaining = Math.max(0, SESSION_SECONDS - elapsed);
  const nearEnd   = remaining <= WARN_AT_SECONDS && remaining > 0 && joined;
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ══════════════════════════════════════════════════════════════════════════
  // PRE-CALL SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl space-y-5">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#F0FDF4] rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-[#166534]" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Video Görüşme</h1>
            <p className="text-sm text-gray-500">
              Oda: <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{roomId}</span>
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Seans süresi: 30 dakika</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
            <p className="font-bold mb-1.5">📋 Video Görüşme Bildirimi</p>
            <p>
              Video görüşmeler <strong>danışmanlık niteliğindedir</strong>, fiziksel muayene yerine geçmez.
              Reçeteli ilaç yazılması için fiziksel muayene zorunludur.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <input
              type="checkbox" id="prescription_ack"
              checked={prescriptionAcknowledged}
              onChange={e => setPrescriptionAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="prescription_ack" className="text-xs text-gray-700 cursor-pointer leading-relaxed">
              Bu bildirimi okudum ve anladım. Bu görüşmede reçete düzenlenmeyeceğini kabul ediyorum.
            </label>
          </div>

          <div className="space-y-3">
            {[
              { label: "Mikrofon", Icon: Mic, state: micOn, toggle: () => setMicOn(m => !m) },
              { label: "Kamera",   Icon: Video, state: camOn, toggle: () => setCamOn(c => !c) },
            ].map(({ label, Icon, state, toggle }) => (
              <div key={label} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Icon className="w-4 h-4" /> {label}
                </div>
                <button
                  onClick={toggle}
                  className={`w-10 h-5 rounded-full transition-colors ${state ? "bg-[#166534]" : "bg-gray-300"}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${state ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={loading || !prescriptionAcknowledged}
            className="w-full bg-[#166534] hover:bg-[#14532D] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Bağlanıyor…</> : "Görüşmeye Katıl"}
          </button>
          {!prescriptionAcknowledged && (
            <p className="text-xs text-center text-gray-400">Bildirimi onaylamadan görüşmeye katılamazsınız.</p>
          )}
          <Link href="/" className="block text-sm text-center text-gray-400 hover:text-gray-600">Vazgeç</Link>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVE CALL SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Legal bar */}
      <div className="bg-blue-900/80 text-blue-200 text-center text-xs px-4 py-1.5">
        📋 Bu görüşme danışmanlık niteliğindedir. Reçete düzenlenemez. Acil durumlarda kliniğe başvurun.
      </div>

      {/* ── 5-min warning banner ─────────────────────────────────────────────── */}
      {nearEnd && (
        <div className="bg-amber-500 text-white text-center text-sm font-medium px-4 py-2 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Görüşme süreniz dolmak üzere — {fmt(remaining)} kaldı
        </div>
      )}

      {/* ── Session ended banner ─────────────────────────────────────────────── */}
      {sessionEnded && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {role === "vet"   && "Seans tamamlandı. Ödemeniz serbest bırakıldı."}
            {role === "owner" && "Görüşme tamamlandı. Randevularınıza yönlendiriliyorsunuz…"}
            {role === null    && "Seans tamamlandı."}
          </div>
          {role !== "owner" && (
            <button
              onClick={handleLeave}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors shrink-0"
            >
              Çıkış
            </button>
          )}
        </div>
      )}

      {/* ── Disconnect grace period banner ───────────────────────────────────── */}
      {disconnectGrace !== null && (
        <div className="bg-orange-500 text-white px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Karşı tarafın bağlantısı kesildi. Yeniden bağlanıyor… ({fmt(disconnectGrace)})
          </div>
        </div>
      )}

      {/* ── Refund offer banner (disconnect > grace period) ───────────────────── */}
      {showRefundBanner && !refundDone && (
        <div className="bg-red-900/90 border-b border-red-700 px-4 py-3 space-y-2">
          <p className="text-white text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
            Karşı taraf 3 dakikadır bağlanamıyor.
          </p>
          <div className="flex gap-2">
            {role === "owner" && (
              <button
                onClick={requestRefund}
                disabled={refundLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {refundLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                İade Talep Et
              </button>
            )}
            <button
              onClick={clearGrace}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Bekle
            </button>
            <button
              onClick={handleLeave}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors"
            >
              Görüşmeyi Bitir
            </button>
          </div>
        </div>
      )}

      {refundDone && (
        <div className="bg-green-700 text-white text-center text-sm px-4 py-2 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> İade talebiniz alındı. 1–3 iş günü içinde kartınıza yansır.
        </div>
      )}

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <div className="flex items-center gap-2">
          <PawPrint size={22} color="#FFFFFF" />
          <span className="text-white font-semibold text-sm">Veterineri Bul Video</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Countdown timer */}
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
            nearEnd ? "bg-amber-500/20 border border-amber-400/40" : "bg-gray-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${nearEnd ? "bg-amber-400 animate-pulse" : "bg-green-400 animate-pulse"}`} />
            <span className={`text-xs font-mono ${nearEnd ? "text-amber-300 font-bold" : "text-green-400"}`}>
              {sessionEnded ? "00:00" : fmt(remaining)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <Shield className="w-3 h-3" />
            <span>Şifreli</span>
          </div>
          {remoteUsers.length > 0 && (
            <div className="flex items-center gap-1 text-green-400 text-xs">
              <Users className="w-3 h-3" />
              <span>{remoteUsers.length + 1} kişi</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Video area ───────────────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-gray-900">
        <div ref={remoteVideoElRef} className="w-full h-full" style={{ minHeight: "calc(100vh - 160px)" }}>
          {remoteUsers.length === 0 && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <PawPrint size={64} color="#FFFFFF" className="opacity-80" />
              <p className="text-gray-400 text-sm">
                {disconnectGrace !== null ? "Yeniden bağlantı bekleniyor…" : "Karşı taraf bağlanıyor…"}
              </p>
            </div>
          )}
        </div>
        {/* PiP local video */}
        <div
          ref={localVideoElRef}
          className="absolute bottom-4 right-4 w-32 aspect-video bg-gray-700 rounded-xl overflow-hidden border-2 border-gray-600"
        >
          {!camOn && (
            <div className="w-full h-full flex items-center justify-center bg-gray-700">
              <VideoOff className="w-5 h-5 text-gray-500" />
            </div>
          )}
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div className="bg-gray-800 px-4 py-4">
        <div className="max-w-sm mx-auto flex items-center justify-center gap-4">
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${micOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"}`}
          >
            {micOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
          </button>
          <button
            onClick={toggleCam}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${camOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"}`}
          >
            {camOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
          </button>
          <button
            onClick={handleLeave}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
          <button className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors">
            <MessageSquare className="w-5 h-5 text-white" />
          </button>
          {/* Vet: manual complete button */}
          {role === "vet" && !sessionEnded && (
            <button
              onClick={markComplete}
              disabled={completing}
              className="w-12 h-12 rounded-full bg-green-700 hover:bg-green-600 flex items-center justify-center transition-colors"
              title="Görüşmeyi Tamamla"
            >
              {completing
                ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                : <CheckCircle2 className="w-5 h-5 text-white" />
              }
            </button>
          )}
        </div>
        {role === "vet" && !sessionEnded && (
          <p className="text-center text-xs text-gray-500 mt-2">
            ✓ butonu: görüşmeyi tamamla ve ödemeyi al
          </p>
        )}
      </div>
    </div>
  );
}
