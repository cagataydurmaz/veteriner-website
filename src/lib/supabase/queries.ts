/**
 * Cached Supabase query helpers — React `cache()` wrappers
 *
 * React's `cache()` deduplicates identical calls within the same React render
 * tree (per server request). If both the vet layout AND the dashboard page call
 * `getVetByUserId(userId)`, only one DB round-trip is made.
 *
 * Rules:
 *  - Only use these in Server Components / API Route Handlers
 *  - `cache()` scope is per-request — no cross-request stale data
 *  - Use `createClient()` (user-scoped) for reads; service client only for writes
 */
import { cache } from "react";
import { createClient } from "./server";

/**
 * Auth user — deduplicated per request.
 * Replaces repeated `supabase.auth.getUser()` calls in layout + page.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getUser();
});

/**
 * Vet profile — minimal fields needed by layout (status bar + nav guards).
 * Pages that need additional vet fields (e.g. bio, fees) should fetch them
 * separately with their own specific select.
 */
export const getVetByUserId = cache(async (userId: string) => {
  const supabase = await createClient();
  return supabase
    .from("veterinarians")
    .select(`
      id,
      account_status, suspended_until, suspension_reason, is_verified, rejection_reason,
      is_available_today, is_online_now, is_on_call,
      offers_in_person, offers_video, offers_nobetci,
      is_busy, buffer_lock,
      video_consultation_fee
    `)
    .eq("user_id", userId)
    .maybeSingle();
});

/**
 * Logged-in user record — only the fields used by Navbar and layout guards.
 * Replaces `select("*")` in vet/owner layouts.
 */
export const getUserById = cache(async (userId: string) => {
  const supabase = await createClient();
  return supabase
    .from("users")
    .select("id, full_name, email, role, phone, city, created_at, account_status, suspended_until, suspension_reason")
    .eq("id", userId)
    .maybeSingle();
});

/**
 * Unread notification count — deduplicated if layout + page both need it.
 */
export const getUnreadNotificationCount = cache(async (userId: string) => {
  const supabase = await createClient();
  return supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
});
