"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Invisible client component dropped into the veterinerler / veteriner-bul Server Components.
 *
 * Dual-channel Neural Sync:
 *   1. `broadcast` on "vet-status-changes" — <300ms, fires after every toggle via
 *      vetBroadcast.ts fan-out message. This is the fast path.
 *   2. `postgres_changes` on veterinarians UPDATE — ~1-2s, reliable fallback that
 *      also catches admin / cron writes the broadcast doesn't cover.
 *
 * Both paths call router.refresh(), which re-renders the SSR listing with
 * fresh availability badges. Changes are deduplicated: two refreshes within
 * the debounce window collapse into one network round-trip.
 */
export function VetListRealtimeSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Debounce: prevents a burst of rapid toggles from firing multiple refreshes
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => router.refresh(), 120);
    };

    const channel = supabase
      .channel("vet-list-availability-sync")
      // ── Fast path: broadcast (<300ms) ──────────────────────────────────────
      .on(
        "broadcast",
        { event: "status_change" },
        () => { scheduleRefresh(); }
      )
      // ── Reliable path: postgres_changes (~1-2s) ────────────────────────────
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
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
