"use client";

/**
 * OnlineToggle — Standalone card toggle for Online (video) status.
 *
 * Refactored to use shared hooks:
 *   - useVetRealtime: shared ref-counted realtime store
 *   - useVetToggle: optimistic UI, heartbeat, lock checks, rollback
 *
 * Unique features preserved:
 *   - isInsideScheduledHours() schedule check (non-blocking warning)
 *   - Detailed card UI with emoji states, lock indicators, informational badges
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useVetRealtime } from "@/hooks/useVetRealtime";
import { useVetToggle } from "@/hooks/useVetToggle";
import type { VetRealtimeState } from "@/services/vet/vetTypes";
import { ns } from "@/lib/i18n/tr";

const to = ns("onlineToggle");

// Check if current Istanbul time is inside any active video/both availability_slots
async function isInsideScheduledHours(vetId: string): Promise<boolean> {
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" }); // YYYY-MM-DD
    const res = await fetch(
      `/api/appointments/availability?vetId=${vetId}&from=${dateStr}&to=${dateStr}&serviceType=video`
    );
    if (!res.ok) return true; // fail open — don't block the toggle on error
    const data = await res.json() as { slots: Record<string, string[]> };
    const todaySlots = data.slots[dateStr] ?? [];
    // Current time in Istanbul HH:MM
    const nowISTStr = now.toLocaleTimeString("sv-SE", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
    }).slice(0, 5);
    return todaySlots.includes(nowISTStr);
  } catch {
    return true; // fail open
  }
}

interface Props {
  vetId: string;
  initialValue: boolean;
  /** Layer 1: from veterinarians.offers_video */
  offersVideo: boolean;
  /** Layer 3: from veterinarians.is_busy */
  initialIsBusy?: boolean;
  /** Layer 3: from veterinarians.buffer_lock */
  initialBufferLock?: boolean;
}

export default function OnlineToggle({
  vetId,
  initialValue,
  offersVideo,
  initialIsBusy = false,
  initialBufferLock = false,
}: Props) {
  // ── Shared realtime state (singleton store per vetId) ─────────────────
  const status = useVetRealtime(vetId, {
    // Layer 1
    offers_nobetci: false,
    offers_in_person: false,
    offers_video: offersVideo,
    // Layer 2
    is_available_today: false,
    is_online_now: initialValue,
    is_on_call: false,
    // Layer 3
    is_busy: initialIsBusy,
    buffer_lock: initialBufferLock,
  } satisfies VetRealtimeState);

  // ── Toggle hook — handles optimistic UI, heartbeat, rollback ──────────
  const toggle = useVetToggle({
    type: "online",
    vetId,
    realtimeValue: status.is_online_now,
    layer1Enabled: offersVideo,
    isBusy: status.is_busy,
    bufferLock: status.buffer_lock,
  });

  const isOnline = toggle.value;
  const { is_busy: isBusy, buffer_lock: bufferLock } = status;
  const lockedByLayer1 = !offersVideo;
  const lockedByLayer3 = isBusy || bufferLock;

  // ── Enhanced fire: schedule check before toggling online ──────────────
  const handleToggle = useCallback(() => {
    // If going online, run non-blocking schedule check
    if (!isOnline && !lockedByLayer1) {
      isInsideScheduledHours(vetId).then((inside) => {
        if (!inside) {
          toast.warning(
            to("scheduleWarning"),
            { duration: 6000, action: { label: to("editCalendar"), onClick: () => window.location.href = "/vet/calendar" } }
          );
        }
      });
    }
    toggle.fire();
  }, [isOnline, lockedByLayer1, vetId, toggle]);

  return (
    <div
      className={`rounded-2xl border-2 p-5 transition-all ${
        lockedByLayer1
          ? "bg-gray-50 border-dashed border-gray-300 opacity-70"
          : isBusy
          ? "bg-orange-50 border-orange-400"
          : bufferLock && !isOnline
          ? "bg-yellow-50 border-yellow-300"
          : isOnline
          ? "bg-blue-50 border-blue-400"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors ${
              lockedByLayer1 ? "bg-gray-100" : isBusy ? "bg-orange-100" : isOnline ? "bg-blue-100" : "bg-gray-200"
            }`}
          >
            {lockedByLayer1 ? <Lock className="w-5 h-5 text-gray-400" /> : isBusy ? "🔴" : isOnline ? "📹" : "📵"}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{to("title")}</p>
            <p className={`text-xs font-medium mt-0.5 ${
              lockedByLayer1 ? "text-gray-400" : isBusy ? "text-orange-600" : isOnline ? "text-blue-600" : "text-gray-400"
            }`}>
              {lockedByLayer1
                ? to("locked")
                : isBusy
                ? to("busy")
                : bufferLock && !isOnline
                ? to("bufferLocked")
                : isOnline
                ? to("active")
                : to("inactive")}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={toggle.isLoading || toggle.isLocked}
          title={lockedByLayer1 ? to("lockTitle") : undefined}
          aria-label={to("ariaLabel")}
          className={`relative w-14 h-7 min-h-[44px] rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            lockedByLayer1 ? "bg-gray-200 cursor-not-allowed" : isOnline ? "bg-blue-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
              isOnline && !lockedByLayer1 ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {lockedByLayer1 && (
        <p className="text-xs text-gray-400 mt-3 bg-white/60 rounded-lg px-3 py-1.5 border border-gray-200 flex items-center gap-1.5">
          <Lock className="w-3 h-3 shrink-0" />
          {to("lockBanner")}
        </p>
      )}
      {isOnline && !lockedByLayer1 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-1.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          {to("heartbeatWarning")}
        </div>
      )}
      {lockedByLayer3 && !lockedByLayer1 && !isOnline && (
        <div className="mt-3 flex items-center gap-2 text-xs text-yellow-700 bg-yellow-100 rounded-lg px-3 py-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
          </span>
          {to("bufferWarning")}
        </div>
      )}
    </div>
  );
}
