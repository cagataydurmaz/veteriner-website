/**
 * vetBroadcast — Server-side Neural Sync helper
 *
 * Fires a Supabase Realtime broadcast message to the `vet-status:{vetId}` channel
 * after every successful toggle write. The owner-side UI subscribes to this channel
 * and updates the vet's status indicator in <300ms — far faster than the ~1-2 s
 * latency of postgres_changes.
 *
 * Fire-and-forget: errors are swallowed and only logged so a failed broadcast
 * never blocks the API response.
 *
 * Channel format: `vet-status:{vetId}`
 * Event:          `status_change`
 * Payload:        { vetId, ...changedFields }
 */

export interface VetStatusPayload {
  vetId: string;
  is_online_now?:      boolean;
  is_available_today?: boolean;
  is_on_call?:         boolean;
  is_busy?:            boolean;
  buffer_lock?:        boolean;
}

/**
 * Broadcasts a vet status change to all connected owner-side subscribers.
 *
 * Uses the Supabase Realtime REST broadcast endpoint which accepts messages
 * without requiring a persistent WebSocket connection on the server.
 *
 * @param vetId   UUID of the veterinarian
 * @param changes Map of changed Layer-2 fields and their new values
 */
export async function broadcastVetStatus(
  vetId: string,
  changes: Omit<VetStatusPayload, "vetId">
): Promise<void> {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Gracefully degrade if env vars missing (local dev without Supabase)
  if (!supabaseUrl || !serviceKey) return;

  const payload: VetStatusPayload = { vetId, ...changes };

  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey":        serviceKey,
      },
      body: JSON.stringify({
        messages: [
          // Per-vet channel: consumed by VetStatusBar on the vet's own dashboard
          {
            topic:   `vet-status:${vetId}`,
            event:   "status_change",
            payload,
          },
          // Fan-out channel: consumed by VetListRealtimeSync on listing pages
          // Enables <300ms updates on nobetci-veteriner / veteriner-bul without
          // waiting for postgres_changes replication lag (~1-2 s).
          {
            topic:   "vet-status-changes",
            event:   "status_change",
            payload,
          },
        ],
      }),
    });
  } catch (err) {
    // Never block the API response — broadcast is best-effort
    console.warn("[vetBroadcast] failed for vet", vetId, err instanceof Error ? err.message : err);
  }
}
