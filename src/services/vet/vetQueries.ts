/**
 * vetQueries.ts — Server-side read queries for the vet module.
 *
 * All Supabase SELECT operations that were previously scattered across
 * page.tsx and layout.tsx are consolidated here.
 *
 * Usage: import in Server Components (page.tsx, layout.tsx) only.
 * These functions use the request-scoped Supabase client (cookies-based).
 *
 * React cache() is applied at the query-helper level (queries.ts) for
 * per-request deduplication. Functions here compose those cached primitives
 * with dashboard-specific business logic.
 */

import { createClient } from '@/lib/supabase/server';
import type {
  VetDashboardProfile,
  DashboardAppointmentRow,
  PaymentRow,
  HeldPaymentRow,
  LastVisitRow,
  DashboardMetrics,
} from './vetTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Metrics (extracted from dashboard/page.tsx lines 64-148)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the vet's extended profile for the dashboard header.
 * Includes rating, review count, and service flags.
 */
export async function getVetDashboardProfile(
  userId: string
): Promise<VetDashboardProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('veterinarians')
    .select(
      `id, is_verified, account_status, suspended_until, suspension_reason,
       average_rating, total_reviews, offers_nobetci,
       is_online_now, offers_video, video_consultation_fee,
       user:users!veterinarians_user_id_fkey(full_name)`
    )
    .eq('user_id', userId)
    .maybeSingle();

  return data as VetDashboardProfile | null;
}

/**
 * Fetches all dashboard metrics in a single parallel batch.
 * This replaces the 5-query Promise.all in dashboard/page.tsx.
 */
export async function getDashboardMetrics(
  vetId: string
): Promise<DashboardMetrics> {
  const supabase = await createClient();

  // Istanbul time boundaries
  const now = new Date();
  const istOffset = 3 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const today = istNow.toISOString().split('T')[0];

  const monthStart = new Date(istNow.getFullYear(), istNow.getMonth(), 1);
  const monthStartIso = monthStart.toISOString();

  // ── Parallel batch: 5 queries ──────────────────────────────────────────
  const [
    { data: todayApts },
    { count: monthlyCompleted },
    { count: pendingCount },
    { data: payments },
    { data: heldPayments },
  ] = await Promise.all([
    // 1. Today's appointments with relations
    supabase
      .from('appointments')
      .select(
        `*, pet:pets(name, species, allergies, chronic_conditions),
         owner:users(full_name, phone)`
      )
      .eq('vet_id', vetId)
      .gte('datetime', `${today}T00:00:00`)
      .lt('datetime', `${today}T23:59:59`)
      .order('datetime', { ascending: true }),

    // 2. Monthly completed count
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('vet_id', vetId)
      .gte('datetime', monthStartIso)
      .eq('status', 'completed'),

    // 3. Pending count
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('vet_id', vetId)
      .eq('status', 'pending'),

    // 4. Monthly payments (success + released)
    supabase
      .from('payments')
      .select('amount, platform_commission, vet_payout, status')
      .eq('vet_id', vetId)
      .gte('created_at', monthStartIso)
      .in('status', ['success', 'released']),

    // 5. Held payments (escrow)
    supabase
      .from('payments')
      .select('amount', { count: 'exact' })
      .eq('vet_id', vetId)
      .eq('status', 'held'),
  ]);

  // ── Revenue calculations ───────────────────────────────────────────────
  const paymentRows = (payments ?? []) as PaymentRow[];
  const heldRows = (heldPayments ?? []) as HeldPaymentRow[];

  const monthlyRevenue = paymentRows.reduce((s, p) => s + (p.amount || 0), 0);
  const monthlyCommission = paymentRows.reduce(
    (s, p) => s + (p.platform_commission ?? Math.round(p.amount * 0.15)),
    0
  );
  const monthlyNetPayout = paymentRows.reduce(
    (s, p) => s + (p.vet_payout ?? p.amount - (p.platform_commission ?? Math.round(p.amount * 0.15))),
    0
  );
  const pendingRevenue = heldRows.reduce((s, p) => s + (p.amount || 0), 0);

  // ── Last visit context ─────────────────────────────────────────────────
  const todayAppointments = (todayApts ?? []) as DashboardAppointmentRow[];
  const todayPetIds = [...new Set(todayAppointments.map((a) => a.pet_id).filter(Boolean))];

  let lastVisitByPet: Record<string, { date: string; notes: string | null }> = {};

  if (todayPetIds.length > 0) {
    const { data: lastVisits } = await supabase
      .from('appointments')
      .select('pet_id, datetime, medical_records(vet_notes)')
      .in('pet_id', todayPetIds)
      .eq('status', 'completed')
      .neq('vet_id', vetId)
      .order('datetime', { ascending: false })
      .limit(todayPetIds.length * 5);

    const visitRows = (lastVisits ?? []) as LastVisitRow[];
    const seen = new Set<string>();
    for (const row of visitRows) {
      if (!seen.has(row.pet_id)) {
        seen.add(row.pet_id);
        const notes =
          row.medical_records && row.medical_records.length > 0
            ? row.medical_records[0].vet_notes
            : null;
        lastVisitByPet[row.pet_id] = { date: row.datetime, notes };
      }
    }
  }

  return {
    todayAppointments,
    monthlyCompleted: monthlyCompleted ?? 0,
    pendingCount: pendingCount ?? 0,
    monthlyRevenue,
    monthlyCommission,
    monthlyNetPayout,
    pendingRevenue,
    lastVisitByPet,
  };
}
