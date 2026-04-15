import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import AppointmentsClient from "./client";

type Apt = {
  id: string;
  datetime: string;
  type: string;
  status: string;
  complaint: string | null;
  pet: { name: string; species: string } | null;
  owner: { full_name: string; phone: string | null } | null;
  vet: { user: { full_name: string } | null; city: string | null } | null;
};

export default async function AdminAppointmentsPage() {
  const supabase = createServiceClient();

  const { data: all } = await supabase
    .from("appointments")
    .select(`
      id, datetime, type, status, complaint,
      pet:pets(name, species),
      owner:users(full_name, phone),
      vet:veterinarians(city, user:users(full_name))
    `)
    .order("datetime", { ascending: false })
    .limit(200);

  const apts = (all || []) as unknown as Apt[];
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const todayCount = apts.filter(a => a.datetime.startsWith(today)).length;
  const pendingCount = apts.filter(a => a.status === "pending").length;
  const upcomingCount = apts.filter(a => ["pending", "confirmed"].includes(a.status) && a.datetime >= now).length;
  const completedCount = apts.filter(a => a.status === "completed").length;
  const cancelledCount = apts.filter(a => a.status === "cancelled").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Randevu Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">{apts.length} toplam randevu</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Bugün", value: todayCount, color: "text-[#166534]" },
          { label: "Bekleyen", value: pendingCount, color: "text-yellow-600" },
          { label: "Yaklaşan", value: upcomingCount, color: "text-blue-600" },
          { label: "Tamamlanan", value: completedCount, color: "text-gray-700" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AppointmentsClient
        apts={apts}
        todayCount={todayCount}
        pendingCount={pendingCount}
        upcomingCount={upcomingCount}
        completedCount={completedCount}
        cancelledCount={cancelledCount}
      />
    </div>
  );
}
