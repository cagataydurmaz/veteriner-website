import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/scheduler";

/**
 * GET /api/vet/[id]/slots?date=YYYY-MM-DD&serviceType=clinic|video|both
 *
 * Public endpoint — no auth required.
 * Returns available bookable time slots for a single vet on a specific date.
 *
 * This is the owner-facing API used by BookingCalendar and the vet profile page.
 * It delegates to the existing scheduler engine which already handles:
 *   - availability_slots templates (weekly working hours)
 *   - blocked_slots (ad-hoc exceptions: surgery, lunch, vacation)
 *   - existing appointments (pending | confirmed) — double-booking prevention
 *   - 1-hour past buffer (slots in the past are excluded)
 *
 * Response: { date: "YYYY-MM-DD", slots: ["09:00", "09:30", "10:00", ...] }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vetId } = await params;
    const { searchParams } = new URL(req.url);
    const dateParam       = searchParams.get("date");
    const serviceType     = searchParams.get("serviceType") as "clinic" | "video" | "both" | null;

    if (!vetId) {
      return NextResponse.json({ error: "Veteriner ID zorunludur" }, { status: 400 });
    }

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: "date parametresi YYYY-MM-DD formatında olmalı" },
        { status: 400 }
      );
    }

    // Parse as Istanbul midnight so slot filtering stays in the correct timezone
    const fromDate = new Date(`${dateParam}T00:00:00+03:00`);
    if (isNaN(fromDate.getTime())) {
      return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
    }

    const allSlots = await getAvailableSlots(
      vetId,
      fromDate,
      fromDate, // single day — from = to
      serviceType ?? undefined
    );

    // Filter out slots within 1 hour from now (same as availability route)
    const nowMs    = Date.now();
    const bufferMs = 60 * 60 * 1000;
    const rawSlots = allSlots[dateParam] ?? [];
    const slots = rawSlots.filter((t) => {
      const slotMs = new Date(`${dateParam}T${t}:00+03:00`).getTime();
      return slotMs - nowMs >= bufferMs;
    });

    return NextResponse.json({ date: dateParam, slots });
  } catch (err) {
    console.error("[vet/[id]/slots]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
