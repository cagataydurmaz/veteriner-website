"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Invisible client component dropped into the owner appointments Server Component.
 * Subscribes to Supabase Realtime for any appointments change belonging to this owner.
 * On any INSERT / UPDATE / DELETE → calls router.refresh() so the Server Component
 * re-fetches and the list is up-to-date without a manual page reload.
 */
export function OwnerAppointmentsRealtimeSync({ ownerId }: { ownerId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
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
          router.refresh();
        }
      )
      .subscribe((status) => {
        // Missed events during a WebSocket reconnect → re-render to catch up
        if (status === "SUBSCRIBED") {
          router.refresh();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerId, router]);

  return null;
}
