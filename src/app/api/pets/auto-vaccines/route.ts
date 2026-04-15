import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Vaccine schedule definitions
interface VaccineTemplate {
  name: string;
  weeksFromBirth: number; // null = already past due (use today)
  reminderDaysBefore: number;
}

const DOG_SCHEDULE: VaccineTemplate[] = [
  { name: "Karma Aşısı (1. Doz)",         weeksFromBirth: 8,   reminderDaysBefore: 7 },
  { name: "Karma Aşısı (2. Doz)",         weeksFromBirth: 12,  reminderDaysBefore: 7 },
  { name: "Kuduz Aşısı",                  weeksFromBirth: 16,  reminderDaysBefore: 7 },
  { name: "Karma Booster (Yıllık)",       weeksFromBirth: 52,  reminderDaysBefore: 14 },
  { name: "Kuduz Booster (Yıllık)",       weeksFromBirth: 56,  reminderDaysBefore: 14 },
];

const CAT_SCHEDULE: VaccineTemplate[] = [
  { name: "Karma Aşısı (1. Doz)",         weeksFromBirth: 8,   reminderDaysBefore: 7 },
  { name: "Karma Aşısı (2. Doz)",         weeksFromBirth: 12,  reminderDaysBefore: 7 },
  { name: "Kuduz Aşısı",                  weeksFromBirth: 16,  reminderDaysBefore: 7 },
  { name: "Karma Booster (Yıllık)",       weeksFromBirth: 52,  reminderDaysBefore: 14 },
  { name: "Kuduz Booster (Yıllık)",       weeksFromBirth: 56,  reminderDaysBefore: 14 },
];

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  try {
    // Auth check — caller must be a logged-in user
    const { createClient } = await import("@/lib/supabase/server");
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { petId, species, birthDate, ownerId } = await req.json();

    if (!petId || !species || !ownerId) {
      return NextResponse.json({ error: "petId, species ve ownerId zorunludur" }, { status: 400 });
    }

    // Only generate for dog and cat
    const speciesLower = (species as string).toLowerCase();
    let schedule: VaccineTemplate[] = [];
    if (speciesLower === "dog" || speciesLower === "köpek") schedule = DOG_SCHEDULE;
    else if (speciesLower === "cat" || speciesLower === "kedi") schedule = CAT_SCHEDULE;
    else {
      return NextResponse.json({ ok: true, skipped: true, reason: "Bu tür için aşı takvimi yok" });
    }

    const supabase = await createServiceClient();
    const now = new Date();

    // Use birth_date if provided, otherwise fall back to today (will still give future dates)
    const birth = birthDate ? new Date(birthDate) : now;

    const vaccineInserts = [];
    const reminderInserts = [];

    for (const template of schedule) {
      const dueDate = addWeeks(birth, template.weeksFromBirth);

      // Only schedule future vaccines (skip ones that have already passed for pets with known birth dates)
      // For unknown birth dates, schedule all from today forward
      if (dueDate < now && birthDate) continue;

      vaccineInserts.push({
        pet_id: petId,
        name: template.name,
        date_given: null,           // not given yet
        next_due_date: toDateStr(dueDate),
        notes: "Otomatik oluşturulan takvim",
      });

      // Create reminder scheduled for X days before due date
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - template.reminderDaysBefore);

      // Only insert future reminders
      if (reminderDate > now) {
        reminderInserts.push({
          pet_id: petId,
          owner_id: ownerId,
          type: "vaccine",
          title: `${template.name} zamanı yaklaşıyor`,
          scheduled_at: reminderDate.toISOString(),
          message_content:
            `🐾 Hatırlatıcı: Hayvanınızın ${template.name} tarihi ${toDateStr(dueDate)} tarihinde. ` +
            `Lütfen veterinerinizle randevu alın.`,
          delivery_status: "pending",
        });
      }
    }

    // Batch insert vaccines
    if (vaccineInserts.length > 0) {
      const { error: vaccineError } = await supabase.from("vaccines").insert(vaccineInserts);
      if (vaccineError) {
        console.error("Auto-vaccine insert error:", vaccineError.message);
        return NextResponse.json({ error: vaccineError.message }, { status: 500 });
      }
    }

    // Batch insert reminders
    if (reminderInserts.length > 0) {
      const { error: reminderError } = await supabase.from("reminders").insert(reminderInserts);
      if (reminderError) {
        console.error("Auto-vaccine reminder insert error:", reminderError.message);
        // Non-fatal — vaccines are already inserted
      }
    }

    return NextResponse.json({
      ok: true,
      vaccinesCreated: vaccineInserts.length,
      remindersScheduled: reminderInserts.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    console.error("auto-vaccines error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
