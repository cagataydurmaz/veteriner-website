import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/cron/check-flags
 *
 * MANUAL ADMIN TRIGGER ONLY — automatic cron scheduling removed.
 * Generates fraud_flag records for admin review.
 * Does NOT automatically suspend or ban any account.
 * Admins review flags via /admin/monitoring and take action manually.
 *
 * Requires: Authorization: Bearer <CRON_SECRET>
 *           or admin session (role=admin)
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Accept either cron secret OR an authenticated admin session
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isSecretAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isSecretAuth) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    const { data: userData } = await supabase
      .from("users").select("role").eq("id", user.id).maybeSingle();
    if (userData?.role !== "admin")
      return NextResponse.json({ error: "Yalnızca adminler bu işlemi yapabilir" }, { status: 403 });
  }

  const flags: { vetId: string; type: string; details: object }[] = [];

  try {
    // ── FLAG 1: Same vet-owner pair ≥2 cancellations, 0 completions ────────────
    const { data: cancelPairs } = await supabase
      .from("appointments")
      .select("vet_id, owner_id")
      .eq("status", "cancelled");

    if (cancelPairs) {
      const pairCounts: Record<string, { count: number; vetId: string; ownerId: string }> = {};
      for (const apt of cancelPairs) {
        const key = `${apt.vet_id}:${apt.owner_id}`;
        if (!pairCounts[key]) pairCounts[key] = { count: 0, vetId: apt.vet_id, ownerId: apt.owner_id };
        pairCounts[key].count++;
      }
      for (const pair of Object.values(pairCounts)) {
        if (pair.count < 2) continue;
        const { data: completed } = await supabase
          .from("appointments").select("id")
          .eq("vet_id", pair.vetId).eq("owner_id", pair.ownerId).eq("status", "completed").limit(1);
        if (!completed?.length) {
          flags.push({ vetId: pair.vetId, type: "repeated_cancellations_pair",
            details: { owner_id: pair.ownerId, cancellation_count: pair.count } });
        }
      }
    }

    // ── FLAG 2: Vet cancellation rate > 30% (min 5 appointments) ────────────
    const { data: verifiedVets } = await supabase
      .from("veterinarians").select("id").eq("is_verified", true);

    for (const vet of verifiedVets ?? []) {
      const { data: apts } = await supabase
        .from("appointments").select("status").eq("vet_id", vet.id);
      if (!apts || apts.length < 5) continue;
      const cancelled = apts.filter(a => a.status === "cancelled").length;
      const rate = cancelled / apts.length;
      if (rate > 0.3) {
        flags.push({ vetId: vet.id, type: "high_cancellation_rate",
          details: { total: apts.length, cancelled, rate_pct: Math.round(rate * 100) } });
      }
    }

    // ── FLAG 3: Verified vet > 30 days old, 0 completed appointments ────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldVets } = await supabase
      .from("veterinarians").select("id")
      .eq("is_verified", true).lt("created_at", thirtyDaysAgo);

    for (const vet of oldVets ?? []) {
      const { data: completed } = await supabase
        .from("appointments").select("id")
        .eq("vet_id", vet.id).eq("status", "completed").limit(1);
      if (!completed?.length) {
        flags.push({ vetId: vet.id, type: "no_completions_30days", details: {} });
      }
    }

    // ── Persist new flags — skip if an identical unresolved flag already exists ─
    let newFlagCount = 0;
    for (const flag of flags) {
      const { data: existing } = await supabase
        .from("fraud_flags").select("id")
        .eq("vet_id", flag.vetId).eq("flag_type", flag.type).eq("is_resolved", false)
        .maybeSingle();
      if (!existing) {
        await supabase.from("fraud_flags").insert({
          vet_id:    flag.vetId,
          flag_type: flag.type,
          details:   flag.details,
          // admin_notified stays false — no auto-messaging, admin checks dashboard
        });
        newFlagCount++;
      }
    }

    return NextResponse.json({
      success: true,
      vets_checked: verifiedVets?.length ?? 0,
      new_flags: newFlagCount,
      note: "Manual review only — no accounts were suspended or modified.",
    });
  } catch (err) {
    console.error("check-flags error:", err);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
