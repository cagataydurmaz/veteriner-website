import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/queries";
import { formatDate, getSpeciesEmoji, formatCurrency } from "@/lib/utils";
import AccountStatusBanner from "@/components/ui/AccountStatusBanner";
import CookieStatusBanner from "@/components/ui/CookieStatusBanner";
import DashboardMasterToggle from "@/components/vet/DashboardMasterToggle";

export const metadata: Metadata = { title: "Veteriner Paneli" };
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CalendarDays,
  Star,
  Video,
  MapPin,
  ChevronRight,
  AlertCircle,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import type { Appointment } from "@/types";
import AppointmentActions from "@/components/vet/AppointmentActions";
import NobetciRequestNotification from "@/components/vet/NobetciRequestNotification";
import NewAppointmentListener from "@/components/vet/NewAppointmentListener";

export default async function VetDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ wrong_panel?: string }>;
}) {
  const { wrong_panel } = await searchParams;
  // Opt out of full-route caching — dashboard data (appointments, revenue)
  // must always be fresh. staleTimes: { dynamic: 0 } in next.config handles
  // the client router; noStore() ensures the RSC payload is never served stale
  // from the Next.js full-route cache on the server.
  noStore();

  // getAuthUser() is cached — no extra round-trip vs. what layout already called
  const { data: { user } } = await getAuthUser();
  if (!user) redirect("/auth/vet-login");

  const supabase = await createClient();

  // Expanded select: include toggle-state fields needed by DashboardMasterToggle
  const { data: vet } = await supabase
    .from("veterinarians")
    .select(`
      id, is_verified, account_status, suspended_until, suspension_reason,
      average_rating, total_reviews,
      offers_nobetci, offers_in_person, offers_video,
      is_online_now, is_available_today, is_on_call, is_busy, buffer_lock,
      video_consultation_fee,
      user:users(full_name)
    `)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vet) redirect("/vet/profile");

  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString();

  const [
    { data: todayAppointments },
    { count: monthlyCount },
    { count: pendingCount },
    { data: payments },
    { data: heldPayments },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(`
        *,
        pet:pets(name, species, allergies, chronic_conditions),
        owner:users(full_name, phone)
      `)
      .eq("vet_id", vet.id)
      .gte("datetime", `${today}T00:00:00`)
      .lt("datetime", `${today}T23:59:59`)
      .order("datetime", { ascending: true }),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("vet_id", vet.id)
      .gte("datetime", monthStartIso)
      .eq("status", "completed"),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("vet_id", vet.id)
      .eq("status", "pending"),
    supabase
      .from("payments")
      .select("amount, platform_commission, vet_payout, status")
      .eq("vet_id", vet.id)
      .gte("created_at", monthStartIso)
      .in("status", ["success", "released"]),
    supabase
      .from("payments")
      .select("amount", { count: "exact" })
      .eq("vet_id", vet.id)
      .eq("status", "held"),
  ]);

  const todayPetIds = (todayAppointments || []).map((apt: Appointment) => apt.pet_id).filter(Boolean);
  const { data: lastVisitData } = todayPetIds.length ? await supabase
    .from("appointments")
    .select("pet_id, datetime, medical_records(vet_notes)")
    .in("pet_id", todayPetIds)
    .eq("status", "completed")
    .neq("vet_id", vet.id)
    .order("datetime", { ascending: false })
    .limit(todayPetIds.length * 5)
    : { data: [] };

  const lastVisitByPet: Record<string, { datetime: string; note?: string }> = {};
  (lastVisitData || []).forEach((v: { pet_id: string; datetime: string; medical_records?: { vet_notes?: string }[] }) => {
    if (!lastVisitByPet[v.pet_id]) {
      const note = Array.isArray(v.medical_records) ? v.medical_records[0]?.vet_notes : undefined;
      lastVisitByPet[v.pet_id] = { datetime: v.datetime, note };
    }
  });

  type PaymentRow = { amount: number; platform_commission: number | null; vet_payout: number | null; status: string };
  const paymentRows = (payments || []) as PaymentRow[];

  // Brüt Kazanç = sum of amounts
  const monthlyRevenue = paymentRows.reduce((s, p) => s + Number(p.amount), 0);
  // Platform Komisyonu = sum of platform_commission (falls back to 15% if null = legacy row)
  const monthlyCommission = paymentRows.reduce(
    (s, p) => s + Number(p.platform_commission ?? (Number(p.amount) * 0.15)),
    0
  );
  // Net Hak Ediş = sum of vet_payout (falls back to amount - commission if null)
  const monthlyNetPayout = paymentRows.reduce(
    (s, p) => s + Number(p.vet_payout ?? (Number(p.amount) - Number(p.platform_commission ?? Number(p.amount) * 0.15))),
    0
  );

  type HeldPaymentRow = { amount: number };
  const heldPaymentRows = (heldPayments || []) as HeldPaymentRow[];
  const pendingRevenue = heldPaymentRows.reduce((s, p) => s + Number(p.amount), 0);

  const vetUserObj = Array.isArray(vet.user) ? vet.user[0] : vet.user as { full_name?: string } | null;
  const firstName = vetUserObj?.full_name?.split(" ")?.[0] || "Dr.";

  // First upcoming appointment today (for "Up Next" card)
  type AptRow = Appointment & {
    pet: { name: string; species: string; allergies: string | null; chronic_conditions: string | null };
    owner: { full_name: string; phone: string | null };
  };
  const appointments = (todayAppointments || []) as AptRow[];
  const nextApt = appointments[0] ?? null;

  return (
    <div className="space-y-5" data-testid="vet-dashboard" data-vet-id={vet.id}>
      {/* Nöbetçi instant request notification — shows as overlay when patient connects */}
      {vet.offers_nobetci && <NobetciRequestNotification vetId={vet.id} />}

      {/* Realtime new-appointment listener — refreshes dashboard when owner books */}
      <NewAppointmentListener vetId={vet.id} />

      <CookieStatusBanner />

      {vet.account_status && vet.account_status !== "active" && (
        <AccountStatusBanner
          status={vet.account_status as "active" | "under_review" | "suspended" | "banned" | "deleted"}
          suspendedUntil={vet.suspended_until ?? null}
          reason={vet.suspension_reason ?? null}
        />
      )}

      {/* Wrong panel warnings */}
      {wrong_panel === "owner" && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800">Pet Sahibi Paneline Erişilemiyor</p>
            <p className="text-sm text-orange-700 mt-0.5">
              Bu hesap bir veteriner hesabıdır. Pet Sahibi panelini kullanmak için
              farklı bir e-posta ile ayrı bir hesap oluşturmanız gerekiyor.
            </p>
          </div>
        </div>
      )}
      {wrong_panel === "admin" && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800">Yönetici Paneline Erişilemiyor</p>
            <p className="text-sm text-orange-700 mt-0.5">
              Bu hesap bir veteriner hesabıdır. Yönetici paneli için yönetici hesabı gereklidir.
            </p>
          </div>
        </div>
      )}

      {!vet.is_verified && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">Hesabınız onay bekliyor</p>
            <p className="text-sm text-yellow-700 mt-1">
              Lisans belgeniz inceleniyor. Onaylandıktan sonra randevu alabilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* ── Header + compact stats snippet ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {formatDate(new Date())}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Veteriner Paneli</p>
        </div>

        {/* Stats snippet — a compact read-only row of key numbers */}
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <Link href="/vet/appointments" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-[#166534]" />
            <span className="font-bold text-gray-900">{appointments.length}</span>
            <span className="text-gray-400">bugün</span>
          </Link>
          {(pendingCount ?? 0) > 0 && (
            <Link href="/vet/appointments" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-50 border border-yellow-100 hover:border-yellow-200 transition-colors">
              <span className="font-bold text-yellow-700">{pendingCount}</span>
              <span className="text-yellow-600 text-xs">bekleyen</span>
            </Link>
          )}
          {monthlyRevenue > 0 && (
            <Link href="/vet/analytics" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
              <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-bold text-gray-900">{formatCurrency(monthlyNetPayout)}</span>
              <span className="text-gray-400 text-xs">net bu ay</span>
            </Link>
          )}
          {pendingRevenue > 0 && (
            <Link href="/vet/analytics" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-100 hover:border-orange-200 transition-colors">
              <span className="font-bold text-orange-600">{formatCurrency(pendingRevenue)}</span>
              <span className="text-orange-400 text-xs">escrow</span>
            </Link>
          )}
          {vet.average_rating ? (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span className="font-bold text-gray-900">{vet.average_rating.toFixed(1)}</span>
              <span className="text-gray-400 text-xs">({vet.total_reviews})</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Master Toggle (Cambly-style Go Online card) ───────────────────────── */}
      {vet.is_verified && (
        <DashboardMasterToggle
          vetId={vet.id}
          initialState={{
            // Layer 1 — service permissions (reactive)
            offers_nobetci:   vet.offers_nobetci   ?? false,
            offers_in_person: vet.offers_in_person ?? false,
            offers_video:     vet.offers_video     ?? false,
            // Layer 2 — intent toggles
            is_available_today: vet.is_available_today ?? false,
            is_online_now:      vet.is_online_now      ?? false,
            is_on_call:         vet.is_on_call         ?? false,
            // Layer 3 — reality checks
            is_busy:     vet.is_busy     ?? false,
            buffer_lock: vet.buffer_lock ?? false,
          }}
          offersVideo={vet.offers_video ?? false}
          videoConsultationFee={vet.video_consultation_fee ?? null}
          firstName={firstName}
        />
      )}

      {/* ── Sıradaki Randevu (Up Next) ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Sıradaki Randevu
          </p>
          <Link href="/vet/appointments">
            <Button variant="ghost" size="sm" className="text-[#166534] h-7 text-xs px-2">
              Tümünü Gör <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </Link>
        </div>

        {nextApt ? (
          /* Next appointment card */
          <Link href={`/vet/appointments/${nextApt.id}`}>
            <Card className="hover:shadow-sm transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Time */}
                  <div className="text-center shrink-0 w-14">
                    <p className="text-base font-black text-[#166534]">
                      {new Date(nextApt.datetime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(nextApt.datetime).toLocaleDateString("tr-TR", { weekday: "short" })}
                    </p>
                  </div>

                  <div className="w-px h-10 bg-gray-100 shrink-0" />

                  {/* Pet avatar */}
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-xl shrink-0">
                    {getSpeciesEmoji(nextApt.pet?.species || "")}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{nextApt.pet?.name}</p>
                    <p className="text-xs text-gray-400">{nextApt.owner?.full_name}</p>
                    {lastVisitByPet[nextApt.pet_id] && (
                      <p className="text-xs text-blue-500 mt-0.5 truncate">
                        Son ziyaret: {new Date(lastVisitByPet[nextApt.pet_id].datetime).toLocaleDateString("tr-TR")}
                      </p>
                    )}
                  </div>

                  {/* Type + action */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {nextApt.type === "video" ? (
                      <Badge variant="default" className="text-xs">
                        <Video className="w-3 h-3 mr-1" /> Video
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <MapPin className="w-3 h-3 mr-1" /> Yüz Yüze
                      </Badge>
                    )}
                    {nextApt.status === "pending" ? (
                      <AppointmentActions appointmentId={nextApt.id} />
                    ) : (
                      <Badge className="bg-green-100 text-green-700 text-xs">Onaylandı</Badge>
                    )}
                  </div>
                </div>

                {/* Inline alerts */}
                {(nextApt.pet?.chronic_conditions || nextApt.pet?.allergies) && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
                    {nextApt.pet.chronic_conditions && (
                      <span className="text-xs text-purple-600 bg-purple-50 rounded-lg px-2 py-0.5">
                        🏥 {nextApt.pet.chronic_conditions}
                      </span>
                    )}
                    {nextApt.pet.allergies && (
                      <span className="text-xs text-orange-600 bg-orange-50 rounded-lg px-2 py-0.5">
                        ⚠️ Alerji: {nextApt.pet.allergies}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ) : (
          /* Empty state — appointment-free day */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
              <div className="text-4xl select-none">😊</div>
              <div>
                <p className="font-semibold text-gray-800">Bugün harika görünüyorsun!</p>
                <p className="text-sm text-gray-400 mt-1">
                  Şu an bekleyen randevun yok.
                </p>
              </div>
              <Link href="/vet/appointments?tab=musaitlik">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CalendarDays className="w-4 h-4" />
                  Takvimi İncele
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Remaining today's appointments — condensed list */}
        {appointments.length > 1 && (
          <div className="mt-2 space-y-1.5">
            {appointments.slice(1).map((apt) => (
              <Link key={apt.id} href={`/vet/appointments/${apt.id}`}>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <p className="text-xs font-bold text-gray-500 w-12 shrink-0">
                    {new Date(apt.datetime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <span className="text-base">{getSpeciesEmoji(apt.pet?.species || "")}</span>
                  <p className="text-sm text-gray-700 font-medium flex-1 truncate">
                    {apt.pet?.name} · {apt.owner?.full_name}
                  </p>
                  {apt.status === "pending" && (
                    <span className="text-[10px] font-semibold text-yellow-600 bg-yellow-50 border border-yellow-100 px-2 py-0.5 rounded-full shrink-0">
                      Bekliyor
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Financial snippet (only when there's data) ───────────────────────── */}
      {monthlyRevenue > 0 && (
        <Link href="/vet/analytics">
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-colors">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Bu ay özet</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-500">{formatCurrency(monthlyRevenue)} brüt</span>
              <span className="text-red-400">−{formatCurrency(monthlyCommission)} kom.</span>
              <span className="font-bold text-green-600">{formatCurrency(monthlyNetPayout)} net</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          </div>
        </Link>
      )}
    </div>
  );
}
