/**
 * vetMutations.ts — Client-side write operations for the vet module.
 *
 * All API calls that mutate vet state are consolidated here.
 * Components import these instead of inlining fetch() calls.
 *
 * Usage: import in Client Components ('use client') and hooks.
 *
 * Every function:
 *   1. Sends a typed request to the API route
 *   2. Returns a typed response (success/error/message)
 *   3. Never throws — errors are returned in the response shape
 */

import {
  type ToggleType,
  type ToggleMutationResponse,
  TOGGLE_API_MAP,
  TOGGLE_BODY_KEY_MAP,
} from './vetTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic toggle mutation. Covers all 3 toggle types:
 *   - available → POST /api/vet/toggle-available { available: boolean }
 *   - online   → POST /api/vet/toggle-online    { online: boolean }
 *   - oncall   → POST /api/vet/toggle-oncall     { oncall: boolean }
 */
export async function toggleVetStatus(
  type: ToggleType,
  value: boolean
): Promise<ToggleMutationResponse> {
  try {
    const url = TOGGLE_API_MAP[type];
    const bodyKey = TOGGLE_BODY_KEY_MAP[type];

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [bodyKey]: value }),
    });

    const data = (await res.json()) as ToggleMutationResponse;

    if (!res.ok) {
      return {
        success: false,
        error: data.error ?? `Toggle failed (${res.status})`,
        message: data.message,
      };
    }

    return {
      success: true,
      message: data.message,
      warning: data.warning,
    };
  } catch {
    return {
      success: false,
      error: 'Network error — please check your connection.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ping the heartbeat endpoint to keep the online session alive.
 * Called every 60s while is_online_now = true.
 * If heartbeat stops, cron sets is_online_now = false after 5 min.
 */
export async function sendHeartbeat(): Promise<boolean> {
  try {
    const res = await fetch('/api/vet/heartbeat', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Appointment Actions
// ─────────────────────────────────────────────────────────────────────────────

export interface AppointmentActionResponse {
  success?: boolean;
  error?: string;
  message?: string;
}

/**
 * Vet confirms a pending appointment.
 */
export async function confirmAppointment(
  appointmentId: string
): Promise<AppointmentActionResponse> {
  try {
    const res = await fetch('/api/vet/confirm-appointment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId }),
    });
    const data = (await res.json()) as AppointmentActionResponse;
    if (!res.ok) return { success: false, error: data.error ?? 'Confirm failed' };
    return { success: true, message: data.message };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Vet cancels an appointment.
 */
export async function cancelAppointment(
  appointmentId: string,
  reason?: string
): Promise<AppointmentActionResponse & { refunded?: boolean }> {
  try {
    const res = await fetch('/api/vet/cancel-appointment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId, reason }),
    });
    const data = (await res.json()) as AppointmentActionResponse & { refunded?: boolean };
    if (!res.ok) return { success: false, error: data.error ?? 'Cancel failed' };
    return { success: true, message: data.message, refunded: data.refunded };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Vet completes an appointment with optional consultation notes.
 */
export async function completeAppointment(
  appointmentId: string,
  consultationNotes?: {
    genel_durum: string;
    bulgular?: string | null;
    oneri?: string | null;
    ilac_notu?: string | null;
    takip_gunu?: number | null;
  }
): Promise<AppointmentActionResponse & {
  escrow_released?: boolean;
  amount?: number;
  vet_payout?: number;
}> {
  try {
    const res = await fetch('/api/appointments/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId, consultationNotes }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) return { success: false, error: (data.error as string) ?? 'Complete failed' };
    return {
      success: true,
      message: data.message as string,
      escrow_released: data.escrow_released as boolean,
      amount: data.amount as number,
      vet_payout: data.vet_payout as number,
    };
  } catch {
    return { success: false, error: 'Network error' };
  }
}
