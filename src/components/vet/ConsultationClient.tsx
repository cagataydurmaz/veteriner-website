"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  CheckCircle2, Loader2, AlertTriangle, Shield, Clock,
  FlaskConical, Scan, Syringe, ClipboardList, PawPrint,
  AlertCircle, ChevronDown, ChevronUp, ExternalLink,
  FileText, Users,
} from "lucide-react";
import type AgoraRTC from "agora-rtc-sdk-ng";
import type { MedicalRecord, LabResult, VaccineDetail, PastAppointment } from "@/app/vet/consultation/[id]/page";

type IAgoraRTCClient   = import("agora-rtc-sdk-ng").IAgoraRTCClient;
type ILocalVideoTrack  = import("agora-rtc-sdk-ng").ILocalVideoTrack;
type ILocalAudioTrack  = import("agora-rtc-sdk-ng").ILocalAudioTrack;
type IRemoteVideoTrack = import("agora-rtc-sdk-ng").IRemoteVideoTrack;
type IRemoteAudioTrack = import("agora-rtc-sdk-ng").IRemoteAudioTrack;

const SESSION_SECONDS = 30 * 60;
const WARN_AT_SECONDS = 5  * 60;
const GRACE_SECONDS   = 3  * 60;

type SidebarTab = "summary" | "lab" | "imaging" | "vaccines" | "history";

interface Props {
  appointmentId:   string;
  /** Pre-fetched video_room_id if the room already existed; client will call
   *  create-room on join if this is null / undefined. */
  initialRoomId?:  string | null;
  appointmentDatetime: string;
  appointmentType: string;
  complaint?:      string | null;
  pet: {
    id:                 string;
    name:               string;
    species:            string;
    speciesEmoji:       string;
    breed?:             string;
    age?:               number | null;
    weight?:            number | null;
    allergies?:         string | null;
    chronic_conditions?: string | null;
  };
  owner: { id: string; full_name: string; phone?: string | null };
  medicalRecords:      MedicalRecord[];
  pastAppointments:    PastAppointment[];
}

export default function ConsultationClient({
  appointmentId,
  initialRoomId,
  appointmentDatetime,
  complaint,
  pet,
  owner,
  medicalRecords,
  pastAppointments,
}: Props) {
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ── Video state ───────────────────────────────────────────────────────────
  const [joined,       setJoined]       = useState(false);
  const [micOn,        setMicOn]        = useState(true);
  const [camOn,        setCamOn]        = useState(true);
  const [elapsed,      setElapsed]      = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [remoteUsers,  setRemoteUsers]  = useState<string[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [completing,   setCompleting]   = useState(false);
  const [disconnectGrace, setDisconnectGrace] = useState<number | null>(null);
  const [showRefundBanner, setShowRefundBanner] = useState(false);

  const clientRef        = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef    = useRef<ILocalVideoTrack | null>(null);
  const localAudioRef    = useRef<ILocalAudioTrack | null>(null);
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRefreshRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVideoElRef  = useRef<HTMLDivElement>(null);
  const remoteVideoElRef = useRef<HTMLDivElement>(null);
  const sessionEndedRef  = useRef(false);
  /** Resolved Agora channel name (= appointments.video_room_id) set on join */
  const agoraChannelRef  = useRef<string>(initialRoomId ?? "");

  // ── Sidebar state ─────────────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("summary");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Quick notes ───────────────────────────────────────────────────────────
  const [quickNote, setQuickNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved,  setNoteSaved]  = useState(false);

  // ── Elapsed timer + session end ───────────────────────────────────────────
  useEffect(() => {
    if (joined && !sessionEnded) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next >= SESSION_SECONDS && !sessionEndedRef.current) {
            sessionEndedRef.current = true;
            setSessionEnded(true);
            markComplete();
          }
          return next;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, sessionEnded]);

  // ── Realtime: remote completion / cancellation detection ─────────────────
  // Handles the case where the appointment is completed from another device
  // (e.g. 30-min auto-complete on the owner's video/[roomId] page, admin action,
  // or a second vet tab). Ensures the vet's UI never "hangs" after the session ends.
  useEffect(() => {
    const channel = supabase
      .channel(`consultation-apt-${appointmentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${appointmentId}`,
        },
        (payload) => {
          const status = (payload.new as { status?: string }).status;
          if ((status === "completed" || status === "cancelled") && !sessionEndedRef.current) {
            sessionEndedRef.current = true;
            setSessionEnded(true);
            // Soft redirect after 3s so the vet sees the "completed" banner
            setTimeout(() => router.push(`/vet/appointments/${appointmentId}`), 3000);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [appointmentId, router, supabase]);

  // ── Token renewal ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!joined) return;
    const delay = (3600 - 600) * 1000;
    tokenRefreshRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/video/agora-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Use the resolved video_room_id stored at join time
          body: JSON.stringify({ channelName: agoraChannelRef.current, uid: 0 }),
        });
        const { token, error: tokenError } = await res.json();
        if (tokenError || !token) return;
        if (clientRef.current) await clientRef.current.renewToken(token);
      } catch { /* best-effort */ }
    }, delay);
    return () => { if (tokenRefreshRef.current) clearTimeout(tokenRefreshRef.current); };
  }, [joined]);

  // ── Grace period countdown ────────────────────────────────────────────────
  const startGrace = useCallback(() => {
    if (graceIntervalRef.current) return;
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
    if (graceIntervalRef.current) { clearInterval(graceIntervalRef.current); graceIntervalRef.current = null; }
    setDisconnectGrace(null);
    setShowRefundBanner(false);
  }, []);

  // ── Agora actions ─────────────────────────────────────────────────────────
  const markComplete = async () => {
    if (!appointmentId || completing) return;
    setCompleting(true);
    try {
      await fetch("/api/appointments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
    } catch { /* best-effort */ }
    setCompleting(false);
  };

  const handleJoin = async () => {
    setLoading(true);
    setError("");
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      testStream.getTracks().forEach(t => t.stop());
    } catch {
      setError("Kamera ve mikrofon erişimine izin verin.");
      setLoading(false);
      return;
    }
    try {
      // ── Step 1: resolve the real Agora channel name (= video_room_id) ──────
      // The agora-token route looks up appointments by video_room_id, not by
      // appointment.id, so we MUST call create-room first to ensure the UUID exists.
      let channelName = agoraChannelRef.current;
      if (!channelName) {
        const roomRes = await fetch("/api/video/create-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId }),
        });
        const roomData = await roomRes.json();
        if (!roomRes.ok || !roomData.roomId)
          throw new Error(roomData.error ?? "Video odası oluşturulamadı");
        channelName = roomData.roomId as string;
        agoraChannelRef.current = channelName;
      }

      // ── Step 2: get Agora RTC token ─────────────────────────────────────────
      const tokenRes = await fetch("/api/video/agora-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelName, uid: 0 }),
      });
      const { token, appId, error: tokenError } = await tokenRes.json();
      if (tokenError) throw new Error(tokenError);

      const AgoraRTCModule = (await import("agora-rtc-sdk-ng")).default as typeof AgoraRTC;
      AgoraRTCModule.setLogLevel(3);
      const client = AgoraRTCModule.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video" && remoteVideoElRef.current) {
          (user.videoTrack as IRemoteVideoTrack)?.play(remoteVideoElRef.current);
          setRemoteUsers(prev => [...new Set([...prev, String(user.uid)])]);
          clearGrace();
        }
        if (mediaType === "audio") (user.audioTrack as IRemoteAudioTrack)?.play();
      });
      client.on("user-unpublished", (user) => {
        setRemoteUsers(prev => {
          const next = prev.filter(u => u !== String(user.uid));
          if (prev.length > 0 && next.length === 0) startGrace();
          return next;
        });
      });

      await client.join(appId, channelName, token, null);
      const [audioTrack, videoTrack] = await AgoraRTCModule.createMicrophoneAndCameraTracks(
        { ANS: true, AEC: true, AGC: true },
        { encoderConfig: { width: 1280, height: 720, frameRate: 30 }, facingMode: "user" }
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

  // ── Quick note save ───────────────────────────────────────────────────────
  const saveNote = async () => {
    if (!quickNote.trim()) return;
    setSavingNote(true);
    try {
      await fetch("/api/voice-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, text: quickNote }),
      });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
    } catch { /* ignore */ }
    setSavingNote(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const remaining = Math.max(0, SESSION_SECONDS - elapsed);
  const nearEnd   = remaining <= WARN_AT_SECONDS && remaining > 0 && joined;
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const aptDt = new Date(appointmentDatetime);
  const aptLabel = aptDt.toLocaleString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  // Flatten all lab results across records
  const allLabs: (LabResult & { record_date: string })[] = medicalRecords.flatMap(r =>
    (r.lab_results ?? []).map(l => ({ ...l, record_date: r.visit_date ?? r.created_at }))
  );
  const allImaging: { url: string; record_date: string }[] = medicalRecords.flatMap(r =>
    (r.imaging_urls ?? []).map(url => ({ url, record_date: r.visit_date ?? r.created_at }))
  );
  const allVaccines: (VaccineDetail & { record_date: string })[] = medicalRecords.flatMap(r =>
    (r.vaccine_details ?? []).map(v => ({ ...v, record_date: r.visit_date ?? r.created_at }))
  );

  const tabConfig: { id: SidebarTab; label: string; Icon: React.ElementType; count?: number }[] = [
    { id: "summary",  label: "Özet",       Icon: ClipboardList                   },
    { id: "lab",      label: "Lab",         Icon: FlaskConical, count: allLabs.length    },
    { id: "imaging",  label: "Görüntüleme", Icon: Scan,         count: allImaging.length },
    { id: "vaccines", label: "Aşılar",      Icon: Syringe,      count: allVaccines.length},
    { id: "history",  label: "Geçmiş",      Icon: FileText,     count: pastAppointments.length },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // PRE-JOIN SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full space-y-5">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              {pet.speciesEmoji}
            </div>
            <h1 className="text-xl font-bold text-gray-900">Konsültasyon — {pet.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{owner.full_name} · {aptLabel}</p>
          </div>

          {/* Allergy alert */}
          {pet.allergies && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700"><strong>⚠️ ALERJİ:</strong> {pet.allergies}</p>
            </div>
          )}
          {pet.chronic_conditions && (
            <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <p className="text-sm text-purple-700"><strong>Kronik:</strong> {pet.chronic_conditions}</p>
            </div>
          )}
          {complaint && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs text-blue-600 font-semibold mb-1">Şikayet</p>
              <p className="text-sm text-blue-900">{complaint}</p>
            </div>
          )}

          {/* ── Tıbbi Uyarı (Medical Disclaimer) — required per 5996 ─────────── */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 leading-relaxed">
            <p className="font-bold mb-1">⚕️ Tıbbi Uyarı / Medical Disclaimer</p>
            <p>
              Bu görüşme yalnızca <strong>danışmanlık (konsültasyon)</strong> niteliğindedir.{" "}
              <strong>Teşhis veya tedavi yerine geçmez.</strong> Uzaktan değerlendirme fiziksel
              muayenenin yerini alamaz. 5996 Sayılı Veteriner Hizmetleri Kanunu uyarınca
              reçeteli ilaç yazılamaz. Acil durumlarda en yakın kliniğe başvurun.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full bg-[#166534] hover:bg-[#14532D] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Bağlanıyor…</> : <><Video className="w-4 h-4" /> Konsültasyonu Başlat</>}
          </button>

          <Link href={`/vet/appointments/${appointmentId}`}
            className="block text-sm text-center text-gray-400 hover:text-gray-600">
            Geri dön
          </Link>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVE CONSULTATION — SPLIT SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-screen flex flex-col bg-gray-900 overflow-hidden">

      {/* ── Tıbbi Uyarı bar — always visible during call ─────────────────────── */}
      <div className="bg-amber-600/90 text-amber-50 text-center text-xs px-4 py-1 shrink-0">
        ⚕️ Bu görüşme <strong>danışmanlık</strong> niteliğindedir — teşhis/tedavi veya reçete yerine geçmez.
      </div>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{pet.speciesEmoji}</span>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{pet.name}</p>
            <p className="text-gray-400 text-xs">{owner.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Countdown */}
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono ${
            nearEnd ? "bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold" : "bg-gray-700 text-green-400"
          }`}>
            <Clock className="w-3 h-3" />
            {sessionEnded ? "00:00" : fmt(remaining)}
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <Shield className="w-3 h-3" />
            <span>Şifreli</span>
          </div>
          {remoteUsers.length > 0 && (
            <div className="flex items-center gap-1 text-green-400 text-xs">
              <Users className="w-3 h-3" />
              <span>{remoteUsers.length + 1}</span>
            </div>
          )}
          {/* Sidebar toggle (mobile) */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="lg:hidden ml-2 p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
            title={sidebarOpen ? "Kenar çubuğunu gizle" : "e-Nabız"}
          >
            <PawPrint className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Banners ───────────────────────────────────────────────────────────── */}
      {nearEnd && !sessionEnded && (
        <div className="bg-amber-500 text-white text-center text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
          Süre dolmak üzere — {fmt(remaining)} kaldı
        </div>
      )}
      {sessionEnded && (
        <div className="bg-gray-700 text-green-300 text-center text-xs px-4 py-1.5 flex items-center justify-center gap-2 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
          30 dakikalık seans tamamlandı. Ödemeniz serbest bırakıldı.
        </div>
      )}
      {disconnectGrace !== null && (
        <div className="bg-orange-500 text-white text-center text-xs px-4 py-1.5 flex items-center justify-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
          Karşı taraf bağlantı kesik — yeniden bağlanıyor… ({fmt(disconnectGrace)})
        </div>
      )}
      {showRefundBanner && (
        <div className="bg-red-800 text-white text-center text-xs px-4 py-1.5 flex items-center justify-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
          Karşı taraf 3 dakikadır bağlanamıyor.
        </div>
      )}

      {/* ── Main content: video (left) + sidebar (right) ─────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Video ──────────────────────────────────────────────────── */}
        <div className={`relative flex flex-col bg-gray-900 ${sidebarOpen ? "flex-1" : "w-full"}`}>
          {/* Remote video */}
          <div ref={remoteVideoElRef} className="flex-1 w-full">
            {remoteUsers.length === 0 && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <PawPrint size={48} className="text-gray-600" />
                <p className="text-gray-400 text-sm">
                  {disconnectGrace !== null ? "Yeniden bağlantı bekleniyor…" : "Pet sahibi bağlanıyor…"}
                </p>
              </div>
            )}
          </div>
          {/* PiP local */}
          <div
            ref={localVideoElRef}
            className="absolute bottom-20 right-3 w-28 aspect-video bg-gray-700 rounded-xl overflow-hidden border-2 border-gray-600 z-10"
          >
            {!camOn && (
              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                <VideoOff className="w-5 h-5 text-gray-500" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="bg-gray-800 px-4 py-3 flex items-center justify-center gap-4 shrink-0">
            <button
              onClick={toggleMic}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${micOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"}`}
            >
              {micOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
            </button>
            <button
              onClick={toggleCam}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${camOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"}`}
            >
              {camOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
            </button>
            <button
              onClick={handleLeave}
              className="w-13 h-13 p-3.5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={markComplete}
              disabled={completing || sessionEnded}
              className="w-11 h-11 rounded-full bg-green-700 hover:bg-green-600 disabled:opacity-40 flex items-center justify-center transition-colors"
              title="Görüşmeyi tamamla ve ödemeyi al"
            >
              {completing ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <CheckCircle2 className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>

        {/* ── RIGHT: e-Nabız Sidebar ────────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="w-80 xl:w-96 bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0">

            {/* Patient header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">
                  {pet.speciesEmoji}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{pet.name}</p>
                  <p className="text-xs text-gray-500">
                    {pet.species}
                    {pet.breed && ` · ${pet.breed}`}
                    {pet.age != null && ` · ${pet.age} yaş`}
                    {pet.weight != null && ` · ${pet.weight} kg`}
                  </p>
                </div>
              </div>

              {/* Alerts */}
              {pet.allergies && (
                <div className="mt-2 flex items-start gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700"><strong>ALERJİ:</strong> {pet.allergies}</p>
                </div>
              )}
              {pet.chronic_conditions && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-purple-700"><strong>Kronik:</strong> {pet.chronic_conditions}</p>
                </div>
              )}
              {complaint && (
                <div className="mt-1.5 bg-blue-50 rounded-lg px-2 py-1.5">
                  <p className="text-xs text-blue-600 font-semibold">Şikayet:</p>
                  <p className="text-xs text-blue-800 mt-0.5">{complaint}</p>
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-gray-200 bg-white overflow-x-auto shrink-0 scrollbar-none">
              {tabConfig.map(({ id, label, Icon, count }) => (
                <button
                  key={id}
                  onClick={() => setSidebarTab(id)}
                  className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2.5 px-1 text-center transition-colors border-b-2 ${
                    sidebarTab === id
                      ? "border-[#166534] text-[#166534] bg-green-50/50"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium leading-tight">{label}</span>
                  {typeof count === "number" && count > 0 && (
                    <span className={`text-xs rounded-full px-1.5 leading-tight ${sidebarTab === id ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">

              {/* ── SUMMARY ────────────────────────────────────────────────── */}
              {sidebarTab === "summary" && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tıbbi Özet</p>
                  {medicalRecords.length === 0 ? (
                    <EmptyState label="Henüz tıbbi kayıt yok" />
                  ) : (
                    medicalRecords.slice(0, 3).map(r => (
                      <MedRecordCard key={r.id} record={r} />
                    ))
                  )}
                </div>
              )}

              {/* ── LAB RESULTS ────────────────────────────────────────────── */}
              {sidebarTab === "lab" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lab Sonuçları</p>
                  {allLabs.length === 0 ? (
                    <EmptyState label="Lab sonucu yok" />
                  ) : (
                    allLabs.map((lab, i) => (
                      <div key={i} className="rounded-xl border border-gray-100 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900">{lab.test}</p>
                          <span className="text-xs text-gray-400">{formatDate(lab.record_date)}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-700 font-medium">{lab.result}</span>
                          {lab.unit && <span className="text-xs text-gray-400">{lab.unit}</span>}
                          {lab.ref_range && (
                            <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                              Ref: {lab.ref_range}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── IMAGING ────────────────────────────────────────────────── */}
              {sidebarTab === "imaging" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Görüntüleme</p>
                  {allImaging.length === 0 ? (
                    <EmptyState label="Görüntüleme kaydı yok" />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {allImaging.map((img, i) => (
                        <a
                          key={i}
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center hover:border-[#166534] transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={`Görüntü ${i + 1}`}
                            className="object-cover w-full h-full"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                            <ExternalLink className="w-5 h-5 text-white" />
                          </div>
                          <p className="absolute bottom-1 right-1 text-xs text-white bg-black/50 rounded px-1">
                            {formatDate(img.record_date)}
                          </p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── VACCINES ───────────────────────────────────────────────── */}
              {sidebarTab === "vaccines" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aşı Geçmişi</p>
                  {allVaccines.length === 0 ? (
                    <EmptyState label="Aşı kaydı yok" />
                  ) : (
                    allVaccines.map((v, i) => {
                      const nextDue = v.next_due ? new Date(v.next_due) : null;
                      const isOverdue = nextDue && nextDue < new Date();
                      return (
                        <div key={i} className={`rounded-xl border p-3 ${isOverdue ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">{v.vaccine_name}</p>
                            {isOverdue && (
                              <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 shrink-0">Tarihi geçti</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Yapıldı: {formatDate(v.given_date)}
                            {v.next_due && ` · Sonraki: ${formatDate(v.next_due)}`}
                          </p>
                          {v.batch_no && <p className="text-xs text-gray-400">Lot: {v.batch_no}</p>}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── HISTORY ────────────────────────────────────────────────── */}
              {sidebarTab === "history" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Geçmiş Ziyaretler</p>
                  {pastAppointments.length === 0 ? (
                    <EmptyState label="Geçmiş ziyaret yok" />
                  ) : (
                    pastAppointments.map(p => (
                      <div key={p.id} className="rounded-xl border border-gray-100 p-3">
                        <p className="text-xs font-semibold text-gray-700">{formatDate(p.datetime)}</p>
                        {p.complaint && <p className="text-xs text-gray-500 mt-0.5">Şikayet: {p.complaint}</p>}
                        <Link
                          href={`/vet/appointments/${p.id}`}
                          className="text-xs text-[#166534] hover:underline mt-1 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Görüntüle
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* ── Quick note ────────────────────────────────────────────────── */}
            <div className="border-t border-gray-200 p-3 bg-gray-50 shrink-0">
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Hızlı Not (SOAP)</p>
              <textarea
                value={quickNote}
                onChange={e => setQuickNote(e.target.value)}
                placeholder="Muayene notları…"
                rows={3}
                className="w-full text-xs rounded-lg border border-gray-200 p-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#166534] bg-white"
              />
              <div className="flex items-center justify-between mt-1.5">
                {noteSaved && <span className="text-xs text-green-600">✓ Kaydedildi</span>}
                {!noteSaved && <span />}
                <button
                  onClick={saveNote}
                  disabled={savingNote || !quickNote.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#166534] hover:bg-[#14532D] disabled:opacity-40 text-white text-xs rounded-lg transition-colors font-medium"
                >
                  {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

function MedRecordCard({ record }: { record: MedicalRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div>
          <p className="text-xs font-semibold text-gray-800">
            {formatDate(record.visit_date ?? record.created_at)}
          </p>
          {record.diagnosis && (
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{record.diagnosis}</p>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 bg-white border-t border-gray-100">
          {record.vet_notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Notlar</p>
              <p className="text-xs text-gray-700 leading-relaxed">{record.vet_notes}</p>
            </div>
          )}
          {Array.isArray(record.medications) && record.medications.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">İlaçlar</p>
              <p className="text-xs text-gray-700">{JSON.stringify(record.medications)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return iso;
  }
}
