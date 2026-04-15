"use client";

/**
 * NewAppointmentListener — invisible client component mounted inside the
 * vet dashboard (Server Component).
 *
 * Listens to the `appointments` table via Supabase postgres_changes for:
 *   • INSERT  → new booking arrived
 *   • UPDATE  → status changed to "cancelled" OR datetime changed (reschedule)
 *
 * For each event:
 *   1. Shows a toast with date/time and a "Görüntüle" action
 *   2. Calls router.refresh() so the RSC page re-fetches the schedule
 *
 * Page Visibility handling:
 *   When the mobile browser brings the tab back to the foreground the
 *   WebSocket may have been suspended by the OS. We tear down and rebuild
 *   the channel on every "visible" transition so the vet never misses
 *   an event that arrived while the app was backgrounded.
 *
 * Architecture note: postgres_changes is preferred over broadcast channels
 * because the INSERTs/UPDATEs originate from the owner's client (or server
 * actions) — not from a server action we control. Latency is ~1-2 s.
 */

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/tr";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface Props {
  vetId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDateTime(isoString: string): { dateStr: string; timeStr: string } {
  const dt = new Date(isoString);
  return {
    dateStr: dt.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }),
    timeStr: dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function NewAppointmentListener({ vetId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Keep a ref to the active channel so the visibility handler can tear it down
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Subscribe / resubscribe ───────────────────────────────────────────────
  const subscribe = useCallback(() => {
    // Clean up any existing subscription first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`apt-listener-vet-${vetId}-${Date.now()}`)
      // ── New booking ───────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `vet_id=eq.${vetId}`,
        },
        (payload) => {
          const apt = payload.new as { datetime: string };
          if (!apt?.datetime) return;

          const { dateStr, timeStr } = formatDateTime(apt.datetime);

          toast.success(
            t("dashboard.newAppointmentToast", { date: dateStr, time: timeStr }),
            {
              duration: 10_000,
              action: {
                label: t("dashboard.viewAppointment"),
                onClick: () => router.push("/vet/appointments"),
              },
            }
          );

          router.refresh();
        }
      )
      // ── Cancellation or reschedule ────────────────────────────────────────
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `vet_id=eq.${vetId}`,
        },
        (payload) => {
          const prev = payload.old as { datetime?: string; status?: string };
          const next = payload.new as { datetime: string; status: string };

          if (!next?.datetime) return;

          const { dateStr, timeStr } = formatDateTime(next.datetime);

          // Status flipped to cancelled
          if (next.status === "cancelled" && prev.status !== "cancelled") {
            toast.warning(
              t("dashboard.appointmentCancelled", { date: dateStr, time: timeStr }),
              {
                duration: 8_000,
                action: {
                  label: t("dashboard.viewAppointment"),
                  onClick: () => router.push("/vet/appointments"),
                },
              }
            );
            router.refresh();
            return;
          }

          // Datetime shifted (reschedule) — only notify for non-cancelled appointments
          if (
            next.status !== "cancelled" &&
            prev.datetime &&
            prev.datetime !== next.datetime
          ) {
            toast.info(
              t("dashboard.appointmentRescheduled", { date: dateStr, time: timeStr }),
              {
                duration: 8_000,
                action: {
                  label: t("dashboard.viewAppointment"),
                  onClick: () => router.push("/vet/appointments"),
                },
              }
            );
            router.refresh();
          }
        }
      )
      // ── Physical row deletion (admin cleanup / hard-delete) ──────────────
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "appointments",
          filter: `vet_id=eq.${vetId}`,
        },
        (payload) => {
          // payload.old contains the deleted row; payload.new is empty for DELETEs
          const deleted = payload.old as { datetime?: string };
          const isoStr = deleted?.datetime;
          if (!isoStr) {
            router.refresh();
            return;
          }

          const { dateStr, timeStr } = formatDateTime(isoStr);
          toast.warning(
            t("dashboard.appointmentDeleted", { date: dateStr, time: timeStr }),
            {
              duration: 8_000,
              action: {
                label: t("dashboard.viewAppointment"),
                onClick: () => router.push("/vet/appointments"),
              },
            }
          );
          router.refresh();
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [vetId, router, supabase]);

  // ── Initial subscription ──────────────────────────────────────────────────
  useEffect(() => {
    subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // subscribe is stable (useCallback with stable deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vetId]);

  // ── Page Visibility: reconnect when tab returns to foreground ────────────
  // Mobile OS (especially iOS Safari) suspends WebSocket connections when the
  // browser is backgrounded. On every "visible" transition we:
  //   1. Tear down the stale channel
  //   2. Open a fresh subscription (new channel name avoids server-side dedup)
  //   3. Call router.refresh() to pull any events we missed while suspended
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      // Silently refresh — no toast for the reconnect itself (too noisy)
      subscribe();
      router.refresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  // router is a stable ref; subscribe is memoised
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);

  // Purely reactive — no UI to render
  return null;
}
