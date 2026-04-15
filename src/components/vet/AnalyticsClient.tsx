"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, Users, Calendar, Star, Video, MapPin,
  Award, Clock, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";

type Preset = "thisMonth" | "last3" | "last6" | "thisYear" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "thisMonth", label: "Bu Ay" },
  { id: "last3",     label: "Son 3 Ay" },
  { id: "last6",     label: "Son 6 Ay" },
  { id: "thisYear",  label: "Bu Yıl" },
];

function getPresetRange(preset: Preset): { from: Date; to: Date } {
  const now  = new Date();
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  switch (preset) {
    case "thisMonth": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to };
    }
    case "last3": {
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { from, to };
    }
    case "last6": {
      const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { from, to };
    }
    case "thisYear": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from, to };
    }
    default: {
      const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { from, to };
    }
  }
}

interface Stats {
  totalCompleted:    number;
  thisRangeCompleted:number;
  totalVideo:        number;
  totalInPerson:     number;
  totalPending:      number;
  revenue:           number;
  monthlyData:       { month: string; count: number; revenue: number }[];
  byDay:             { day: string; count: number }[];
  topSpecies:        string | null;
  topComplaint:      string | null;
  avgRating:         number | null;
  totalReviews:      number;
}

const MONTHS_TR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
const DAYS_TR   = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];

export default function AnalyticsClient({
  vetId,
  avgRating,
  totalReviews,
}: {
  vetId: string;
  avgRating: number | null;
  totalReviews: number;
}) {
  const [preset,   setPreset]   = useState<Preset>("last6");
  const [showMenu, setShowMenu] = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [stats,    setStats]    = useState<Stats | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchStats = useCallback(async (p: Preset) => {
    setLoading(true);
    const { from, to } = getPresetRange(p);
    const fromIso = from.toISOString();
    const toIso   = to.toISOString();
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

    const [
      { count: totalCompleted },
      { count: rangeCompleted },
      { count: totalVideo },
      { count: totalInPerson },
      { count: totalPending },
      { data: payments },
      { data: appointments },
      { data: monthlyApts },
    ] = await Promise.all([
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("vet_id", vetId).eq("status", "completed"),
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("vet_id", vetId).eq("status", "completed").gte("datetime", fromIso).lte("datetime", toIso),
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("vet_id", vetId).eq("type", "video").eq("status", "completed"),
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("vet_id", vetId).eq("type", "in_person").eq("status", "completed"),
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("vet_id", vetId).eq("status", "pending"),
      supabase.from("payments").select("amount").eq("vet_id", vetId)
        .eq("status", "success").gte("created_at", fromIso).lte("created_at", toIso),
      supabase.from("appointments").select("datetime, status, type")
        .eq("vet_id", vetId).gte("datetime", yearStart).order("datetime"),
      supabase.from("appointments")
        .select("pet_id, complaint, pet:pets(species)")
        .eq("vet_id", vetId).eq("status", "completed")
        .gte("datetime", fromIso).lte("datetime", toIso),
    ]);

    // Monthly breakdown within the selected range
    const months: { month: string; count: number; revenue: number }[] = [];
    const cur = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cur <= to) {
      const y = cur.getFullYear(); const m = cur.getMonth();
      const label = `${MONTHS_TR[m]} ${y !== new Date().getFullYear() ? String(y).slice(2) : ""}`.trim();
      const count = (appointments || []).filter((a: { datetime: string; status: string }) => {
        const d = new Date(a.datetime);
        return d.getMonth() === m && d.getFullYear() === y && a.status === "completed";
      }).length;
      months.push({ month: label, count, revenue: 0 });
      cur.setMonth(cur.getMonth() + 1);
    }

    // Day of week
    const dayCount = Array(7).fill(0);
    (appointments || []).forEach((a: { datetime: string }) => {
      dayCount[new Date(a.datetime).getDay()]++;
    });
    const byDay = dayCount.map((count, i) => ({ day: DAYS_TR[i], count }));

    // Species + complaint
    const speciesMap: Record<string, number> = {};
    const complaintMap: Record<string, number> = {};
    (monthlyApts || []).forEach((a: { pet?: { species?: string } | { species?: string }[] | null; complaint?: string }) => {
      const s = (Array.isArray(a.pet) ? a.pet[0] : a.pet)?.species || "Diğer";
      speciesMap[s] = (speciesMap[s] || 0) + 1;
      if (a.complaint) complaintMap[a.complaint] = (complaintMap[a.complaint] || 0) + 1;
    });
    const topSpecies  = Object.entries(speciesMap).sort(([,a],[,b])  => b - a)[0]?.[0] ?? null;
    const topComplaint= Object.entries(complaintMap).sort(([,a],[,b]) => b - a)[0]?.[0] ?? null;

    const revenue = (payments || []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0);

    setStats({
      totalCompleted:     totalCompleted    || 0,
      thisRangeCompleted: rangeCompleted    || 0,
      totalVideo:         totalVideo        || 0,
      totalInPerson:      totalInPerson     || 0,
      totalPending:       totalPending      || 0,
      revenue,
      monthlyData: months,
      byDay,
      topSpecies,
      topComplaint,
      avgRating,
      totalReviews,
    });
    setLoading(false);
  }, [supabase, vetId, avgRating, totalReviews]);

  useEffect(() => { fetchStats(preset); }, [fetchStats, preset]);

  const presetLabel = PRESETS.find(p => p.id === preset)?.label ?? "";
  const s = stats;

  return (
    <div className="space-y-6">
      {/* ── Header + date picker ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analitiğim</h1>
          <p className="text-sm text-gray-500 mt-0.5">Performans ve istatistikler</p>
        </div>

        {/* Preset picker */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-[#166534] hover:text-[#166534] transition-colors shadow-sm"
          >
            <Calendar className="w-4 h-4" />
            {presetLabel}
            <ChevronDown className={`w-4 h-4 transition-transform ${showMenu ? "rotate-180" : ""}`} />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setPreset(p.id); setShowMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    preset === p.id ? "bg-[#F0FDF4] text-[#166534] font-medium" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-[#166534] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : s ? (
        <>
          {/* ── KPI cards ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: `${presetLabel} Tamamlanan`, value: s.thisRangeCompleted, icon: Calendar,  color: "bg-[#F0FDF4] text-[#166534]" },
              { label: `${presetLabel} Gelir`,      value: formatCurrency(s.revenue), icon: TrendingUp, color: "bg-purple-100 text-purple-600" },
              { label: "Toplam Hasta",               value: s.totalCompleted,     icon: Users,     color: "bg-blue-100 text-blue-600" },
              { label: "Ortalama Puan",              value: s.avgRating ? s.avgRating.toFixed(1) : "—", icon: Star, color: "bg-yellow-100 text-yellow-600" },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="pt-5 pb-5">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Charts row ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly bar chart — Recharts */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tamamlanan Randevular</CardTitle>
              </CardHeader>
              <CardContent>
                {s.monthlyData.every(m => m.count === 0) ? (
                  <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Bu dönemde veri yok</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={s.monthlyData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                        cursor={{ fill: "#f0fdf4" }}
                        formatter={(v) => [v ?? 0, "Randevu"]}
                      />
                      <Bar dataKey="count" fill="#166534" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Appointment type split */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Randevu Türleri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Yüz Yüze", count: s.totalInPerson, icon: MapPin,  color: "bg-[#166534]" },
                  { label: "Video",    count: s.totalVideo,    icon: Video,   color: "bg-blue-500" },
                  { label: "Bekleyen", count: s.totalPending,  icon: Clock,   color: "bg-yellow-400" },
                ].map(item => {
                  const total = s.totalCompleted + s.totalPending;
                  const pct   = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  const Icon  = item.icon;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-sm text-gray-700">{item.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{item.count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* ── Day of week — Recharts ───────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-[#166534]" />
                Günlere Göre Yoğunluk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={s.byDay} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                    cursor={{ fill: "#f0fdf4" }}
                    formatter={(v) => [v ?? 0, "Randevu"]}
                  />
                  <Bar dataKey="count" fill="#4ade80" radius={[3, 3, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Insights row ────────────────────────────────────────────────── */}
          {(s.topSpecies || s.topComplaint) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s.topSpecies && (
                <Card>
                  <CardContent className="pt-5 pb-5">
                    <p className="text-xs text-gray-500 mb-1">En Sık Gelen Tür ({presetLabel})</p>
                    <p className="text-xl font-bold text-blue-700">{s.topSpecies}</p>
                  </CardContent>
                </Card>
              )}
              {s.topComplaint && (
                <Card>
                  <CardContent className="pt-5 pb-5">
                    <p className="text-xs text-gray-500 mb-1">En Sık Şikayet ({presetLabel})</p>
                    <p className="text-sm font-bold text-orange-700 truncate">{s.topComplaint}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── Rating summary ───────────────────────────────────────────────── */}
          {s.totalReviews > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  Değerlendirme Özeti
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-gray-900">{s.avgRating?.toFixed(1)}</p>
                  <div className="flex gap-0.5 justify-center mt-1">
                    {[1,2,3,4,5].map(n => (
                      <Star
                        key={n}
                        className={`w-4 h-4 ${n <= Math.round(s.avgRating || 0) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{s.totalReviews} değerlendirme</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
