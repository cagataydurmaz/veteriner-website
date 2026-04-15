import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Clock, PawPrint, Calendar, CheckCircle, XCircle } from "lucide-react";
import JoinVideoButton from "@/components/shared/JoinVideoButton";

export const metadata: Metadata = { title: "Video Görüşmeler" };

function getStatusLabel(status: string) {
  switch (status) {
    case "confirmed": return { label: "Onaylı", class: "bg-green-100 text-green-700" };
    case "pending":   return { label: "Beklemede", class: "bg-yellow-100 text-yellow-700" };
    case "completed": return { label: "Tamamlandı", class: "bg-gray-100 text-gray-600" };
    case "cancelled": return { label: "İptal", class: "bg-red-100 text-red-600" };
    default:          return { label: status, class: "bg-gray-100 text-gray-600" };
  }
}

export default async function VetVideoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/vet-login");

  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vet) redirect("/vet/profile");

  const now = new Date();
  const tenMinFromNow = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  // Upcoming video appointments (next 30 days)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: upcomingApts },
    { data: pastApts },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(`
        id, datetime, status,
        pet:pets(name, species),
        owner:users!appointments_owner_id_fkey(full_name)
      `)
      .eq("vet_id", vet.id)
      .eq("type", "video")
      .in("status", ["pending", "confirmed"])
      .gte("datetime", now.toISOString())
      .lte("datetime", thirtyDaysFromNow)
      .order("datetime", { ascending: true }),
    supabase
      .from("appointments")
      .select(`
        id, datetime, status,
        pet:pets(name, species),
        owner:users!appointments_owner_id_fkey(full_name)
      `)
      .eq("vet_id", vet.id)
      .eq("type", "video")
      .lt("datetime", now.toISOString())
      .order("datetime", { ascending: false })
      .limit(20),
  ]);

  // Determine which upcoming apt is joinable (confirmed + within 10 min window or started <1h ago)
  const isJoinable = (datetime: string, status: string) => {
    if (status !== "confirmed") return false;
    const d = new Date(datetime);
    return d.getTime() <= new Date(tenMinFromNow).getTime() && d.getTime() >= new Date(oneHourAgo).getTime();
  };

  const formatDT = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Video Görüşmeler</h1>
        <p className="text-sm text-gray-500 mt-1">Tüm video randevularınız</p>
      </div>

      {/* Upcoming */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#166534]" />
            Yaklaşan Video Randevular
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingApts && upcomingApts.length > 0 ? (
            <div className="space-y-3">
              {upcomingApts.map((apt) => {
                const pet = Array.isArray(apt.pet) ? apt.pet[0] : apt.pet;
                const owner = Array.isArray(apt.owner) ? apt.owner[0] : apt.owner;
                const joinable = isJoinable(apt.datetime, apt.status);
                const statusInfo = getStatusLabel(apt.status);

                return (
                  <div
                    key={apt.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      joinable
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <Video className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">
                        {(pet as { name?: string } | null)?.name || "—"}
                        {" "}
                        <span className="text-gray-400 font-normal">
                          ({(owner as { full_name?: string } | null)?.full_name || "—"})
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatDT(apt.datetime)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs ${statusInfo.class}`}>
                        {statusInfo.label}
                      </Badge>
                      {joinable ? (
                        <JoinVideoButton
                          appointmentId={apt.id}
                          label="Katıl"
                          size="sm"
                          className="text-xs px-3"
                        />
                      ) : apt.status === "confirmed" ? (
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          10 dk önce aktif
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <Video className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Yaklaşan video randevu yok</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-gray-400" />
            Geçmiş Video Görüşmeler
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pastApts && pastApts.length > 0 ? (
            <div className="space-y-2">
              {pastApts.map((apt) => {
                const pet = Array.isArray(apt.pet) ? apt.pet[0] : apt.pet;
                const owner = Array.isArray(apt.owner) ? apt.owner[0] : apt.owner;
                const statusInfo = getStatusLabel(apt.status);
                const isCompleted = apt.status === "completed";

                return (
                  <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">
                        {(pet as { name?: string } | null)?.name || "—"}
                        {" — "}
                        {(owner as { full_name?: string } | null)?.full_name || "—"}
                      </p>
                      <p className="text-xs text-gray-400">{formatDT(apt.datetime)}</p>
                    </div>
                    <Badge className={`text-xs ${statusInfo.class} shrink-0`}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Henüz tamamlanmış video görüşme yok</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
