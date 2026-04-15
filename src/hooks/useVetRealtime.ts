/**
 * useVetRealtime.ts — Shared dual-channel realtime subscription hook.
 *
 * Replaces the 5 separate Supabase channel subscriptions that were duplicated
 * across VetStatusBar, DashboardMasterToggle, OnlineToggle, OnCallToggle,
 * and AvailabilityToggle.
 *
 * Architecture:
 *   Channel 1: postgres_changes (UPDATE on veterinarians) — reliable ~1-2s
 *   Channel 2: broadcast (vet-status:{vetId}) — fast <300ms, API-driven
 *
 * Both channels feed into the same state reducer, giving components
 * a single reactive `VetRealtimeState` object.
 *
 * Usage:
 *   const status = useVetRealtime(vetId, initialState);
 *   // status.is_online_now, status.is_busy, etc. — always fresh
 */

'use client';

import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { VetRealtimeState, VetStatusPayload } from '@/services/vet/vetTypes';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared store per vetId (singleton pattern via module-level Map)
// ─────────────────────────────────────────────────────────────────────────────

interface RealtimeStore {
  state: VetRealtimeState;
  listeners: Set<() => void>;
  refCount: number;
  channels: RealtimeChannel[];
  /** Pending teardown timer — cancelled if a new subscriber mounts before it fires */
  teardownTimer: ReturnType<typeof setTimeout> | null;
}

const stores = new Map<string, RealtimeStore>();

function getOrCreateStore(vetId: string, initial: VetRealtimeState): RealtimeStore {
  let store = stores.get(vetId);
  if (!store) {
    store = {
      state: { ...initial },
      listeners: new Set(),
      refCount: 0,
      channels: [],
      teardownTimer: null,
    };
    stores.set(vetId, store);
  }
  return store;
}

function emitChange(store: RealtimeStore): void {
  for (const listener of store.listeners) {
    listener();
  }
}

function applyPayload(store: RealtimeStore, payload: VetStatusPayload): void {
  let changed = false;
  const fields: (keyof VetRealtimeState)[] = [
    // Layer 1 — service permissions (updated via profile route broadcast)
    'offers_nobetci',
    'offers_in_person',
    'offers_video',
    // Layer 2 — intent toggles
    'is_available_today',
    'is_online_now',
    'is_on_call',
    // Layer 3 — reality checks
    'is_busy',
    'buffer_lock',
  ];

  for (const key of fields) {
    if (key in payload && payload[key] !== undefined && payload[key] !== store.state[key]) {
      (store.state as unknown as Record<string, boolean>)[key] = payload[key] as boolean;
      changed = true;
    }
  }

  if (changed) {
    // Create a new object reference so useSyncExternalStore detects the change
    store.state = { ...store.state };
    emitChange(store);
  }
}

function setupChannels(vetId: string, store: RealtimeStore): void {
  const supabase = createClient();

  // ── Channel 1: postgres_changes (reliable fallback, ~1-2s latency) ────
  const pgChannel = supabase
    .channel(`vet-rt-pg-${vetId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'veterinarians',
        filter: `id=eq.${vetId}`,
      },
      (payload) => {
        if (payload.new) {
          applyPayload(store, payload.new as VetStatusPayload);
        }
      }
    )
    .subscribe();

  // ── Channel 2: broadcast (fast path, <300ms, API-driven) ──────────────
  const broadcastChannel = supabase
    .channel(`vet-status:${vetId}`)
    .on('broadcast', { event: 'status_change' }, ({ payload }) => {
      if (payload) {
        applyPayload(store, payload as VetStatusPayload);
      }
    })
    .subscribe();

  store.channels = [pgChannel, broadcastChannel];
}

function teardownChannels(vetId: string, store: RealtimeStore): void {
  const supabase = createClient();
  for (const channel of store.channels) {
    supabase.removeChannel(channel);
  }
  store.channels = [];
  stores.delete(vetId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to real-time vet status changes.
 *
 * Uses a shared store per vetId — multiple components subscribing to the same
 * vetId share a single pair of Supabase channels (ref-counted).
 *
 * @param vetId    The veterinarian's UUID
 * @param initial  Initial state (from server-rendered props)
 * @returns        Reactive VetRealtimeState, always up-to-date
 */
export function useVetRealtime(
  vetId: string,
  initial: VetRealtimeState
): VetRealtimeState {
  const storeRef = useRef<RealtimeStore | null>(null);

  // Initialize store on first render
  if (!storeRef.current) {
    storeRef.current = getOrCreateStore(vetId, initial);
  }

  // Setup/teardown channels with ref counting + grace period
  useEffect(() => {
    const store = getOrCreateStore(vetId, initial);
    storeRef.current = store;

    // Cancel any pending teardown — this new subscriber keeps the store alive
    if (store.teardownTimer) {
      clearTimeout(store.teardownTimer);
      store.teardownTimer = null;
    }

    store.refCount += 1;
    if (store.refCount === 1 && store.channels.length === 0) {
      // First subscriber (or re-subscriber after graceful teardown) — create channels
      setupChannels(vetId, store);
    }

    return () => {
      store.refCount -= 1;
      if (store.refCount === 0) {
        // Last subscriber left — delay teardown by 3 s to survive quick
        // unmount/remount cycles (React StrictMode, page transitions).
        store.teardownTimer = setTimeout(() => {
          store.teardownTimer = null;
          teardownChannels(vetId, store);
        }, 3_000);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vetId]);

  // Subscribe to state changes via useSyncExternalStore
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const store = storeRef.current;
      if (!store) return () => {};
      store.listeners.add(onStoreChange);
      return () => {
        store.listeners.delete(onStoreChange);
      };
    },
    []
  );

  const getSnapshot = useCallback(() => {
    return storeRef.current?.state ?? initial;
  }, [initial]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ─────────────────────────────────────────────────────────────────────────────
// Imperative update (for optimistic UI in useVetToggle)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optimistically update the shared store from outside the subscription.
 * Used by useVetToggle to push optimistic state before the API responds.
 */
export function optimisticUpdate(
  vetId: string,
  patch: Partial<VetRealtimeState>
): void {
  const store = stores.get(vetId);
  if (!store) return;
  applyPayload(store, patch as VetStatusPayload);
}
