import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, PawPrint, Calendar } from "lucide-react";
import OwnersTable from "./client";

type OwnerRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  created_at: string;
  pet_count: number;
  appointment_count: number;
  account_status: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  banned_reason: string | null;
};

export default async function AdminOwnersPage() {
  const supabase = createServiceClient();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [{ data: owners }, { count: newThisWeek }] = await Promise.all([
    supabase
      .from("users")
      .select(`
        id, full_name, email, phone, city, created_at,
        account_status, suspended_until, suspension_reason, banned_reason,
        pet_count:pets(count),
        appointment_count:appointments(count)
      `)
      .eq("role", "owner")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "owner")
      .gte("created_at", oneWeekAgo.toISOString()),
  ]);

  const rawOwners = owners || [];

  const mapped: OwnerRow[] = rawOwners.map((o: Record<string, unknown>) => ({
    id: o.id as string,
    full_name: o.full_name as string,
    email: o.email as string | null,
    phone: o.phone as string | null,
    city: o.city as string | null,
    created_at: o.created_at as string,
    account_status: (o.account_status as string | null) ?? null,
    suspended_until: (o.suspended_until as string | null) ?? null,
    suspension_reason: (o.suspension_reason as string | null) ?? null,
    banned_reason: (o.banned_reason as string | null) ?? null,
    pet_count: Array.isArray(o.pet_count)
      ? (o.pet_count[0] as { count: number })?.count ?? 0
      : typeof o.pet_count === "number"
      ? o.pet_count
      : 0,
    appointment_count: Array.isArray(o.appointment_count)
      ? (o.appointment_count[0] as { count: number })?.count ?? 0
      : typeof o.appointment_count === "number"
      ? o.appointment_count
      : 0,
  }));

  const withPets = mapped.filter(o => o.pet_count > 0).length;
  const withAppointments = mapped.filter(o => o.appointment_count > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hayvan Sahipleri</h1>
        <p className="text-sm text-gray-500 mt-1">{mapped.length} kayıtlı hayvan sahibi</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Toplam Sahip", value: mapped.length, icon: Users, color: "bg-blue-100 text-blue-600" },
          { label: "Bu Hafta Yeni", value: newThisWeek ?? 0, icon: UserCheck, color: "bg-[#F0FDF4] text-[#166534]" },
          { label: "Evcil Hayvanı Olan", value: withPets, icon: PawPrint, color: "bg-orange-100 text-orange-600" },
          { label: "Randevusu Olan", value: withAppointments, icon: Calendar, color: "bg-purple-100 text-purple-600" },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <OwnersTable owners={mapped} />
    </div>
  );
}
