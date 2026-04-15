"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Invisible client component dropped into the veterinerler / veteriner-bul Server Components.
 *
 * Dual-channel Neural Sync — revised architecture:
 *
 *   1. `broadcast` on "vet-status-changes" — <300ms, fires after every toggle via
 *      vetBroadcast.ts fan-out message.
 *      → Dispatches a `vet:status-change` CustomEvent on `window`.
 *      → Client components (VetCityFilterClient etc.) listen for this event and
 *        apply status overrides to their local state — zero server round-trips.
 *
 *   2. `postgres_changes` on veterinarians UPDATE — ~1-2s, reliable fallback that
 *      also catches admin / cron writes the broadcast doesn't cover.
 *      → Calls router.refresh(), but only when the tab is visible.
 *        If the tab is hidden, the refresh is deferred until it becomes visible again
 *        to avoid triggering server re-renders while the user isn't watching.
 *
 * This design eliminates the "Thundering Herd" problem for rapid toggle events:
 * every subscriber updates client-side instead of hammering the server.
 */

/** Shape of the payload dispatched via the window event. */
export interface VetStatusChangeDetail {
  vetId: string;
  is_online_now?: boolean;
  is_available_today?: boolean;
  is_on_call?: boolean;
  is_busy?: boolean;
  buffer_lock?: boolean;
}

export function VetListRealtimeSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Debounced router.refresh() — collapses bursts of postgres_changes into one call
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    // Flag: a postgres_changes refresh was requested while the tab was hidden
    let pendingRefresh = false;

    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") {
        // Tab is in background — defer until the user returns
        pendingRefresh = true;
        return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => router.refresh(), 300);
    };

    // Flush any deferred refresh when the tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingRefresh) {
        pendingRefresh = false;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const channel = supabase
      .channel("vet-list-availability-sync")

      // ── Fast path: broadcast (<300ms) ──────────────────────────────────────
      // Dispatch a window event so client components can update locally
      // without triggering a server re-render.
      .on(
        "broadcast",
        { event: "status_change" },
        ({ payload }) => {
          if (payload?.vetId) {
            window.dispatchEvent(
              new CustomEvent<VetStatusChangeDetail>("vet:status-change", {
                detail: payload as VetStatusChangeDetail,
              })
            );
          }
        }
      )

      // ── Reliable path: postgres_changes (~1-2s) ────────────────────────────
      // Catches cron / admin writes that don't go through the broadcast path.
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "veterinarians",
        },
        (payload) => {
          const prev = payload.old as Record<string, unknown>;
          const next = payload.new as Record<string, unknown>;

          const availabilityChanged =
            prev.is_online_now      !== next.is_online_now      ||
            prev.is_available_today !== next.is_available_today  ||
            prev.is_on_call         !== next.is_on_call          ||
            prev.is_busy            !== next.is_busy;

          if (availabilityChanged) scheduleRefresh();
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
