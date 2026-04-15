"use client";

/**
 * OnCallToggle — Standalone card toggle for Nobetci (on-call) status.
 *
 * Refactored to use shared hooks:
 *   - useVetRealtime: shared ref-counted realtime store
 *   - useVetToggle: optimistic UI, lock checks, rollback
 *
 * All unique UI elements preserved: emoji states, lock indicators, informational badges.
 */

import { Lock } from "lucide-react";
import { useVetRealtime } from "@/hooks/useVetRealtime";
import { useVetToggle } from "@/hooks/useVetToggle";
import type { VetRealtimeState } from "@/services/vet/vetTypes";
import { ns } from "@/lib/i18n/tr";

const tc = ns("oncallToggle");

interface Props {
  vetId: string;
  initialValue: boolean;
  /** Layer 1: from veterinarians.offers_nobetci */
  offersNobetci: boolean;
  /** Layer 3: from veterinarians.is_busy */
  initialIsBusy?: boolean;
  /** Layer 3: from veterinarians.buffer_lock */
  initialBufferLock?: boolean;
}

export default function OnCallToggle({
  vetId,
  initialValue,
  offersNobetci,
  initialIsBusy = false,
  initialBufferLock = false,
}: Props) {
  // ── Shared realtime state (singleton store per vetId) ─────────────────
  const status = useVetRealtime(vetId, {
    // Layer 1
    offers_nobetci: offersNobetci,
    offers_in_person: false,
    offers_video: false,
    // Layer 2
    is_available_today: false,
    is_online_now: false,
    is_on_call: initialValue,
    // Layer 3
    is_busy: initialIsBusy,
    buffer_lock: initialBufferLock,
  } satisfies VetRealtimeState);

  // ── Toggle hook — handles optimistic UI, rollback ─────────────────────
  const toggle = useVetToggle({
    type: "oncall",
    vetId,
    realtimeValue: status.is_on_call,
    layer1Enabled: offersNobetci,
    isBusy: status.is_busy,
    bufferLock: status.buffer_lock,
  });

  const isOnCall = toggle.value;
  const { is_busy: isBusy, buffer_lock: bufferLock } = status;
  const lockedByLayer1 = !offersNobetci;
  const lockedByLayer3 = isBusy || bufferLock;

  return (
    <div
      className={`rounded-2xl border-2 p-5 transition-all ${
        lockedByLayer1
          ? "bg-gray-50 border-dashed border-gray-300 opacity-70"
          : isBusy
          ? "bg-orange-50 border-orange-400"
          : bufferLock
          ? "bg-yellow-50 border-yellow-300"
          : isOnCall
          ? "bg-red-50 border-red-300"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors ${
              lockedByLayer1 ? "bg-gray-100" : isBusy ? "bg-orange-100" : bufferLock ? "bg-yellow-100" : isOnCall ? "bg-red-100" : "bg-gray-200"
            }`}
          >
            {lockedByLayer1 ? <Lock className="w-5 h-5 text-gray-400" /> : isBusy ? "🔴" : bufferLock ? "⏱️" : isOnCall ? "🚨" : "🔕"}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{tc("title")}</p>
            <p className={`text-xs font-medium mt-0.5 ${
              lockedByLayer1 ? "text-gray-400" : isBusy ? "text-orange-600" : bufferLock ? "text-yellow-700" : isOnCall ? "text-red-600" : "text-gray-400"
            }`}>
              {lockedByLayer1
                ? tc("locked")
                : isBusy
                ? tc("busy")
                : bufferLock
                ? tc("bufferLocked")
                : isOnCall
                ? tc("active")
                : tc("inactive")}
            </p>
          </div>
        </div>

        <button
          onClick={toggle.fire}
          disabled={toggle.isLoading || toggle.isLocked}
          title={
            lockedByLayer1 ? tc("lockTitle")
            : isBusy ? tc("busyTitle")
            : bufferLock ? tc("bufferTitle")
            : undefined
          }
          aria-label={tc("ariaLabel")}
          className={`relative w-14 h-7 min-h-[44px] rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            lockedByLayer1 || (!isOnCall && !isBusy && !bufferLock)
              ? "bg-gray-300"
              : isBusy || bufferLock
              ? "bg-orange-400"
              : isOnCall
              ? "bg-red-500"
              : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
              (isOnCall || isBusy || bufferLock) && !lockedByLayer1 ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {lockedByLayer1 && (
        <p className="text-xs text-gray-400 mt-3 bg-white/60 rounded-lg px-3 py-1.5 border border-gray-200 flex items-center gap-1.5">
          <Lock className="w-3 h-3 shrink-0" />
          {tc("lockBanner")}
        </p>
      )}
      {isBusy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-orange-700 bg-orange-100 rounded-lg px-3 py-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
          </span>
          {tc("busyBanner")}
        </div>
      )}
      {bufferLock && !isBusy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-yellow-700 bg-yellow-100 rounded-lg px-3 py-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
          </span>
          {tc("bufferBanner")}
        </div>
      )}
    </div>
  );
}
