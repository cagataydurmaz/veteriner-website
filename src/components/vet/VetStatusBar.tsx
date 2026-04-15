"use client";

/**
 * VetStatusBar — Compact Command Center
 *
 * Sticky sub-header visible on every vet panel page.
 * 3 pill chips: Klinikte · Online · Nöbetçi
 *
 * Refactored to use shared hooks:
 *   - useVetRealtime: single dual-channel subscription (ref-counted, shared with DashboardMasterToggle)
 *   - useVetToggle: optimistic UI, lock checks, heartbeat, rollback — all handled internally
 *
 * This component is now ~140 lines (down from 340) with ZERO inline fetch() calls.
 */

import { Loader2, MapPin, Video, Siren, Lock, Clock } from "lucide-react";
import Link from "next/link";
import { useVetRealtime } from "@/hooks/useVetRealtime";
import { useVetToggle } from "@/hooks/useVetToggle";
import type { VetRealtimeState } from "@/services/vet/vetTypes";
import { t, ns } from "@/lib/i18n/tr";

const ts = ns("statusBar");

// ─────────────────────────────────────────────────────────────────────────────
// Props — snake_case matching Supabase schema
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  vetId: string;
  initialState: VetRealtimeState;
  offersInPerson: boolean;
  offersVideo: boolean;
  offersNobetci: boolean;
  videoConsultationFee: number | null;
}

/* ── Tooltip wrapper ────────────────────────────────────────────────────────── */
function Tip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg
          opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50
          text-center leading-snug"
      >
        {label}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}

/* ── Chip component ─────────────────────────────────────────────────────────── */
function StatusChip({
  label,
  active,
  loading,
  lockedByL1,
  lockedByL3,
  l1Reason,
  l3Reason,
  Icon,
  activeColor,
  onToggle,
}: {
  label: string;
  active: boolean;
  loading: boolean;
  lockedByL1: boolean;
  lockedByL3: boolean;
  l1Reason?: string;
  l3Reason?: string;
  Icon: React.ElementType;
  activeColor: string;
  onToggle: () => void;
}) {
  const isDisabled = loading || lockedByL1 || (lockedByL3 && !active);

  const chipContent = (
    <button
      onClick={onToggle}
      disabled={isDisabled}
      aria-label={`${label}: ${active ? t("common.active") : t("common.passive")}`}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
        border-2 transition-all duration-200 select-none min-h-[44px] sm:min-h-0
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        ${active
          ? `${activeColor} text-white border-transparent shadow-sm`
          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
        }
        ${isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:scale-105 active:scale-95"}
      `}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
      ) : lockedByL1 ? (
        <Lock className="w-3 h-3 shrink-0" />
      ) : lockedByL3 ? (
        <Clock className="w-3 h-3 shrink-0" />
      ) : (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            active ? "bg-white animate-pulse" : "bg-gray-300"
          }`}
        />
      )}
      <Icon className="w-3 h-3 shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  if (lockedByL1) {
    return (
      <Tip label={l1Reason ?? ts("l1DefaultTip")}>
        {chipContent}
      </Tip>
    );
  }
  if (lockedByL3 && l3Reason) {
    return <Tip label={l3Reason}>{chipContent}</Tip>;
  }
  return chipContent;
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function VetStatusBar({
  vetId,
  initialState,
  offersInPerson,
  offersVideo,
  offersNobetci,
  videoConsultationFee,
}: Props) {
  // ── Shared realtime state (ref-counted, shared with DashboardMasterToggle) ──
  const status = useVetRealtime(vetId, initialState);

  // ── Layer-1 permissions: read from reactive store (live) ───────────────────
  // initialState now includes offers_* so `status` is seeded from SSR data.
  // When the vet saves profile settings the profile route broadcasts the updated
  // values via broadcastVetStatus → applyPayload → store re-renders all consumers
  // instantly, no page reload required.
  const effectiveOffersInPerson = status.offers_in_person;
  const effectiveOffersVideo    = status.offers_video;
  const effectiveOffersNobetci  = status.offers_nobetci;

  // ── 3 toggle hooks — handle optimistic UI, lock checks, heartbeat, rollback ──
  const availToggle = useVetToggle({
    type: "available",
    vetId,
    realtimeValue: status.is_available_today,
    layer1Enabled: effectiveOffersInPerson,
    isBusy: status.is_busy,
    bufferLock: status.buffer_lock,
  });

  // Online chip has an additional Layer 1 lock: video fee must be set
  const videoFeeMissing = effectiveOffersVideo && !videoConsultationFee;
  const onlineToggle = useVetToggle({
    type: "online",
    vetId,
    realtimeValue: status.is_online_now,
    layer1Enabled: effectiveOffersVideo && !videoFeeMissing,
    isBusy: status.is_busy,
    bufferLock: status.buffer_lock,
  });

  const oncallToggle = useVetToggle({
    type: "oncall",
    vetId,
    realtimeValue: status.is_on_call,
    layer1Enabled: effectiveOffersNobetci,
    isBusy: status.is_busy,
    bufferLock: status.buffer_lock,
  });

  return (
    <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 min-h-[44px]">

        {/* Left: busy / buffer indicators */}
        <div className="flex items-center gap-2 min-w-0">
          {status.is_busy && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              {ts("busyBadge")}
            </span>
          )}
          {status.buffer_lock && !status.is_busy && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold shrink-0">
              <Clock className="w-3 h-3" />
              {ts("bufferBadge")}
            </span>
          )}
        </div>

        {/* Right: 3 toggle chips */}
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusChip
            label={ts("chipKlinikte")}
            active={availToggle.value}
            loading={availToggle.isLoading}
            lockedByL1={!effectiveOffersInPerson}
            lockedByL3={status.is_busy && !availToggle.value}
            l3Reason={ts("l3Busy")}
            Icon={MapPin}
            activeColor="bg-[#16A34A]"
            onToggle={availToggle.fire}
          />
          <StatusChip
            label={ts("chipOnline")}
            active={onlineToggle.value}
            loading={onlineToggle.isLoading}
            lockedByL1={!effectiveOffersVideo || videoFeeMissing}
            l1Reason={videoFeeMissing ? ts("l1VideoFeeTip") : undefined}
            lockedByL3={(status.is_busy || status.buffer_lock) && !onlineToggle.value}
            l3Reason={status.is_busy ? ts("l3OnlineBusy") : ts("l3Buffer")}
            Icon={Video}
            activeColor="bg-blue-600"
            onToggle={onlineToggle.fire}
          />
          <StatusChip
            label={ts("chipNobetci")}
            active={oncallToggle.value}
            loading={oncallToggle.isLoading}
            lockedByL1={!effectiveOffersNobetci}
            lockedByL3={(status.is_busy || status.buffer_lock) && !oncallToggle.value}
            l3Reason={ts("l3OncallBusy")}
            Icon={Siren}
            activeColor="bg-amber-500"
            onToggle={oncallToggle.fire}
          />

          {/* Profile shortcut when any service is locked */}
          {(!effectiveOffersInPerson || !effectiveOffersVideo || !effectiveOffersNobetci) && (
            <Link
              href="/vet/profile"
              className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs transition-colors"
              title={ts("profileLink")}
            >
              <Lock className="w-3 h-3" />
              <span className="hidden sm:inline">Profil</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
