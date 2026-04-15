import { NextResponse } from "next/server";

/**
 * GET /api/cron/nobetci-timeout  — DISABLED
 *
 * The 90-second pre-auth timeout cron is no longer needed.
 * The instant_requests / pre-auth flow was removed in the MVP refactor.
 * Nöbetçi is now a simple is_online_now directory.
 */
export async function GET() {
  return NextResponse.json({ disabled: true, reason: "Nobetci pre-auth flow removed in MVP refactor." });
}
