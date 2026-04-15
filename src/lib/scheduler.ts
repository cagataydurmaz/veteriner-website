import { createServiceClient } from "@/lib/supabase/server";

/**
 * Scheduler — generates available appointment time slots for a vet.
 *
 * Algorithm:
 *  1. Load active availability_slots templates for the vet
 *     (day_of_week, start_time, end_time, slot_duration_minutes, service_type)
 *  2. Load blocked_slots (one-off exceptions: lunch, surgery, vacation)
 *  3. Load already-booked appointments (status pending|confirmed) in the window
 *  4. For each date in [from, to], expand the matching template into individual
 *     slot start-times, then subtract blocked + booked slots
 *  5. Return { "2026-04-15": ["09:00", "09:30", ...], ... }
 *
 * Slot format: "HH:MM" (24-hour, Istanbul UTC+3 interpretation)
 * service_type filter: if provided, only returns slots from templates that
 *   match 'clinic', 'video', or 'both' (both matches everything).
 */

export type ServiceType = "clinic" | "video" | "both";

export interface AvailableSlots {
  /** dateStr (YYYY-MM-DD) → array of "HH:MM" start times */
  [dateStr: string]: string[];
}

interface AvailabilitySlotRow {
  id:                     string;
  day_of_week:            number;   // 0=Sun … 6=Sat
  start_time:             string;   // "09:00"
  end_time:               string;   // "17:00"
  slot_duration_minutes:  number;   // 15 | 30 | 45 | 60
  service_type:           ServiceType;
  is_active:              boolean;
}

interface BlockedSlotRow {
  blocked_date: string;   // "YYYY-MM-DD"
  start_time:   string | null;  // "HH:MM" or null = full day
  end_time:     string | null;
}

interface AppointmentRow {
  datetime: string;   // ISO e.g. "2026-04-15T09:00:00"
}

/**
 * Returns the available slots map for a vet over the given date range.
 *
 * @param vetId        UUID of the veterinarian
 * @param from         Start of the range (inclusive)
 * @param to           End of the range (inclusive)
 * @param serviceType  Optional: filter by service type ('clinic' | 'video')
 *                     'both' templates always match regardless of filter.
 */
export async function getAvailableSlots(
  vetId:       string,
  from:        Date,
  to:          Date,
  serviceType?: ServiceType,
): Promise<AvailableSlots> {
  const supabase = createServiceClient();

  // ── 1. Load availability templates ─────────────────────────────────────────
  const { data: templates, error: tErr } = await supabase
    .from("availability_slots")
    .select("id, day_of_week, start_time, end_time, slot_duration_minutes, service_type, is_active")
    .eq("vet_id", vetId)
    .eq("is_active", true);

  if (tErr) throw new Error(`scheduler: templates fetch failed — ${tErr.message}`);
  if (!templates || templates.length === 0) return {};

  // Filter by service type if requested
  // 'both' templates are always included; 'clinic'/'video' only when matching
  const filteredTemplates = (templates as AvailabilitySlotRow[]).filter((t) => {
    if (!serviceType) return true;
    return t.service_type === "both" || t.service_type === serviceType;
  });

  if (filteredTemplates.length === 0) return {};

  // ── 2. Load blocked_slots in range ──────────────────────────────────────────
  const fromDateStr = toIstanbulDateStr(from);
  const toDateStr_  = toIstanbulDateStr(to);

  const { data: blocked } = await supabase
    .from("blocked_slots")
    .select("blocked_date, start_time, end_time")
    .eq("vet_id", vetId)
    .gte("blocked_date", fromDateStr)
    .lte("blocked_date", toDateStr_);

  // Index blocked slots by date for fast lookup
  const blockedByDate = new Map<string, BlockedSlotRow[]>();
  for (const b of (blocked ?? []) as BlockedSlotRow[]) {
    if (!blockedByDate.has(b.blocked_date)) blockedByDate.set(b.blocked_date, []);
    blockedByDate.get(b.blocked_date)!.push(b);
  }

  // ── 3. Load booked appointments in range ────────────────────────────────────
  const fromISO = from.toISOString();
  const toISO   = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();

  const { data: booked, error: bErr } = await supabase
    .from("appointments")
    .select("datetime")
    .eq("vet_id", vetId)
    .in("status", ["pending", "confirmed"])
    .gte("datetime", fromISO)
    .lte("datetime", toISO);

  if (bErr) throw new Error(`scheduler: booked appointments fetch failed — ${bErr.message}`);

  // Build a Set of booked "YYYY-MM-DDTHH:MM" strings in Istanbul time for fast lookup.
  //
  // Timezone safety contract:
  //   - Supabase returns timestamptz as ISO 8601 with UTC offset, e.g.
  //     "2026-04-15T06:00:00+00:00" (= 09:00 Istanbul).
  //   - new Date(isoString).getTime() always returns UTC milliseconds
  //     regardless of the string's offset — JavaScript parses the offset.
  //   - Adding 3 * 3600 * 1000 then reading UTC components gives Istanbul wall clock.
  //   - Turkey does NOT observe DST (fixed UTC+3 since 2016), so +3h is always correct.
  //
  // Edge case: if a legacy record was stored WITHOUT timezone (no offset suffix),
  //   JavaScript Node.js interprets it as UTC. Adding +3h still shifts correctly
  //   because the booking route now always appends +03:00 before writing to DB.
  const bookedSet = new Set<string>(
    (booked ?? []).map((a: AppointmentRow) => {
      const utcMs = new Date(a.datetime).getTime();   // safe: JS always parses tz offset
      const istMs = utcMs + 3 * 60 * 60 * 1000;      // UTC → Istanbul (fixed UTC+3)
      const ist   = new Date(istMs);
      const yyyy  = ist.getUTCFullYear();
      const mm    = String(ist.getUTCMonth() + 1).padStart(2, "0");
      const dd    = String(ist.getUTCDate()).padStart(2, "0");
      const hh    = String(ist.getUTCHours()).padStart(2, "0");
      const mn    = String(ist.getUTCMinutes()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}T${hh}:${mn}`;
    })
  );

  // ── 4. Build day_of_week index ──────────────────────────────────────────────
  const templatesByDay = new Map<number, AvailabilitySlotRow[]>();
  for (const t of filteredTemplates) {
    if (!templatesByDay.has(t.day_of_week)) templatesByDay.set(t.day_of_week, []);
    templatesByDay.get(t.day_of_week)!.push(t);
  }

  // ── 5. Iterate each date in range ───────────────────────────────────────────
  const result: AvailableSlots = {};

  const fromMidnightIST = new Date(toIstanbulDateStr(from) + "T00:00:00+03:00");
  const toMidnightIST   = new Date(toIstanbulDateStr(to)   + "T00:00:00+03:00");

  for (
    let d = fromMidnightIST;
    d <= toMidnightIST;
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const dow      = istanbulDow(d);
    const dayTemps = templatesByDay.get(dow);
    if (!dayTemps) continue;

    const dateStr    = toIstanbulDateStr(d);
    const dayBlocked = blockedByDate.get(dateStr) ?? [];
    const slots: string[] = [];

    for (const tmpl of dayTemps) {
      const duration = tmpl.slot_duration_minutes ?? 30;
      const [startH, startM] = tmpl.start_time.split(":").map(Number);
      const [endH,   endM  ] = tmpl.end_time.split(":").map(Number);

      let curMin   = startH * 60 + startM;
      const endMin = endH * 60 + endM;

      while (curMin + duration <= endMin) {
        const timeStr = minutesToHHMM(curMin);
        const key     = `${dateStr}T${timeStr}`;

        // Skip if booked
        if (bookedSet.has(key)) { curMin += duration; continue; }

        // Skip if inside a blocked_slot
        const slotEndMin = curMin + duration;
        const isBlocked  = dayBlocked.some((b) => {
          if (!b.start_time && !b.end_time) return true; // full-day block
          const [bsh, bsm] = (b.start_time ?? "00:00").split(":").map(Number);
          const [beh, bem] = (b.end_time   ?? "23:59").split(":").map(Number);
          const bStart = bsh * 60 + bsm;
          const bEnd   = beh * 60 + bem;
          // Overlap: slot starts before block ends AND slot ends after block starts
          return curMin < bEnd && slotEndMin > bStart;
        });

        if (!isBlocked) slots.push(timeStr);
        curMin += duration;
      }
    }

    if (slots.length > 0) {
      slots.sort();
      result[dateStr] = slots;
    }
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toIstanbulDateStr(utcDate: Date): string {
  const ms  = utcDate.getTime() + 3 * 60 * 60 * 1000;
  const ist = new Date(ms);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}

function istanbulDow(utcDate: Date): number {
  const ms = utcDate.getTime() + 3 * 60 * 60 * 1000;
  return new Date(ms).getUTCDay();
}
