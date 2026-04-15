import { NextResponse } from "next/server";

/**
 * POST /api/nobetci/request  — DEPRECATED
 *
 * The 90-second pre-auth instant-booking flow has been removed.
 * Nöbetçi is now a simple directory of vets with is_online_now=true.
 * Pet owners see the list, click a vet, and book a regular video
 * appointment via /api/appointments/book with type="video".
 *
 * This stub returns 410 Gone so any stale client calls fail visibly.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:  "Bu akış artık kullanılmıyor.",
      detail: "Nöbetçi randevusu için /api/appointments/book kullanın (type: 'video').",
    },
    { status: 410 }
  );
}
