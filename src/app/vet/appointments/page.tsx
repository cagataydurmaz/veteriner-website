"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Video, MapPin, Loader2, Check, X, CheckCircle2,
  Clock, AlertCircle, MessageCircle, Calendar, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getSpeciesEmoji } from "@/lib/utils";
import dynamic from "next/dynamic";

// AvailabilityManager (22 KB) is only shown on the "musaitlik" tab.
// Lazy-load it so the initial appointments bundle stays lean.
const AvailabilityManager = dynamic(
  () => import("@/components/vet/AvailabilityManager"),
  {
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-gray-100 rounded-xl w-48" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    ),
    ssr: false,
  }
);

type Appointment = {
  id: string;
  datetime: string;
  type: "video" | "in_person";
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  payment_status: string | null;
  payment_amount: number | null;
  pet: { name: string; species: string; allergies: string | null } | null;
  owner: { full_name: string; phone: string | null } | null;
};

type Tab = "today" | "week" | "pending" | "history" | "musaitlik";

const TAB_LABELS: Record<Tab, string> = {
  today:     "Bugün",
  week:      "Bu Hafta",
  pending:   "Bekleyen",
  history:   "Geçmiş",
  musaitlik: "Müsaitlik",
};

export default function VetAppointmentsPage() {
  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const [activeTab,     setActiveTab]     = useState<Tab>("today");
  const [appointments,  setAppointments]  = useState<Appointment[]>([]);
  const [pendingCount,  setPendingCount]  = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [vetId,         setVetId]         = useState<string | null>(null);
  const [cancelModal,    setCancelModal]   = useState<{ show: boolean; aptId: string | null }>({ show: false, aptId: null });
  const [cancelReason,   setCancelReason]  = useState("");

  const supabase = useMemo(() => createClient(), []);

  // ── Ding sound via Web Audio API ─────────────────────────────────────────────
  const playDing = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* browser may block AudioContext before user gesture — ignore */ }
  }, []);

  // ── Fetch pending count ──────────────────────────────────────────────────────
  const fetchPendingCount = useCallback(async (vid: string) => {
    const { count } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("vet_id", vid)
      .eq("status", "pending");
    setPendingCount(count || 0);
  }, [supabase]);

  // ── Fetch appointments for active tab ────────────────────────────────────────
  const fetchTab = useCallback(async (vid: string, tab: Tab) => {
    // Availability tab doesn't need appointment data
    if (tab === "musaitlik") { setLoading(false); return; }

    setLoading(true);
    const todayIso    = today.toISOString();
    const tomorrowIso = new Date(today.getTime() + 86400000).toISOString();
    const weekEndIso  = new Date(today.getTime() + 7 * 86400000).toISOString();

    let query = supabase
      .from("appointments")
      .select(`
        id, datetime, type, status, payment_status, payment_amount,
        pet:pets(name, species, allergies),
        owner:users(full_name, phone)
      `)
      .eq("vet_id", vid);

    if (tab === "today") {
      query = query
        .gte("datetime", todayIso)
        .lt("datetime",  tomorrowIso)
        .neq("status", "cancelled")
        .order("datetime", { ascending: true });
    } else if (tab === "week") {
      query = query
        .gte("datetime", todayIso)
        .lt("datetime",  weekEndIso)
        .neq("status", "cancelled")
        .order("datetime", { ascending: true });
    } else if (tab === "pending") {
      query = query
        .eq("status", "pending")
        .order("datetime", { ascending: true });
    } else {
      query = query
        .in("status", ["completed", "cancelled"])
        .order("datetime", { ascending: false })
        .limit(60);
    }

    const { data } = await query;
    setAppointments((data as unknown as Appointment[]) || []);
    setLoading(false);
  }, [supabase, today]);

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: vet } = await supabase
        .from("veterinarians")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!vet) return;
      setVetId(vet.id);
      await Promise.all([
        fetchTab(vet.id, "today"),
        fetchPendingCount(vet.id),
      ]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Re-fetch when tab changes
  useEffect(() => {
    if (!vetId) return;
    fetchTab(vetId, activeTab);
  }, [vetId, activeTab, fetchTab]);

  // ── Realtime: live appointment sync ──────────────────────────────────────────
  const activTabRef = useRef(activeTab);
  activTabRef.current = activeTab;

  useEffect(() => {
    if (!vetId) return;

    const channel = supabase
      .channel(`vet-apts-realtime-${vetId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `vet_id=eq.${vetId}`,
        },
        () => {
          playDing();
          fetchTab(vetId, activTabRef.current);
          fetchPendingCount(vetId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `vet_id=eq.${vetId}`,
        },
        () => {
          fetchTab(vetId, activTabRef.current);
          fetchPendingCount(vetId);
        }
      )
      .subscribe((status) => {
        // Reconnection resilience: if WebSocket drops and re-connects,
        // immediately re-fetch to catch any events missed during the gap.
        if (status === "SUBSCRIBED") {
          fetchTab(vetId, activTabRef.current);
          fetchPendingCount(vetId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vetId, supabase, fetchTab, fetchPendingCount, playDing]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const confirm = async (id: string) => {
    // Optimistic update: mark as confirmed immediately so UI feels instant
    setAppointments(prev =>
      prev.map(a => a.id === id ? { ...a, status: "confirmed" as const } : a)
    );
    setPendingCount(prev => Math.max(0, prev - 1));

    setActionLoading(id + "confirm");
    try {
      const res = await fetch("/api/vet/confirm-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Onaylama başarısız");
      toast.success(data.message || "Randevu onaylandı");
      // Realtime subscription will confirm the DB change — no manual fetchTab needed
    } catch (err) {
      // Rollback optimistic update on error
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status: "pending" as const } : a)
      );
      setPendingCount(prev => prev + 1);
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally { setActionLoading(null); }
  };

  const cancelWithChain = async (id: string, reason: string) => {
    setActionLoading(id + "cancel");
    try {
      const res = await fetch("/api/vet/cancel-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      setCancelModal({ show: false, aptId: null });
      setCancelReason("");
      if (vetId) {
        await fetchTab(vetId, activeTab);
        await fetchPendingCount(vetId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İptal başarısız");
    } finally { setActionLoading(null); }
  };

  const completeVideo = async (id: string) => {
    setActionLoading(id + "complete");
    try {
      const res = await fetch("/api/appointments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      if (vetId) await fetchTab(vetId, activeTab);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally { setActionLoading(null); }
  };

  const completeInPerson = async (id: string) => {
    setActionLoading(id + "complete");
    try {
      const res = await fetch("/api/appointments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Muayene tamamlandı");
      if (vetId) await fetchTab(vetId, activeTab);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally { setActionLoading(null); }
  };

  const markNoShow = async (id: string) => {
    setActionLoading(id + "noshow");
    try {
      const res = await fetch("/api/appointments/no-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Gelmedi olarak işaretlendi");
      if (vetId) await fetchTab(vetId, activeTab);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-4">

      {/* ── Cancel Modal ─────────────────────────────────────────────────────── */}
      {cancelModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Randevuyu İptal Et</h2>
            </div>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="İptal nedeni (opsiyonel)..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                onClick={() => setCancelModal({ show: false, aptId: null })}
              >
                Vazgeç
              </button>
              <button
                data-testid="btn-cancel-confirm"
                disabled={!!actionLoading}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                onClick={() => cancelModal.aptId && cancelWithChain(cancelModal.aptId, cancelReason)}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "İptal Et"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Randevular</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tüm randevularınızı yönetin</p>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {(["today", "week", "pending", "history", "musaitlik"] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              flex-1 relative flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] whitespace-nowrap min-w-0
              ${activeTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            {tab === "musaitlik"
              ? <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              : null
            }
            <span className="truncate text-xs sm:text-sm">{TAB_LABELS[tab]}</span>
            {tab === "pending" && pendingCount > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold leading-none shrink-0 ${
                activeTab === "pending"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-amber-500 text-white"
              }`}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Availability Tab ─────────────────────────────────────────────────── */}
      {activeTab === "musaitlik" && vetId && (
        <AvailabilityManager vetId={vetId} />
      )}
      {activeTab === "musaitlik" && !vetId && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[#166534]" />
        </div>
      )}

      {/* ── Appointment Content ───────────────────────────────────────────────── */}
      {activeTab !== "musaitlik" && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#166534]" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 gap-3 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Calendar className="w-7 h-7 text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {activeTab === "today"   ? "Bugün randevu bulunmuyor" :
                 activeTab === "week"    ? "Bu hafta randevu bulunmuyor" :
                 activeTab === "pending" ? "Bekleyen randevu yok" :
                 "Henüz tamamlanmış randevu yok"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {activeTab === "history"
                  ? "Tamamlanan randevular burada listelenecek."
                  : "Müsaitliğinizi ayarlayarak randevu almaya başlayın."}
              </p>
            </div>
            {activeTab !== "history" && (
              <button
                onClick={() => setActiveTab("musaitlik")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#166534] text-white text-xs font-medium hover:bg-[#14532D] transition-colors"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Takvimi Düzenle
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {appointments.map(apt => (
              <AppointmentRow
                key={apt.id}
                apt={apt}
                actionLoading={actionLoading}
                onConfirm={confirm}
                onCancel={() => setCancelModal({ show: true, aptId: apt.id })}
                onCompleteVideo={completeVideo}
                onCompleteInPerson={completeInPerson}
                onNoShow={markNoShow}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Appointment Row ──────────────────────────────────────────────────────────
function AppointmentRow({
  apt,
  actionLoading,
  onConfirm,
  onCancel,
  onCompleteVideo,
  onCompleteInPerson,
  onNoShow,
}: {
  apt: Appointment;
  actionLoading: string | null;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onCompleteVideo: (id: string) => void;
  onCompleteInPerson: (id: string) => void;
  onNoShow: (id: string) => void;
}) {
  const dt        = new Date(apt.datetime);
  const time      = dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const dateStr   = dt.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  const isVideo     = apt.type === "video";
  const isInPerson  = apt.type === "in_person";
  const isPending   = apt.status === "pending";
  const isConfirmed = apt.status === "confirmed";
  const isCancelled = apt.status === "cancelled";
  const isCompleted = apt.status === "completed";
  const isNoShow    = apt.status === "no_show";
  const isPast      = new Date(apt.datetime) < new Date();

  return (
    <div
      data-testid={`apt-card-${apt.id}`}
      data-status={apt.status}
      className={`bg-white border rounded-xl p-4 transition-shadow hover:shadow-sm ${
        isCancelled || isNoShow ? "opacity-60 border-gray-200" :
        isPending               ? "border-amber-200" :
        isConfirmed             ? "border-green-200" :
                                  "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-3">

        {/* Date + time block */}
        <div className="text-center w-14 shrink-0 pt-0.5">
          <p className="text-xs font-medium text-gray-500">{dateStr}</p>
          <p className="text-sm font-bold text-gray-900 flex items-center justify-center gap-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            {time}
          </p>
        </div>

        {/* Pet emoji */}
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl shrink-0">
          {getSpeciesEmoji(apt.pet?.species || "")}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900">{apt.pet?.name || "—"}</p>
          <p className="text-xs text-gray-500 mt-0.5">{apt.owner?.full_name || "—"}</p>
          {apt.pet?.allergies && (
            <p className="text-xs text-orange-600 mt-1">⚠️ Alerji: {apt.pet.allergies}</p>
          )}
        </div>

        {/* Right side: badges + actions */}
        <div className="shrink-0 flex flex-col items-end gap-2">

          {/* Type + status badges */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
              isVideo ? "bg-blue-50 text-blue-700" : "bg-[#F0FDF4] text-[#166534]"
            }`}>
              {isVideo ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
              {isVideo ? "Video" : "Yüz Yüze"}
            </span>
            {isPending && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                <AlertCircle className="w-3 h-3" /> Bekliyor
              </span>
            )}
            {isConfirmed && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                <CheckCircle2 className="w-3 h-3" /> Onaylı
              </span>
            )}
            {isCompleted && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                <CheckCircle2 className="w-3 h-3" /> Tamamlandı
              </span>
            )}
            {isCancelled && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                <X className="w-3 h-3" /> İptal
              </span>
            )}
          </div>

          {/* Action buttons */}
          {!isCancelled && !isCompleted && !isNoShow && (
            <div className="flex items-center gap-1.5">
              {isPending && (
                <button
                  data-testid="btn-confirm-apt"
                  disabled={!!actionLoading}
                  onClick={() => onConfirm(apt.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#166534] text-white rounded-lg text-xs font-medium hover:bg-[#14532D] transition-colors disabled:opacity-50 min-h-[32px]"
                >
                  {actionLoading === apt.id + "confirm"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <><Check className="w-3 h-3" /> Onayla</>
                  }
                </button>
              )}
              {/* Video: Tamamla (ödeme serbest bırak) */}
              {isConfirmed && isVideo && apt.payment_status === "held" && (
                <button
                  disabled={!!actionLoading}
                  onClick={() => onCompleteVideo(apt.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[32px]"
                >
                  {actionLoading === apt.id + "complete"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <><CheckCircle2 className="w-3 h-3" /> Tamamla</>
                  }
                </button>
              )}
              {/* In-person: Muayene Bitti */}
              {isConfirmed && isInPerson && isPast && (
                <button
                  disabled={!!actionLoading}
                  onClick={() => onCompleteInPerson(apt.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50 min-h-[32px]"
                >
                  {actionLoading === apt.id + "complete"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <><CheckCircle2 className="w-3 h-3" /> Muayene Bitti</>
                  }
                </button>
              )}
              {/* No-show: Gelmedi (in-person + past) */}
              {isConfirmed && isInPerson && isPast && (
                <button
                  disabled={!!actionLoading}
                  onClick={() => onNoShow(apt.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors disabled:opacity-50 min-h-[32px]"
                  title="Hasta gelmedi"
                >
                  {actionLoading === apt.id + "noshow"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <><AlertCircle className="w-3 h-3" /> Gelmedi</>
                  }
                </button>
              )}
              <Link
                href={`/vet/appointments/${apt.id}/chat`}
                className="flex items-center justify-center w-8 h-8 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-gray-500" />
              </Link>
              <Link
                href={`/vet/appointments/${apt.id}`}
                className="flex items-center justify-center px-2.5 h-8 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-xs text-gray-600"
              >
                Detay
              </Link>
              <button
                data-testid="btn-cancel-apt"
                disabled={!!actionLoading}
                onClick={() => onCancel(apt.id)}
                className="flex items-center justify-center w-8 h-8 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          )}

          {/* Completed/cancelled: detail link only */}
          {(isCompleted || isCancelled) && (
            <Link
              href={`/vet/appointments/${apt.id}`}
              className="flex items-center justify-center px-2.5 h-8 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-xs text-gray-600"
            >
              Detay
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
