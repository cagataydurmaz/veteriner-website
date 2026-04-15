"use client";

/**
 * OwnerAppointmentDetailSync — invisible client component for the single
 * appointment detail page (/owner/appointments/[id]).
 *
 * Why this exists:
 *   The detail page is a pure RSC (Server Component). Without a realtime
 *   subscription the owner sees a static snapshot — status changes (vet
 *   confirms, cancels, completes) and payment updates never appear until the
 *   owner manually refreshes.
 *
 * What it does:
 *   1. Subscribes to postgres_changes UPDATE on appointments WHERE id = appointmentId.
 *   2. On any UPDATE → calls router.refresh() so the RSC re-fetches and the
 *      page reflects the latest status, payment, and notes fields.
 *   3. On SUBSCRIBED status → immediate refresh to catch any event that arrived
 *      between the initial SSR render and the WS handshake.
 *   4. Page Visibility → resubscribes on tab-foreground (same pattern as
 *      NewAppointmentListener) so mobile users get live updates after backgrounding.
 */

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface Props {
  appointmentId: string;
}

export default function OwnerAppointmentDetailSync({ appointmentId }: Props) {
  const router = useRouter();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  const subscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`owner-apt-detail-${appointmentId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${appointmentId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe((status) => {
        // Catch any UPDATE that arrived between SSR render and WS handshake
        if (status === "SUBSCRIBED") {
          router.refresh();
        }
      });

    channelRef.current = channel;
  }, [appointmentId, router, supabase]);

  // Initial subscription
  useEffect(() => {
    subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  // Page Visibility: resubscribe when tab comes back to foreground
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        subscribe();
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);

  return null;
}
