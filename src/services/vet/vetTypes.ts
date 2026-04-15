/**
 * vetTypes.ts — Strict types matching Supabase schema for the vet module.
 *
 * These types are the SINGLE SOURCE OF TRUTH for vet-related data shapes.
 * Every query, mutation, and component in the vet module references these.
 *
 * Column names use snake_case to match Supabase exactly.
 * UI-facing aliases (camelCase) are derived via mapping in hooks/components.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Layer Architecture Types
// ─────────────────────────────────────────────────────────────────────────────

/** Layer 1: Service permission flags (set via vet profile) */
export interface VetServicePermissions {
  offers_in_person: boolean;
  offers_video: boolean;
  offers_nobetci: boolean;
}

/** Layer 2: Intent toggles (set via toggle APIs) */
export interface VetIntentState {
  is_available_today: boolean;
  is_online_now: boolean;
  is_on_call: boolean;
}

/** Layer 3: Reality checks (managed by system — cron, appointment lifecycle) */
export interface VetRealityState {
  is_busy: boolean;
  buffer_lock: boolean;
}

/** Combined toggle state for the status bar and dashboard */
export interface VetToggleState
  extends VetServicePermissions,
    VetIntentState,
    VetRealityState {
  video_consultation_fee: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vet Profile & Dashboard Types
// ─────────────────────────────────────────────────────────────────────────────

/** Vet profile as returned by layout queries (getVetByUserId) */
export interface VetLayoutData extends VetToggleState {
  id: string;
  account_status: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  is_verified: boolean;
  rejection_reason: string | null;
}

/** Extended vet data for the dashboard page */
export interface VetDashboardProfile {
  id: string;
  is_verified: boolean;
  account_status: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  average_rating: number | null;
  total_reviews: number;
  offers_nobetci: boolean;
  offers_in_person: boolean;
  offers_video: boolean;
  is_online_now: boolean;
  video_consultation_fee: number | null;
  user: { full_name: string } | null;
}

/** Appointment row with nested relations (today's appointments query) */
export interface DashboardAppointmentRow {
  id: string;
  vet_id: string;
  owner_id: string;
  pet_id: string;
  datetime: string;
  type: string;
  appointment_type: string | null;
  status: string;
  payment_status: string | null;
  payment_amount: number | null;
  escrow_status: string | null;
  complaint: string | null;
  cancellation_reason: string | null;
  video_room_url: string | null;
  messaging_expires_at: string | null;
  created_at: string;
  pet: {
    name: string;
    species: string;
    allergies: string | null;
    chronic_conditions: string | null;
  } | null;
  owner: {
    full_name: string;
    phone: string | null;
  } | null;
}

/** Payment row from monthly revenue query */
export interface PaymentRow {
  amount: number;
  platform_commission: number | null;
  vet_payout: number | null;
  status: string;
}

/** Held payment row from escrow query */
export interface HeldPaymentRow {
  amount: number;
}

/** Last-visit context row */
export interface LastVisitRow {
  pet_id: string;
  datetime: string;
  medical_records: { vet_notes: string | null }[] | null;
}

/** Aggregated dashboard metrics */
export interface DashboardMetrics {
  todayAppointments: DashboardAppointmentRow[];
  monthlyCompleted: number;
  pendingCount: number;
  monthlyRevenue: number;
  monthlyCommission: number;
  monthlyNetPayout: number;
  pendingRevenue: number;
  lastVisitByPet: Record<string, { date: string; notes: string | null }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Types
// ─────────────────────────────────────────────────────────────────────────────

/** Toggle type identifiers matching API route names */
export type ToggleType = 'available' | 'online' | 'oncall';

/** API endpoint map for each toggle type */
export const TOGGLE_API_MAP: Record<ToggleType, string> = {
  available: '/api/vet/toggle-available',
  online: '/api/vet/toggle-online',
  oncall: '/api/vet/toggle-oncall',
} as const;

/** API request body key map for each toggle type */
export const TOGGLE_BODY_KEY_MAP: Record<ToggleType, string> = {
  available: 'available',
  online: 'online',
  oncall: 'oncall',
} as const;

/** DB column that each toggle type controls */
export const TOGGLE_DB_COLUMN_MAP: Record<ToggleType, keyof VetIntentState> = {
  available: 'is_available_today',
  online: 'is_online_now',
  oncall: 'is_on_call',
} as const;

/** Layer 1 permission required for each toggle */
export const TOGGLE_PERMISSION_MAP: Record<ToggleType, keyof VetServicePermissions> = {
  available: 'offers_in_person',
  online: 'offers_video',
  oncall: 'offers_nobetci',
} as const;

/** Toggle mutation response from API */
export interface ToggleMutationResponse {
  success?: boolean;
  error?: string;
  message?: string;
  warning?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Realtime Types
// ─────────────────────────────────────────────────────────────────────────────

/** Payload shape received from both broadcast and postgres_changes channels */
export interface VetStatusPayload {
  vetId?: string;
  // Layer 1: service permission flags (sent by profile route broadcast)
  offers_nobetci?: boolean;
  offers_in_person?: boolean;
  offers_video?: boolean;
  // Layer 2: intent toggles
  is_available_today?: boolean;
  is_online_now?: boolean;
  is_on_call?: boolean;
  // Layer 3: reality checks
  is_busy?: boolean;
  buffer_lock?: boolean;
}

/** Fields the realtime subscription tracks */
export type RealtimeVetField =
  | keyof VetServicePermissions
  | keyof VetIntentState
  | keyof VetRealityState;

/** All realtime-synced fields in one flat shape (Layers 1–3) */
export type VetRealtimeState = VetServicePermissions & VetIntentState & VetRealityState;

// ─────────────────────────────────────────────────────────────────────────────
// User Types (for layout)
// ─────────────────────────────────────────────────────────────────────────────

export interface VetUserData {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  city: string | null;
  created_at: string;
  account_status: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
}
