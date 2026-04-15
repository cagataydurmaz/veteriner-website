import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/cron/recompute-buffer-locks
 * Runs every 5 minutes via Vercel Cron.
 *
 * Recomputes buffer_lock for ALL vets:
 *   - Sets buffer_lock=true  if vet has a pending/confirmed appointment in ±30 min window
 *   - Sets buffer_lock=false if no such appointment exists (clears stale locks)
 *
 * This ensures buffer_lock is self-healing — it doesn't require every booking path
 * to manually clear the lock when the 30-min window passes.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const supabase = createServiceClient();
    const now         = new Date();
    const windowStart = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    // Get all vet IDs that have an appointment in the ±30 min window
    const { data: busyVets } = await supabase
      .from("appointments")
      .select("vet_id")
      .in("status", ["pending", "confirmed"])
      .gte("datetime", windowStart)
      .lte("datetime", windowEnd);

    const busyVetIds = [...new Set((busyVets || []).map((a: { vet_id: string }) => a.vet_id))];

    // Set buffer_lock=true for vets IN the window
    if (busyVetIds.length > 0) {
      await supabase
        .from("veterinarians")
        .update({ buffer_lock: true })
        .in("id", busyVetIds);
    }

    // Set buffer_lock=false for all vets NOT in the window (self-healing)
    const clearQuery = supabase
      .from("veterinarians")
      .update({ buffer_lock: false })
      .eq("buffer_lock", true); // only update those currently locked (avoids unnecessary writes)

    if (busyVetIds.length > 0) {
      // PostgREST expects UUIDs without quotes: (uuid1,uuid2,...)
      await clearQuery.not("id", "in", `(${busyVetIds.join(",")})`);
    } else {
      await clearQuery;
    }

    return NextResponse.json({ ok: true, locked: busyVetIds.length });
  } catch (err) {
    console.error("[cron/recompute-buffer-locks]", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
