import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, getAppointmentStatusLabel, getAppointmentStatusColor, getSpeciesEmoji } from "@/lib/utils";

export const metadata: Metadata = { title: "Randevularım" };
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Plus, Video, MapPin, CalendarClock, ChevronRight } from "lucide-react";
import type { Appointment } from "@/types";
import { OwnerAppointmentsRealtimeSync } from "@/components/owner/OwnerAppointmentsRealtimeSync";

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const today = new Date().toISOString().split("T")[0];

  const [{ data: appointments }, { data: completedApts }] = await Promise.all([
    supabase
      .from("appointments")
      .select(`
        *,
        pet:pets(name, species, photo_url),
        vet:veterinarians(
          id, specialty, city,
          user:users(full_name)
        )
      `)
      .eq("owner_id", user.id)
      .order("datetime", { ascending: false }),

    // Completed appointments for follow-up lookup
    supabase
      .from("appointments")
      .select("id, vet_id, pet_id, pet:pets(name, species), vet:veterinarians(id, specialty, city, user:users(full_name))")
      .eq("owner_id", user.id)
      .eq("status", "completed"),
  ]);

  // ── Follow-up suggestions ─────────────────────────────────────────────────
  const aptIds = (completedApts || []).map((a: { id: string }) => a.id);

  const { data: followUpRecords } = aptIds.length
    ? await supabase
        .from("medical_records")
        .select("id, follow_up_date, appointment_id")
        .in("appointment_id", aptIds)
        .not("follow_up_date", "is", null)
        .gte("follow_up_date", today)
        .order("follow_up_date", { ascending: true })
        .limit(5)
    : { data: [] };

  // Join follow-up records with appointment data in JS
  type CompletedApt = {
    id: string;
    vet_id: string;
    pet_id: string;
    pet: { name: string; species: string };
    vet: { id: string; specialty: string; city: string; user: { full_name: string } };
  };

  const followUpSuggestions = (followUpRecords || []).map((rec: { id: string; follow_up_date: string; appointment_id: string }) => {
    const apt = (completedApts || []).find((a: { id: string }) => a.id === rec.appointment_id) as CompletedApt | undefined;
    return apt ? { ...rec, apt } : null;
  }).filter(Boolean) as Array<{
    id: string;
    follow_up_date: string;
    appointment_id: string;
    apt: CompletedApt;
  }>;

  const upcoming  = (appointments || []).filter((a: Appointment) =>
    ["pending", "confirmed"].includes(a.status) && new Date(a.datetime) >= new Date()
  );
  const past      = (appointments || []).filter((a: Appointment) =>
    a.status === "completed" || new Date(a.datetime) < new Date()
  );
  const cancelled = (appointments || []).filter((a: Appointment) =>
    ["cancelled", "no_show"].includes(a.status)
  );

  const AppointmentCard = ({ apt }: { apt: Appointment & {
    pet: { name: string; species: string; photo_url: string | null };
    vet: { specialty: string; city: string; user: { full_name: string } }
  } }) => (
    <Link href={`/owner/appointments/${apt.id}`}>
      <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow bg-white cursor-pointer">
        <div className="w-12 h-12 bg-[#F0FDF4] rounded-xl flex items-center justify-center text-2xl shrink-0">
          {getSpeciesEmoji(apt.pet?.species || "")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">{apt.pet?.name}</p>
              <p className="text-sm text-gray-500">Vet. Hek. {apt.vet?.user?.full_name}</p>
              <p className="text-xs text-gray-400">{apt.vet?.specialty} · {apt.vet?.city}</p>
            </div>
            <div className="text-right shrink-0">
              <Badge className={getAppointmentStatusColor(apt.status)}>
                {getAppointmentStatusLabel(apt.status)}
              </Badge>
              <div className="flex items-center gap-1 mt-1 justify-end">
                {apt.type === "video" ? (
                  <Video className="w-3 h-3 text-blue-500" />
                ) : (
                  <MapPin className="w-3 h-3 text-gray-400" />
                )}
                <span className="text-xs text-gray-400">
                  {apt.type === "video" ? "Video" : "Yüz Yüze"}
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm font-medium text-[#166534] mt-2">
            {formatDateTime(apt.datetime)}
          </p>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="space-y-6">
      {/* Invisible realtime sync: refreshes page on any appointment change */}
      <OwnerAppointmentsRealtimeSync ownerId={user.id} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Randevularım</h1>
          <p className="text-sm text-gray-500 mt-1">{appointments?.length || 0} toplam randevu</p>
        </div>
        <Link href="/owner/appointments/book">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Randevu Al
          </Button>
        </Link>
      </div>

      {/* ── Follow-up Suggestions ──────────────────────────────────────────── */}
      {followUpSuggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-800">Veteriner Takip Önerileri</p>
          </div>
          {followUpSuggestions.map(rec => {
            const daysUntil = Math.ceil(
              (new Date(rec.follow_up_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            return (
              <Card key={rec.id} className="border-blue-200 bg-blue-50">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getSpeciesEmoji(rec.apt.pet?.species || "")}</span>
                      <div>
                        <p className="text-sm font-semibold text-blue-900">
                          {rec.apt.pet?.name} için takip zamanı 📅
                        </p>
                        <p className="text-xs text-blue-700">
                          Vet. Hek. {rec.apt.vet?.user?.full_name} — {" "}
                          {new Date(rec.follow_up_date).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                          {" "}
                          <span className="font-semibold">
                            ({daysUntil === 0 ? "bugün!" : daysUntil === 1 ? "yarın!" : `${daysUntil} gün sonra`})
                          </span>
                        </p>
                      </div>
                    </div>
                    <Link href={`/veteriner/${rec.apt.vet?.id}`}>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                        Randevu Al <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">
            Yaklaşan ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Geçmiş ({past.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            İptal ({cancelled.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((apt: Appointment) => (
                <AppointmentCard key={apt.id} apt={apt as Appointment & {
                  pet: { name: string; species: string; photo_url: string | null };
                  vet: { specialty: string; city: string; user: { full_name: string } }
                }} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Yaklaşan randevunuz yok</p>
              <Link href="/owner/appointments/book">
                <Button className="mt-4">Randevu Al</Button>
              </Link>
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {past.length > 0 ? (
            <div className="space-y-3">
              {past.map((apt: Appointment) => (
                <AppointmentCard key={apt.id} apt={apt as Appointment & {
                  pet: { name: string; species: string; photo_url: string | null };
                  vet: { specialty: string; city: string; user: { full_name: string } }
                }} />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-12">Geçmiş randevu bulunamadı</p>
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4">
          {cancelled.length > 0 ? (
            <div className="space-y-3">
              {cancelled.map((apt: Appointment) => (
                <AppointmentCard key={apt.id} apt={apt as Appointment & {
                  pet: { name: string; species: string; photo_url: string | null };
                  vet: { specialty: string; city: string; user: { full_name: string } }
                }} />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-12">İptal edilen randevu yok</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
