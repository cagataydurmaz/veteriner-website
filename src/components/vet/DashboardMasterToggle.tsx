"use client";

/**
 * DashboardMasterToggle — Cambly-style "Go Online" card
 *
 * A large, prominent power-button card that lives at the center of the
 * dashboard. It mirrors the `is_online_now` toggle from VetStatusBar.
 *
 * Refactored to use shared hooks:
 *   - useVetRealtime: shares the same ref-counted store as VetStatusBar
 *     (no duplicate Supabase channels — singleton per vetId)
 *   - useVetToggle: optimistic UI, lock checks, rollback — all handled internally
 *
 * This component is now ~100 lines (down from 165) with ZERO inline fetch() calls.
 */

import { Power, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useVetRealtime } from "@/hooks/useVetRealtime";
import { useVetToggle } from "@/hooks/useVetToggle";
import type { VetRealtimeState } from "@/services/vet/vetTypes";
import { ns } from "@/lib/i18n/tr";

const tm = ns("masterToggle");

interface Props {
  vetId: string;
  initialState: VetRealtimeState;
  offersVideo: boolean;
  videoConsultationFee: number | null;
  firstName: string;
}

export default function DashboardMasterToggle({
  vetId,
  initialState,
  offersVideo,
  videoConsultationFee,
  firstName,
}: Props) {
  // ── Shared realtime state (same singleton store as VetStatusBar) ────────
  const status = useVetRealtime(vetId, initialState);

  // ── Video fee check (additional Layer 1 lock) ──────────────────────────
  const videoFeeMissing = offersVideo && !videoConsultationFee;

  // ── Online toggle hook — handles optimistic UI, rollback, heartbeat ────
  // Note: DashboardMasterToggle only blocks on videoFeeMissing (not offersVideo).
  // The videoFeeMissing case renders AlertCircle instead of the button.
  // When offers_video=false but fee is set, the API handles validation server-side.
  const onlineToggle = useVetToggle({
    type: "online",
    vetId,
    realtimeValue: status.is_online_now,
    layer1Enabled: !videoFeeMissing,
    isBusy: status.is_busy,
    bufferLock: status.buffer_lock,
  });

  const online = onlineToggle.value;
  const loading = onlineToggle.isLoading;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-5 text-center">
      {/* Live status badge */}
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
          online
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-gray-100 text-gray-500 border border-gray-200"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${online ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
        />
        {online ? tm("online") : tm("offline")}
      </div>

      {/* Headline */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {online ? tm("greeting", { name: firstName }) : tm("readyQuestion")}
        </h2>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          {online ? tm("onlineDesc") : tm("offlineDesc")}
        </p>
      </div>

      {/* Power button or blocked state */}
      {videoFeeMissing ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm text-amber-600 font-medium">
            {tm("feeWarning")}
          </p>
          <Link
            href="/vet/profile"
            className="text-sm text-[#166534] underline underline-offset-2"
          >
            {tm("feeLink")}
          </Link>
        </div>
      ) : (
        <button
          onClick={onlineToggle.fire}
          disabled={loading}
          aria-label={online ? tm("goOffline") : tm("goOnline")}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-300 focus:outline-none
            focus-visible:ring-4 focus-visible:ring-offset-2
            ${online
              ? "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/25 focus-visible:ring-green-300"
              : "bg-gray-200 hover:bg-gray-300 focus-visible:ring-gray-300"}
            ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer active:scale-95"}
          `}
        >
          {loading ? (
            <Loader2 className={`w-8 h-8 animate-spin ${online ? "text-white" : "text-gray-500"}`} />
          ) : (
            <Power className={`w-8 h-8 ${online ? "text-white" : "text-gray-500"}`} />
          )}
        </button>
      )}

      <p className="text-xs text-gray-300">
        {online ? tm("stopHint") : tm("startHint")}
      </p>
    </div>
  );
}
