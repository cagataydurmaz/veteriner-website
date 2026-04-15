import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";

const ScheduleGrid = nextDynamic(
  () => import("@/components/vet/ScheduleGrid"),
  {
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-full bg-gray-100 rounded-lg" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 * 12 }).map((_, i) => (
            <div key={i} className="h-6 bg-gray-50 rounded" />
          ))}
        </div>
      </div>
    ),
  }
);
import type { SlotTemplate } from "@/app/api/vet/schedule/route";

export const dynamic = "force-dynamic";

interface BlockedSlot {
  id:           string;
  blocked_date: string;
  start_time:   string | null;
  end_time:     string | null;
  reason:       string | null;
}

async function getVetSchedule() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/vet-login");

  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id, offers_in_person, offers_video, offers_nobetci")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vet) redirect("/vet/dashboard");

  const today = new Date();
  const in30d = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fromStr = today.toISOString().split("T")[0];
  const toStr   = in30d.toISOString().split("T")[0];

  const [{ data: slots }, { data: blocked }] = await Promise.all([
    supabase
      .from("availability_slots")
      .select("id, day_of_week, start_time, end_time, service_type, slot_duration_minutes, is_active")
      .eq("vet_id", vet.id)
      .eq("is_active", true)
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("blocked_slots")
      .select("id, blocked_date, start_time, end_time, reason")
      .eq("vet_id", vet.id)
      .gte("blocked_date", fromStr)
      .lte("blocked_date", toStr)
      .order("blocked_date")
      .order("start_time"),
  ]);

  return {
    vetId:          vet.id,
    offersInPerson: vet.offers_in_person ?? false,
    offersVideo:    vet.offers_video     ?? false,
    slots:          (slots ?? []) as SlotTemplate[],
    blocked:        (blocked ?? []) as BlockedSlot[],
  };
}

export default async function VetCalendarPage() {
  const { vetId, offersInPerson, offersVideo, slots, blocked } = await getVetSchedule();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">📅 Çalışma Takvimi</h1>
        <p className="text-sm text-gray-500 mt-1">
          Haftalık müsaitlik saatlerinizi ve bloke günlerinizi yönetin.
          Hastalar yalnızca belirlediğiniz saatlerde randevu alabilir.
        </p>
      </div>

      <ScheduleGrid
        vetId={vetId}
        offersInPerson={offersInPerson}
        offersVideo={offersVideo}
        initialSlots={slots}
        initialBlocked={blocked}
      />
    </div>
  );
}
