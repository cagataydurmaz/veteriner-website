/**
 * useVetToggle.ts — Universal toggle hook for vet status switches.
 *
 * Replaces the 5 duplicate toggle implementations across:
 *   VetStatusBar (3 toggles), DashboardMasterToggle (1), OnlineToggle (1),
 *   OnCallToggle (1), AvailabilityToggle (1).
 *
 * Handles:
 *   1. 3-layer lock checks (Layer 1: permission, Layer 3: busy/buffer)
 *   2. Optimistic UI with automatic rollback on failure
 *   3. API mutation via vetMutations.toggleVetStatus()
 *   4. Heartbeat management for the "online" toggle
 *   5. Toast notifications for success/error/warning
 *   6. Debounce protection against rapid double-clicks
 *
 * Usage:
 *   const toggle = useVetToggle({
 *     type: 'online',
 *     vetId: 'uuid',
 *     realtimeValue: status.is_online_now,  // from useVetRealtime
 *     layer1Enabled: status.offers_video,
 *     isBusy: status.is_busy,
 *     bufferLock: status.buffer_lock,
 *   });
 *   // toggle.value — current boolean
 *   // toggle.fire() — execute toggle
 *   // toggle.isLocked — Layer 1 or Layer 3 blocks
 *   // toggle.lockReason — human-readable reason
 *   // toggle.isLoading — API in flight
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { toggleVetStatus, sendHeartbeat } from '@/services/vet/vetMutations';
import { optimisticUpdate } from '@/hooks/useVetRealtime';
import type { ToggleType } from '@/services/vet/vetTypes';
import { TOGGLE_DB_COLUMN_MAP } from '@/services/vet/vetTypes';
import { t } from '@/lib/i18n/tr';

// ─────────────────────────────────────────────────────────────────────────────
// Lock reason messages (i18n-ready — extracted Turkish strings)
// ─────────────────────────────────────────────────────────────────────────────

const LOCK_MESSAGES: Record<ToggleType, {
  layer1: string;
  busy: string;
  buffer: string;
}> = {
  available: {
    layer1: t('toggle.available.layer1'),
    busy: t('toggle.available.busy'),
    buffer: t('toggle.available.buffer'),
  },
  online: {
    layer1: t('toggle.online.layer1'),
    busy: t('toggle.online.busy'),
    buffer: t('toggle.online.buffer'),
  },
  oncall: {
    layer1: t('toggle.oncall.layer1'),
    busy: t('toggle.oncall.busy'),
    buffer: t('toggle.oncall.buffer'),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Config interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UseVetToggleConfig {
  /** Which toggle: 'available' | 'online' | 'oncall' */
  type: ToggleType;

  /** Vet UUID — used for optimistic store updates */
  vetId: string;

  /** Current value from useVetRealtime (reactive) */
  realtimeValue: boolean;

  /** Layer 1: Is the service enabled in profile? */
  layer1Enabled: boolean;

  /** Layer 3: Is the vet in an active consultation? */
  isBusy: boolean;

  /** Layer 3: Is the buffer lock active? (30-min window) */
  bufferLock: boolean;
}

export interface UseVetToggleReturn {
  /** Current toggle value (optimistic during API flight, then realtime) */
  value: boolean;

  /** Execute the toggle (flip current value) */
  fire: () => void;

  /** Is the toggle locked (Layer 1 or Layer 3)? */
  isLocked: boolean;

  /** Human-readable lock reason (empty string if not locked) */
  lockReason: string;

  /** Is an API call in flight? */
  isLoading: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat interval (ms)
// ─────────────────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Hook implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useVetToggle(config: UseVetToggleConfig): UseVetToggleReturn {
  const { type, vetId, realtimeValue, layer1Enabled, isBusy, bufferLock } = config;

  const [isLoading, setIsLoading] = useState(false);
  // Optimistic value — null means "use realtimeValue"
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const inflightRef = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Effective value: optimistic overrides realtime during API flight ────
  const value = optimistic !== null ? optimistic : realtimeValue;

  // ── Clear optimistic state when realtime catches up ────────────────────
  useEffect(() => {
    if (optimistic !== null && realtimeValue === optimistic) {
      setOptimistic(null);
    }
  }, [realtimeValue, optimistic]);

  // ── Heartbeat management for "online" toggle ──────────────────────────
  useEffect(() => {
    if (type !== 'online') return;

    // Start heartbeat when online, stop when offline
    if (value) {
      if (!heartbeatRef.current) {
        heartbeatRef.current = setInterval(() => {
          sendHeartbeat();
        }, HEARTBEAT_INTERVAL);
      }
    } else {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [type, value]);

  // ── Lock computation ──────────────────────────────────────────────────
  const messages = LOCK_MESSAGES[type];
  let isLocked = false;
  let lockReason = '';

  // Layer 1: Service not enabled in profile
  if (!layer1Enabled) {
    isLocked = true;
    lockReason = messages.layer1;
  }

  // Layer 3: Active consultation blocks turning ON (turning OFF always allowed)
  if (!isLocked && !value && isBusy) {
    isLocked = true;
    lockReason = messages.busy;
  }

  // Layer 3: Buffer lock blocks turning ON for online and oncall (not available)
  if (!isLocked && !value && bufferLock && messages.buffer) {
    isLocked = true;
    lockReason = messages.buffer;
  }

  // ── Fire toggle ───────────────────────────────────────────────────────
  const fire = useCallback(() => {
    // Prevent double-fire
    if (inflightRef.current || isLoading) return;

    // Lock checks (show toast and return)
    if (!layer1Enabled) {
      toast.error(messages.layer1);
      return;
    }
    // Layer 3 checks only block turning ON
    const targetValue = !value;
    if (targetValue && isBusy) {
      toast.error(messages.busy);
      return;
    }
    if (targetValue && bufferLock && messages.buffer) {
      toast.error(messages.buffer);
      return;
    }

    // ── Optimistic update ─────────────────────────────────────────────
    inflightRef.current = true;
    setIsLoading(true);
    setOptimistic(targetValue);

    // Push to shared realtime store so other components see the change instantly
    const dbColumn = TOGGLE_DB_COLUMN_MAP[type];
    optimisticUpdate(vetId, { [dbColumn]: targetValue });

    // ── API call ──────────────────────────────────────────────────────
    toggleVetStatus(type, targetValue)
      .then((response) => {
        if (!response.success) {
          // Rollback optimistic state
          setOptimistic(!targetValue);
          optimisticUpdate(vetId, { [dbColumn]: !targetValue });
          toast.error(response.error ?? 'Toggle failed');
        } else {
          if (response.warning) {
            toast.warning(response.warning);
          }
          if (response.message) {
            toast.success(response.message);
          }
        }
      })
      .catch(() => {
        // Rollback on network error
        setOptimistic(!targetValue);
        optimisticUpdate(vetId, { [dbColumn]: !targetValue });
        toast.error(t('common.networkError'));
      })
      .finally(() => {
        setIsLoading(false);
        inflightRef.current = false;
      });
  }, [type, vetId, value, layer1Enabled, isBusy, bufferLock, isLoading, messages]);

  return {
    value,
    fire,
    isLocked,
    lockReason,
    isLoading,
  };
}
