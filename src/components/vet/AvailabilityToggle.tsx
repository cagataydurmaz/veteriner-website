"use client";

/**
 * AvailabilityToggle — Standalone card toggle for Klinikte (in-person) availability.
 *
 * Refactored to use shared hooks:
 *   - useVetRealtime: shared ref-counted realtime store
 *   - useVetToggle: optimistic UI, lock checks, rollback
 *
 * All unique UI elements preserved: emoji states, lock indicators,
 * buffer-lock badge, midnight reset notice.
 */

import { Lock } from "lucide-react";
import { useVetRealtime } from "@/hooks/useVetRealtime";
import { useVetToggle } from "@/hooks/useVetToggle";
import type { VetRealtimeState } from "@/services/vet/vetTypes";
import { ns } from "@/lib/i18n/tr";

const ta = ns("availToggle");

interface Props {
  vetId: string;
  initialValue: boolean;
  /** Layer 1: from veterinarians.offers_in_person */
  offersInPerson: boolean;
  /** Layer 3: from veterinarians.is_busy */
  initialIsBusy?: boolean;
  /** Layer 3: from veterinarians.buffer_lock */
  initialBufferLock?: boolean;
}

export default function AvailabilityToggle({
  vetId,
  initialValue,
  offersInPerson,
  initialIsBusy = false,
  initialBufferLock = false,
}: Props) {
  // ── Shared realtime state (singleton store per vetId) ─────────────────
  const status = useVetRealtime(vetId, {
    // Layer 1
    offers_nobetci: false,
    offers_in_person: offersInPerson,
    offers_video: false,
    // Layer 2
    is_available_today: initialValue,
    is_online_now: false,
    is_on_call: false,
    // Layer 3
    is_busy: initialIsBusy,
    buffer_lock: initialBufferLock,
  } satisfies VetRealtimeState);

  // ── Toggle hook — handles optimistic UI, rollback ─────────────────────
  const toggle = useVetToggle({
    type: "available",
    vetId,
    realtimeValue: status.is_available_today,
    layer1Enabled: offersInPerson,
    isBusy: status.is_busy,
    bufferLock: status.buffer_lock,
  });

  const isAvailable = toggle.value;
  const { is_busy: isBusy, buffer_lock: bufferLock } = status;
  const lockedByLayer1 = !offersInPerson;
  const lockedByLayer3 = isBusy;

  return (
    <div
      className={`rounded-2xl border-2 p-5 transition-all ${
        lockedByLayer1
          ? "bg-gray-50 border-dashed border-gray-300 opacity-70"
          : isBusy
          ? "bg-orange-50 border-orange-300"
          : isAvailable
          ? "bg-[#F0FDF4] border-[#16A34A]"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors ${
              lockedByLayer1 ? "bg-gray-100" : isBusy ? "bg-orange-100" : isAvailable ? "bg-[#DCFCE7]" : "bg-gray-200"
            }`}
          >
            {lockedByLayer1 ? <Lock className="w-5 h-5 text-gray-400" /> : isBusy ? "🔴" : isAvailable ? "🟢" : "⚫"}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{ta("title")}</p>
            <p className={`text-xs font-medium mt-0.5 ${
              lockedByLayer1 ? "text-gray-400" : isBusy ? "text-orange-600" : isAvailable ? "text-[#16A34A]" : "text-gray-400"
            }`}>
              {lockedByLayer1
                ? ta("locked")
                : isBusy
                ? ta("busy")
                : isAvailable
                ? ta("active")
                : ta("inactive")}
            </p>
          </div>
        </div>

        <button
          onClick={toggle.fire}
          disabled={toggle.isLoading || toggle.isLocked}
          title={
            lockedByLayer1 ? ta("lockTitle")
            : isBusy ? ta("busyTitle")
            : undefined
          }
          aria-label={ta("ariaLabel")}
          className={`relative w-14 h-7 min-h-[44px] rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#16A34A] disabled:opacity-50 disabled:cursor-not-allowed ${
            lockedByLayer1 || lockedByLayer3 ? "bg-gray-200 cursor-not-allowed" : isAvailable ? "bg-[#16A34A]" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
              isAvailable && !lockedByLayer1 && !lockedByLayer3 ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Buffer-lock informational badge — "Scheduled Exam Soon" */}
      {bufferLock && !isBusy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
          <span className="text-base">⚠️</span>
          <span className="font-medium">{ta("bufferBadgeTitle")}</span>
          <span>{ta("bufferBadgeText")}</span>
        </div>
      )}
      {lockedByLayer1 && (
        <p className="text-xs text-gray-400 mt-3 bg-white/60 rounded-lg px-3 py-1.5 border border-gray-200 flex items-center gap-1.5">
          <Lock className="w-3 h-3 shrink-0" />
          {ta("lockBanner")}
        </p>
      )}
      {isBusy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-orange-700 bg-orange-100 rounded-lg px-3 py-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
          </span>
          {ta("busyBanner")}
        </div>
      )}
      {isAvailable && !lockedByLayer1 && !lockedByLayer3 && !bufferLock && (
        <p className="text-xs text-[#15803D] mt-3 bg-white/60 rounded-lg px-3 py-1.5 border border-[#BBF7D0]">
          {ta("resetNotice")}
        </p>
      )}
    </div>
  );
}
