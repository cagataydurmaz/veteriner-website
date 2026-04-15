import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/cron/offline-inactive-vets
 * Runs every 5 minutes via Vercel Cron.
 * Sets is_online_now=false for vets whose heartbeat_at is older than 5 minutes.
 * This handles the case where the dashboard tab is closed without explicit logout.
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
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: staleVets, error: fetchErr } = await supabase
      .from("veterinarians")
      .select("id")
      .eq("is_online_now", true)
      .or(`heartbeat_at.is.null,heartbeat_at.lt.${staleThreshold}`);

    if (fetchErr) throw fetchErr;
    if (!staleVets || staleVets.length === 0) {
      return NextResponse.json({ ok: true, offlined: 0 });
    }

    const ids = staleVets.map((v: { id: string }) => v.id);
    const { error: updateErr } = await supabase
      .from("veterinarians")
      .update({ is_online_now: false })
      .in("id", ids);

    if (updateErr) throw updateErr;

    console.log(`[cron/offline-inactive-vets] Set ${ids.length} vet(s) offline: ${ids.join(", ")}`);
    return NextResponse.json({ ok: true, offlined: ids.length });
  } catch (err) {
    console.error("[cron/offline-inactive-vets]", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
