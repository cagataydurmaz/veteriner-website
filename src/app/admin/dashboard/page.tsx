import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Users,
  Stethoscope,
  Calendar,
  TrendingUp,
  AlertCircle,
  Activity,
  ShieldAlert,
  Info,
} from "lucide-react";
import AdminActivityFeed from "@/components/admin/AdminActivityFeed";
import dynamic from "next/dynamic";

const AdminStatsCharts = dynamic(
  () => import("@/components/admin/AdminStatsCharts"),
  { loading: () => <div className="h-64 bg-gray-50 rounded-xl animate-pulse" /> }
);
import TurkeyMap from "@/components/admin/TurkeyMap";
import AdminRealtimeStats from "@/components/admin/AdminRealtimeStats";

export const revalidate = 30;

const SUBSCRIPTIONS_ENABLED =
  process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED !== "false";
const FREE_PERIOD_END = process.env.NEXT_PUBLIC_FREE_PERIOD_END ?? "2026-07-08";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ wrong_panel?: string }>;
}) {
  const { wrong_panel } = await searchParams;
  const supabase = createServiceClient();

  // Platform-wide stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalOwners },
    { count: totalVets },
    { count: pendingVets },
    { count: todayAppointments },
    { count: totalAppointments },
    { data: payments },
    { data: vetsByCity },
    { data: recentErrors },
    { data: recentApts },
    { data: recentOwnerRegs },
    { data: recentVetRegs },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "owner"),
    supabase
      .from("veterinarians")
      .select("*", { count: "exact", head: true })
      .eq("is_verified", true),
    supabase
      .from("veterinarians")
      .select("*", { count: "exact", head: true })
      .eq("is_verified", false),
    (() => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      return supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .gte("datetime", todayStart.toISOString())
        .lt("datetime", todayEnd.toISOString());
    })(),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "success")
      .gte(
        "created_at",
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      ),
    supabase
      .from("veterinarians")
      .select("city")
      .eq("is_verified", true),
    supabase
      .from("system_errors")
      .select("*")
      .in("severity", ["high", "critical"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("appointments")
      .select("datetime")
      .gte("datetime", thirtyDaysAgo),
    supabase
      .from("users")
      .select("created_at")
      .eq("role", "owner")
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("veterinarians")
      .select("created_at")
      .gte("created_at", thirtyDaysAgo),
  ]);

  // Build 7 evenly-spaced sample points over last 30 days
  const TR_MONTHS = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const sampleDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i * 4) * 24 * 60 * 60 * 1000);
    return { iso: d.toISOString().split("T")[0], label: `${d.getDate()} ${TR_MONTHS[d.getMonth()]}` };
  });

  function countByDay(rows: { datetime?: string | null; created_at?: string | null }[], field: "datetime" | "created_at") {
    return (rows ?? []).reduce((acc: Record<string, number>, row) => {
      const day = (row[field] ?? "").split("T")[0];
      if (day) acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});
  }

  const aptByDay = countByDay(recentApts ?? [], "datetime");
  const ownersByDay = countByDay(recentOwnerRegs ?? [], "created_at");
  const vetRegByDay = countByDay(recentVetRegs ?? [], "created_at");

  const appointmentChartData = sampleDays.map(({ iso, label }) => ({
    date: label,
    randevu: aptByDay[iso] ?? 0,
  }));

  const registrationChartData = sampleDays.map(({ iso, label }) => ({
    date: label,
    kullanici: ownersByDay[iso] ?? 0,
    veteriner: vetRegByDay[iso] ?? 0,
  }));

  const monthlyRevenue = (payments || []).reduce(
    (sum: number, p: { amount: number }) => sum + Number(p.amount),
    0
  );

  // Group vets by city
  const cityCount = (vetsByCity || []).reduce((acc: Record<string, number>, v: { city: string }) => {
    acc[v.city] = (acc[v.city] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    {
      label: "Kayıtlı Kullanıcılar",
      value: totalOwners || 0,
      icon: Users,
      color: "bg-[#DCFCE7] text-[#16A34A]",
      change: null,
    },
    {
      label: "Aktif Veterinerler",
      value: totalVets || 0,
      icon: Stethoscope,
      color: "bg-green-100 text-green-600",
      change: null,
    },
    {
      label: "Bugünkü Randevular",
      value: todayAppointments || 0,
      icon: Calendar,
      color: "bg-orange-100 text-orange-600",
      change: "Bugün",
    },
    {
      label: "Bu Ay Gelir",
      value: formatCurrency(monthlyRevenue),
      icon: TrendingUp,
      color: "bg-purple-100 text-purple-600",
      change: null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yönetici Paneli</h1>
          <p className="text-sm text-gray-500 mt-1">Veterineri Bul platform genel bakış</p>
        </div>
        {/* Realtime subscription — only on this page */}
        <AdminRealtimeStats />
      </div>

      {/* Wrong panel warning */}
      {(wrong_panel === "owner" || wrong_panel === "vet") && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800">
              {wrong_panel === "owner" ? "Pet Sahibi" : "Veteriner"} Paneline Erişilemiyor
            </p>
            <p className="text-sm text-orange-700 mt-0.5">
              Bu hesap bir yönetici hesabıdır. Yalnızca yönetici panelini kullanabilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* Subscription system status */}
      {!SUBSCRIPTIONS_ENABLED && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800">
            <strong>Abonelik sistemi kapalı — Beta dönemi.</strong>{" "}
            Tüm veterinerler Premium tier&apos;ı ücretsiz kullanıyor. Ücretlendirme:{" "}
            <span className="font-semibold">{FREE_PERIOD_END}</span>
          </p>
        </div>
      )}

      {/* Critical Alerts */}
      {(pendingVets || 0) > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800">
            <strong>{pendingVets}</strong> veteriner onay bekliyor.{" "}
            <Link href="/admin/vets?filter=pending" className="underline font-medium">
              Onaylamak için tıklayın
            </Link>
          </p>
        </div>
      )}

      {recentErrors && recentErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <Activity className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800">
            <strong>{recentErrors.length}</strong> kritik sistem hatası.{" "}
            <Link href="/admin/monitoring" className="underline font-medium">
              Görüntüle
            </Link>
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {stat.change && (
                    <span className="text-xs text-green-600 font-medium">{stat.change}</span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AdminActivityFeed />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Charts */}
        <div className="xl:col-span-2">
          <AdminStatsCharts
            appointmentData={appointmentChartData}
            registrationData={registrationChartData}
          />
        </div>

        {/* Turkey Map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Veteriner Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <TurkeyMap cityData={cityCount} />
            <div className="mt-3 space-y-1">
              {Object.entries(cityCount)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([city, count]) => (
                  <div key={city} className="flex justify-between text-sm">
                    <span className="text-gray-600">{city}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Büyüme Fırsatları — şehirler with least vets */}
      {Object.keys(cityCount).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              Büyüme Fırsatları
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500 mb-3">En az veteriner bulunan 5 şehir:</p>
            <div className="space-y-2">
              {Object.entries(cityCount)
                .sort(([, a], [, b]) => a - b)
                .slice(0, 5)
                .map(([city, count]) => (
                  <div key={city} className="flex items-center justify-between p-2.5 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📍</span>
                      <span className="text-sm font-medium text-gray-800">{city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-orange-700 font-bold">{count} veteriner</span>
                      <Link href={`/admin/vets?city=${encodeURIComponent(city)}`} className="text-xs text-[#166534] hover:underline">Görüntüle</Link>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Toplam Randevu", value: totalAppointments || 0 },
          { label: "Onay Bekleyen", value: pendingVets || 0 },
          { label: "Aktif Abonelikler", value: totalVets || 0 },
          { label: "Bu Ay Toplam", value: (payments || []).length },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xl font-bold text-gray-900">{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
