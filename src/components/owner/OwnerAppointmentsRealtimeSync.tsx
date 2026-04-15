"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Invisible client component dropped into the owner appointments Server Component.
 * Subscribes to Supabase Realtime for any appointments change belonging to this owner.
 * On any INSERT / UPDATE / DELETE → calls router.refresh() so the Server Component
 * re-fetches and the list is up-to-date without a manual page reload.
 *
 * Page Visibility guard: if the tab is hidden when a change arrives, the refresh
 * is deferred until the user returns to the tab. This prevents background
 * server re-renders that nobody sees.
 */
export function OwnerAppointmentsRealtimeSync({ ownerId }: { ownerId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let pendingRefresh = false;

    const doRefresh = () => {
      if (document.visibilityState !== "visible") {
        pendingRefresh = true;
        return;
      }
      router.refresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingRefresh) {
        pendingRefresh = false;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const channel = supabase
      .channel(`owner-apts-sync-${ownerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `owner_id=eq.${ownerId}`,
        },
        () => {
          doRefresh();
        }
      )
      .subscribe((status) => {
        // Missed events during a WebSocket reconnect → re-render to catch up
        if (status === "SUBSCRIBED") {
          doRefresh();
        }
      });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [ownerId, router]);

  return null;
}
