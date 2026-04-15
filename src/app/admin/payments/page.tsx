import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CreditCard, Users, Calendar } from "lucide-react";

type Payment = {
  id: string;
  amount: number;
  status: string;
  type: string;
  created_at: string;
  vet: { user: { full_name: string } | null; city: string | null } | null;
  user: { full_name: string } | null;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  success:          { label: "Başarılı",       color: "bg-green-100 text-green-700"  },
  pending:          { label: "Beklemede",       color: "bg-yellow-100 text-yellow-700"},
  held:             { label: "Tutuldu",         color: "bg-blue-100 text-blue-700"   },
  failed:           { label: "Başarısız",       color: "bg-red-100 text-red-700"     },
  refunded:         { label: "İade",            color: "bg-gray-100 text-gray-700"   },
  refunded_full:    { label: "Tam İade",        color: "bg-gray-100 text-gray-700"   },
  refunded_partial: { label: "Kısmi İade",      color: "bg-orange-100 text-orange-700"},
  refund_failed:    { label: "İade Başarısız",  color: "bg-red-100 text-red-700"     },
  paid_at_clinic:   { label: "Klinikte Ödendi", color: "bg-purple-100 text-purple-700"},
};

export default async function AdminPaymentsPage() {
  const supabase = createServiceClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const [
    { data: payments },
    { data: thisMonth },
    { data: lastMonth },
    { count: totalVets },
  ] = await Promise.all([
    supabase.from("payments").select(`
      id, amount, status, type, created_at,
      vet:veterinarians(city, user:users(full_name)),
      user:users(full_name)
    `).order("created_at", { ascending: false }).limit(100),
    supabase.from("payments").select("amount").eq("status", "success").gte("created_at", monthStart),
    supabase.from("payments").select("amount").eq("status", "success")
      .gte("created_at", lastMonthStart).lte("created_at", lastMonthEnd),
    supabase.from("veterinarians").select("*", { count: "exact", head: true })
      .neq("subscription_tier", "basic"),
  ]);

  const thisMonthTotal = (thisMonth || []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0);
  const lastMonthTotal = (lastMonth || []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0);
  const growthPct = lastMonthTotal > 0
    ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
    : 0;

  const allPayments = (payments || []) as unknown as Payment[];
  const successTotal = allPayments
    .filter(p => p.status === "success")
    .reduce((s, p) => s + Number(p.amount), 0);

  // Monthly breakdown last 6 months
  const months: { label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("tr-TR", { month: "short" });
    const total = allPayments
      .filter(p => {
        const pd = new Date(p.created_at);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear() && p.status === "success";
      })
      .reduce((s, p) => s + Number(p.amount), 0);
    months.push({ label, total });
  }
  const maxTotal = Math.max(...months.map(m => m.total), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ödeme Yönetimi</h1>
        <p className="text-sm text-gray-500 mt-1">Platform gelir takibi</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Bu Ay Gelir",
            value: formatCurrency(thisMonthTotal),
            change: `${growthPct >= 0 ? "+" : ""}${growthPct}%`,
            changeColor: growthPct >= 0 ? "text-green-600" : "text-red-500",
            icon: TrendingUp,
            color: "bg-[#F0FDF4] text-[#166534]",
          },
          {
            label: "Toplam Gelir",
            value: formatCurrency(successTotal),
            icon: CreditCard,
            color: "bg-purple-100 text-purple-600",
          },
          {
            label: "Aktif Abonelik",
            value: totalVets || 0,
            icon: Users,
            color: "bg-blue-100 text-blue-600",
          },
          {
            label: "Bu Ay İşlem",
            value: (thisMonth || []).length,
            icon: Calendar,
            color: "bg-orange-100 text-orange-600",
          },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {"change" in stat && (
                    <span className={`text-xs font-medium ${"changeColor" in stat ? stat.changeColor : ""}`}>
                      {stat.change}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Monthly Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Son 6 Ay — Gelir</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-32">
            {months.map(m => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-600">
                  {m.total > 0 ? formatCurrency(m.total).replace("₺", "").trim() : ""}
                </span>
                <div
                  className="w-full bg-[#166534] rounded-t-md"
                  style={{ height: `${Math.max((m.total / maxTotal) * 100, 4)}%` }}
                />
                <span className="text-[10px] text-gray-500">{m.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Son İşlemler</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Veteriner</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kullanıcı</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tutar</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Durum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allPayments.map(p => {
                  const s = STATUS_MAP[p.status] || { label: p.status, color: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        Vet. Hek. {p.vet?.user?.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {p.user?.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                        {formatDateTime(p.created_at)}
                      </td>
                    </tr>
                  );
                })}
                {allPayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-sm text-gray-500">
                      Henüz ödeme kaydı yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
