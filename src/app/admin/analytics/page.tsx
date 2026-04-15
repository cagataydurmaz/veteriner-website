import { createServiceClient } from "@/lib/supabase/server";
import AnalyticsClient from "./client";

type MonthPoint = { month: string; value: number };

function buildMonthBuckets(): { label: string; year: number; month: number }[] {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      label: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return buckets;
}

export default async function AdminAnalyticsPage() {
  const supabase = createServiceClient();
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const [
    { data: appointments },
    { data: payments },
    { data: users },
    { data: vetStats },
    { data: subscriptions },
    { data: pets },
    { count: totalUsers },
    { count: totalVets },
    { count: totalAppointments },
  ] = await Promise.all([
    supabase.from("appointments").select("created_at").gte("created_at", sixMonthsAgo),
    supabase.from("payments").select("amount, created_at").eq("status", "success").gte("created_at", sixMonthsAgo),
    supabase.from("users").select("created_at").gte("created_at", sixMonthsAgo),
    supabase
      .from("veterinarians")
      .select(`
        id, city, rating_avg,
        user:users!veterinarians_user_id_fkey(full_name),
        appointment_count:appointments(count)
      `)
      .order("rating_avg", { ascending: false })
      .limit(10),
    supabase.from("veterinarians").select("subscription_tier"),
    supabase.from("pets").select("species"),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("veterinarians").select("*", { count: "exact", head: true }),
    supabase.from("appointments").select("*", { count: "exact", head: true }),
  ]);

  const buckets = buildMonthBuckets();

  // Monthly appointments
  const appointmentTrend: MonthPoint[] = buckets.map(b => ({
    month: b.label,
    value: (appointments || []).filter(a => {
      const d = new Date(a.created_at);
      return d.getMonth() === b.month && d.getFullYear() === b.year;
    }).length,
  }));

  // Monthly revenue
  const revenueTrend: MonthPoint[] = buckets.map(b => ({
    month: b.label,
    value: (payments || [])
      .filter(p => {
        const d = new Date(p.created_at);
        return d.getMonth() === b.month && d.getFullYear() === b.year;
      })
      .reduce((s, p) => s + Number(p.amount), 0),
  }));

  // User growth
  const userGrowth: MonthPoint[] = buckets.map(b => ({
    month: b.label,
    value: (users || []).filter(u => {
      const d = new Date(u.created_at);
      return d.getMonth() === b.month && d.getFullYear() === b.year;
    }).length,
  }));

  // Subscription distribution
  const tierCounts: Record<string, number> = { basic: 0, pro: 0, premium: 0 };
  (subscriptions || []).forEach((v: { subscription_tier: string }) => {
    const tier = v.subscription_tier || "basic";
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  });
  const subscriptionDist = Object.entries(tierCounts).map(([name, value]) => ({ name, value }));

  // Species distribution
  const speciesCounts: Record<string, number> = {};
  (pets || []).forEach((p: { species: string }) => {
    const s = p.species || "diğer";
    speciesCounts[s] = (speciesCounts[s] || 0) + 1;
  });
  const speciesDist = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Top 5 vets
  type VetStatRaw = {
    id: string;
    city: string | null;
    rating_avg: number | null;
    user: { full_name: string } | { full_name: string }[] | null;
    appointment_count: { count: number }[] | number | null;
  };

  const topVets = ((vetStats || []) as VetStatRaw[])
    .map(v => {
      const apptCount = Array.isArray(v.appointment_count)
        ? (v.appointment_count[0]?.count ?? 0)
        : typeof v.appointment_count === "number"
        ? v.appointment_count
        : 0;
      const name = Array.isArray(v.user)
        ? v.user[0]?.full_name || "—"
        : v.user?.full_name || "—";
      return {
        id: v.id,
        name,
        city: v.city || "—",
        rating: v.rating_avg ?? 0,
        appointments: apptCount,
      };
    })
    .sort((a, b) => b.appointments - a.appointments)
    .slice(0, 5);

  const totalRevenue = (payments || []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analitik</h1>
        <p className="text-sm text-gray-500 mt-1">Platform büyüme ve performans verileri</p>
      </div>

      <AnalyticsClient
        appointmentTrend={appointmentTrend}
        revenueTrend={revenueTrend}
        userGrowth={userGrowth}
        subscriptionDist={subscriptionDist}
        speciesDist={speciesDist}
        topVets={topVets}
        totalUsers={totalUsers ?? 0}
        totalVets={totalVets ?? 0}
        totalAppointments={totalAppointments ?? 0}
        totalRevenue={totalRevenue}
      />
    </div>
  );
}
