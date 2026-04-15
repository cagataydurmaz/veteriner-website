"use client";

import {
  LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, Tooltip, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Stethoscope, Calendar, TrendingUp, Star } from "lucide-react";

type MonthPoint = { month: string; value: number };
type DistPoint = { name: string; value: number };
type VetEntry = { id: string; name: string; city: string; rating: number; appointments: number };

interface Props {
  appointmentTrend: MonthPoint[];
  revenueTrend: MonthPoint[];
  userGrowth: MonthPoint[];
  subscriptionDist: DistPoint[];
  speciesDist: DistPoint[];
  topVets: VetEntry[];
  totalUsers: number;
  totalVets: number;
  totalAppointments: number;
  totalRevenue: number;
}

const SUBSCRIPTION_COLORS: Record<string, string> = {
  basic: "#94a3b8",
  pro: "#3b82f6",
  premium: "#166534",
};

const SPECIES_COLORS = ["#166534", "#3b82f6", "#f97316", "#8b5cf6", "#ec4899", "#06b6d4"];

const TIER_LABELS: Record<string, string> = {
  basic: "Temel",
  pro: "Pro",
  premium: "Premium",
};

function formatTL(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K ₺`;
  return `${value} ₺`;
}

export default function AnalyticsClient({
  appointmentTrend,
  revenueTrend,
  userGrowth,
  subscriptionDist,
  speciesDist,
  topVets,
  totalUsers,
  totalVets,
  totalAppointments,
  totalRevenue,
}: Props) {
  const stats = [
    { label: "Toplam Kullanıcı", value: totalUsers, icon: Users, color: "bg-blue-100 text-blue-600" },
    { label: "Toplam Veteriner", value: totalVets, icon: Stethoscope, color: "bg-purple-100 text-purple-600" },
    { label: "Toplam Randevu", value: totalAppointments, icon: Calendar, color: "bg-orange-100 text-orange-600" },
    { label: "Toplam Gelir", value: formatTL(totalRevenue), icon: TrendingUp, color: "bg-[#F0FDF4] text-[#166534]" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => {
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

      {/* Line chart: appointments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aylık Randevu Trendi</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={appointmentTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(val) => [`${val} randevu`, "Randevu"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#166534"
                strokeWidth={2.5}
                dot={{ fill: "#166534", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bar chart: revenue */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aylık Gelir</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTL} />
              <Tooltip
                formatter={(val) => [formatTL(Number(val)), "Gelir"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="value" fill="#166534" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Line chart: user growth */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Kullanıcı Büyümesi (Son 6 Ay)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={userGrowth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(val) => [`${val} kullanıcı`, "Yeni Kayıt"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ fill: "#3b82f6", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pie charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subscription distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Abonelik Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptionDist.every(d => d.value === 0) ? (
              <div className="text-center py-10 text-sm text-gray-400">Veri yok</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={subscriptionDist}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => {
                      const safeName = name ?? "";
                      const safePercent = percent ?? 0;
                      return `${TIER_LABELS[safeName] || safeName} ${(safePercent * 100).toFixed(0)}%`;
                    }}
                    labelLine={false}
                  >
                    {subscriptionDist.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={SUBSCRIPTION_COLORS[entry.name] || SPECIES_COLORS[i % SPECIES_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [val, TIER_LABELS[String(name)] || String(name)]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend
                    formatter={name => TIER_LABELS[name] || name}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Species distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hayvan Türleri</CardTitle>
          </CardHeader>
          <CardContent>
            {speciesDist.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">Veri yok</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={speciesDist}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => {
                      const safePercent = percent ?? 0;
                      return `${name ?? ""} ${(safePercent * 100).toFixed(0)}%`;
                    }}
                    labelLine={false}
                  >
                    {speciesDist.map((entry, i) => (
                      <Cell key={entry.name} fill={SPECIES_COLORS[i % SPECIES_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 5 vets table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top 5 Veteriner</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Veteriner</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Şehir</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Randevu</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Puan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topVets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-gray-400">
                      Veteriner bulunamadı
                    </td>
                  </tr>
                ) : topVets.map((vet, i) => (
                  <tr key={vet.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-gray-400">#{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      Vet. Hek. {vet.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{vet.city}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{vet.appointments}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-sm font-semibold text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {vet.rating > 0 ? vet.rating.toFixed(1) : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
