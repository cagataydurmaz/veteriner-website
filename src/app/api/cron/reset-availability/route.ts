import { alertCronFailure } from "@/lib/cron-alert";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Verify the request is from Vercel cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const results: Record<string, unknown> = {};

  // ── 1. Reset is_available_today for all vets (nightly) ───────────────────
  const { error } = await supabase
    .from("veterinarians")
    .update({ is_available_today: false })
    .eq("is_available_today", true);

  if (error) {
    console.error("[reset-availability] DB error:", error.message);
    await alertCronFailure("reset-availability", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  results.availability_reset = true;

  // ── 2. Prune stale blocked_slots (>30 days old) ────────────────────────
  const { data: cleanedBlocked } = await supabase
    .rpc("cleanup_stale_blocked_slots");
  results.blocked_slots_deleted = cleanedBlocked ?? 0;

  // ── 3. Expire pending appointments not confirmed within 48h ───────────
  const { data: expiredPending } = await supabase
    .rpc("expire_stale_pending_appointments");
  results.pending_appointments_expired = expiredPending ?? 0;

  console.log("[reset-availability]", results);
  return NextResponse.json({ ok: true, ...results });
}
