import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/vet/heartbeat
 * Called every 60 seconds from the vet dashboard while the tab is open.
 * Updates heartbeat_at. The cron job /api/cron/offline-inactive-vets
 * checks this field and sets is_online_now=false if stale for >5 minutes.
 *
 * IMPORTANT: heartbeat_at is a Layer 3 system column protected by RLS WITH CHECK.
 * The user-scoped client cannot write it — service_role client must be used here.
 * Auth is still verified via the user client; only the write uses service_role.
 */
export async function POST() {
  try {
    // Authenticate with user-scoped client (RLS-aware)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    // Write heartbeat_at via service_role — Layer 3 column, blocked by client RLS
    const service = createServiceClient();
    const { error } = await service
      .from("veterinarians")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[heartbeat]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
