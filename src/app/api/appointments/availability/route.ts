import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/scheduler";

/**
 * GET /api/appointments/availability?vetId=&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns available appointment slots for a vet over the given date range.
 * Uses the scheduler engine which respects:
 *  - availability_slots templates (day_of_week, start_time, end_time, slot_duration_minutes)
 *  - Already booked appointments (status: pending | confirmed)
 *
 * Response: { slots: { "YYYY-MM-DD": ["HH:MM", ...], ... } }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vetId = searchParams.get("vetId");
    const from  = searchParams.get("from");
    const to    = searchParams.get("to");

    if (!vetId || !from || !to)
      return NextResponse.json(
        { error: "vetId, from ve to parametreleri zorunludur" },
        { status: 400 }
      );

    // Validate date format (YYYY-MM-DD)
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(from) || !dateRe.test(to))
      return NextResponse.json(
        { error: "from ve to parametreleri YYYY-MM-DD formatında olmalı" },
        { status: 400 }
      );

    // Treat the query dates as Istanbul midnight (UTC+3) so slot boundaries
    // align with what the user sees in the browser — Vercel runs UTC.
    const fromDate = new Date(`${from}T00:00:00+03:00`);
    const toDate   = new Date(`${to}T00:00:00+03:00`);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate)
      return NextResponse.json(
        { error: "Geçersiz tarih aralığı" },
        { status: 400 }
      );

    // Max 60 days to prevent expensive queries
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 60)
      return NextResponse.json(
        { error: "Tarih aralığı en fazla 60 gün olabilir" },
        { status: 400 }
      );

    const serviceTypeParam = searchParams.get("serviceType") as "clinic" | "video" | "both" | null;
    const slots = await getAvailableSlots(vetId, fromDate, toDate, serviceTypeParam ?? undefined);

    // Filter out past slots (1 hour buffer)
    const nowMs = Date.now();
    const bufferMs = 60 * 60 * 1000;
    const filtered: typeof slots = {};
    for (const [dateStr, times] of Object.entries(slots)) {
      // Append Istanbul offset so the slot is parsed as UTC+3, not server UTC
      const future = times.filter((t) => {
        const slotMs = new Date(`${dateStr}T${t}:00+03:00`).getTime();
        return slotMs - nowMs >= bufferMs;
      });
      if (future.length > 0) filtered[dateStr] = future;
    }

    return NextResponse.json({ slots: filtered });
  } catch (err) {
    console.error("availability route error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
