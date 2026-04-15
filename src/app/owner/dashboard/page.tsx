import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatRelative, isUpcoming, getSpeciesEmoji, formatDate } from "@/lib/utils";
import AccountStatusBanner from "@/components/ui/AccountStatusBanner";
import CookieStatusBanner from "@/components/ui/CookieStatusBanner";

export const metadata: Metadata = { title: "Panelim" };
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  PawPrint,
  AlertTriangle,
  Clock,
  Plus,
  ChevronRight,
  ShieldAlert,
  Video,
} from "lucide-react";
import type { Pet, Appointment, Vaccine } from "@/types";
import CountdownTimer from "@/components/owner/CountdownTimer";

export default async function OwnerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ wrong_panel?: string }>;
}) {
  const { wrong_panel } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const nowIso = new Date().toISOString();
  const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Fetch user data, pets, appointments and imminent video all in parallel
  const [
    { data: userData },
    { data: pets },
    { data: appointments },
    { data: imminentVideo },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("*, account_status, suspended_until, suspension_reason")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("pets")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select(`
        *,
        pet:pets(name, species),
        vet:veterinarians(
          user:users(full_name),
          specialty,
          city
        )
      `)
      .eq("owner_id", user.id)
      .in("status", ["pending", "confirmed"])
      .gte("datetime", nowIso)
      .order("datetime", { ascending: true })
      .limit(3),
    supabase
      .from("appointments")
      .select("id, datetime, pet:pets(name)")
      .eq("owner_id", user.id)
      .eq("type", "video")
      .eq("status", "confirmed")
      .gte("datetime", oneHourAgo)
      .lte("datetime", tenMinFromNow)
      .order("datetime", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  // Fetch overdue vaccines
  const petIds = (pets || []).map((p: Pet) => p.id);
  const { data: overdueVaccines } = petIds.length
    ? await supabase
        .from("vaccines")
        .select(`*, pet:pets(name)`)
        .in("pet_id", petIds)
        .lte("next_due_date", new Date().toISOString().split("T")[0])
        .not("next_due_date", "is", null)
    : { data: [] };

  const overdueByPet = (overdueVaccines || []).reduce((acc: Record<string, number>, v: { pet_id: string }) => {
    acc[v.pet_id] = (acc[v.pet_id] || 0) + 1;
    return acc;
  }, {});

  const dashToday = new Date().toISOString().split("T")[0];
  const dashThirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const dashSixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: dashUpcomingVaccines }, { data: dashRecentVisits }] = await Promise.all([
    petIds.length ? supabase
      .from("vaccines")
      .select("pet_id")
      .in("pet_id", petIds)
      .gt("next_due_date", dashToday)
      .lte("next_due_date", dashThirtyDaysFromNow)
      .not("next_due_date", "is", null) : Promise.resolve({ data: [] }),
    petIds.length ? supabase
      .from("appointments")
      .select("pet_id")
      .in("pet_id", petIds)
      .eq("status", "completed")
      .gte("datetime", dashSixMonthsAgo) : Promise.resolve({ data: [] }),
  ]);

  const recentVisitPetIds = new Set((dashRecentVisits || []).map((r: { pet_id: string }) => r.pet_id));

  const firstName = userData?.full_name?.split(" ")?.[0] || "Merhaba";

  return (
    <div className="space-y-6">
      {/* Cookie-based status banner (client-side, reads middleware-set cookies) */}
      <CookieStatusBanner />

      {/* Account status banner */}
      {userData?.account_status && userData.account_status !== "active" && (
        <AccountStatusBanner
          status={userData.account_status as "active" | "under_review" | "suspended" | "banned" | "deleted"}
          suspendedUntil={userData.suspended_until ?? null}
          reason={userData.suspension_reason ?? null}
        />
      )}

      {/* Wrong panel warning */}
      {wrong_panel === "vet" && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800">Veteriner Paneline Erişilemiyor</p>
            <p className="text-sm text-orange-700 mt-0.5">
              Bu hesap bir Pet Sahibi hesabıdır. Veteriner panelini kullanmak için
              veteriner hesabınızla giriş yapmanız gerekiyor.
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
              Bu hesap bir Pet Sahibi hesabıdır. Yönetici paneli için yönetici hesabı gereklidir.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Merhaba, {firstName}! 👋
          </h1>
          {pets && pets.length > 0 && (
            <p className="text-[#166534] text-sm font-medium mt-0.5">
              {(pets as Pet[]).map((p) => p.name).join(", ")} sizi bekliyor 🐾
            </p>
          )}
          <p className="text-gray-500 text-sm mt-1">
            Bugün {formatDate(new Date())} — Evcil dostlarınız nasıl?
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/owner/appointments/book">
            <Button size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Randevu Al
            </Button>
          </Link>
          <Link href="/owner/pets/add">
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Hayvan Ekle
            </Button>
          </Link>
        </div>
      </div>

      {/* Imminent Video Appointment Banner */}
      {imminentVideo && (
        <div className="bg-blue-600 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Video Randevunuz Başlıyor!</p>
              <p className="text-white/80 text-xs mt-0.5">
                {(imminentVideo.pet as { name?: string })?.name} için görüşme zamanı 🐾
              </p>
            </div>
          </div>
          <Link href={`/video/${imminentVideo.id}?appointment=${imminentVideo.id}`} className="shrink-0">
            <Button className="bg-white text-blue-600 hover:bg-blue-50 font-bold text-xs h-9 px-4">
              📹 Görüşmeye Katıl
            </Button>
          </Link>
        </div>
      )}

      {/* Overdue Alerts */}
      {overdueVaccines && overdueVaccines.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">
                {overdueVaccines.length} aşı tarihi geçmiş!
              </p>
              <div className="mt-1 space-y-1">
                {overdueVaccines.slice(0, 3).map((v: Vaccine & { pet: { name: string } }) => (
                  <p key={v.id} className="text-sm text-red-700">
                    • {v.pet?.name} — {v.name} ({formatDate(v.next_due_date || "")})
                  </p>
                ))}
              </div>
              <Link href="/owner/appointments/book">
                <Button size="sm" className="mt-2 bg-red-600 hover:bg-red-700 text-white text-xs h-7">
                  Hemen Randevu Al
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Health Alert — pets needing attention */}
      {pets && pets.filter((p: Pet) => {
        const birthMs = p.birth_date ? Date.now() - new Date(p.birth_date as string).getTime() : 0;
        const ageMonths = birthMs / (1000 * 60 * 60 * 24 * 30);
        const hasOverdue = (overdueByPet[p.id] || 0) > 0;
        const hasNoVisit = ageMonths > 6 && !recentVisitPetIds.has(p.id);
        return hasOverdue || hasNoVisit;
      }).slice(0, 2).map((p: Pet) => (
        <div key={p.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">{p.photo_url ? "🐾" : getSpeciesEmoji(p.species)}</span>
            <p className="text-sm font-medium text-amber-800 truncate">
              <strong>{p.name}</strong> sağlık skoru: 🔴 Aksiyon Gerekli
            </p>
          </div>
          <Link href="/owner/appointments/book">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 h-7 text-xs">
              Randevu Al
            </Button>
          </Link>
        </div>
      ))}

      {/* 3 Large Quick Access Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/owner/pets">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col items-center gap-2.5 hover:shadow-md hover:border-[#166534]/40 transition-all cursor-pointer min-h-[120px] justify-center">
            <span className="text-4xl">🐾</span>
            <div className="text-center">
              <p className="font-bold text-gray-900 text-sm">Hayvanlarım</p>
              <p className="text-xs text-gray-500 mt-0.5">{pets?.length || 0} hayvan</p>
            </div>
          </div>
        </Link>
        <Link href="/owner/appointments">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col items-center gap-2.5 hover:shadow-md hover:border-blue-400/40 transition-all cursor-pointer min-h-[120px] justify-center">
            <span className="text-4xl">📅</span>
            <div className="text-center">
              <p className="font-bold text-gray-900 text-sm">Randevularım</p>
              <p className="text-xs text-gray-500 mt-0.5">{appointments?.length || 0} yaklaşan</p>
            </div>
          </div>
        </Link>
        <Link href="/nobetci-veteriner">
          <div className="bg-red-50 rounded-2xl border border-red-200 p-4 flex flex-col items-center gap-2.5 hover:shadow-md hover:border-red-400 transition-all cursor-pointer min-h-[120px] justify-center">
            <span className="text-4xl">🚨</span>
            <div className="text-center">
              <p className="font-bold text-red-800 text-sm">Acil Veteriner</p>
              <p className="text-xs text-red-600 mt-0.5">Nöbetçi bul</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Yaklaşan Randevular</CardTitle>
              <Link href="/owner/appointments" className="text-sm text-[#166534] hover:underline flex items-center gap-1">
                Tümü <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {appointments && appointments.length > 0 ? (
              <div className="space-y-3">
                {appointments.map((apt: Appointment & { pet: Pet; vet: { user: { full_name: string }; specialty: string; city: string } }) => (
                  <Link key={apt.id} href={`/owner/appointments/${apt.id}`}>
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-[#DCFCE7] rounded-lg flex items-center justify-center text-xl shrink-0">
                        {getSpeciesEmoji(apt.pet?.species || "")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {apt.pet?.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Vet. Hek. {apt.vet?.user?.full_name}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {formatDateTime(apt.datetime)}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <CountdownTimer datetime={apt.datetime} />
                        <Badge
                          variant={apt.type === "video" ? "default" : "secondary"}
                          className="mt-1 text-[10px]"
                        >
                          {apt.type === "video" ? "Video" : "Yüz Yüze"}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Yaklaşan randevunuz yok</p>
                <Link href="/owner/appointments/book">
                  <Button size="sm" className="mt-3">Randevu Al</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Pets */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Hayvanlarım</CardTitle>
              <Link href="/owner/pets" className="text-sm text-[#166534] hover:underline flex items-center gap-1">
                Tümü <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {pets && pets.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {pets.slice(0, 4).map((pet: Pet) => (
                  <Link key={pet.id} href={`/owner/pets/${pet.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl overflow-hidden">
                        {pet.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          getSpeciesEmoji(pet.species)
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{pet.name}</p>
                        <p className="text-xs text-gray-500">{pet.species}</p>
                      </div>
                    </div>
                  </Link>
                ))}
                <Link href="/owner/pets/add">
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-200 hover:border-[#166534] transition-colors cursor-pointer">
                    <Plus className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Ekle</span>
                  </div>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <PawPrint className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Henüz hayvan eklemediniz</p>
                <Link href="/owner/pets/add">
                  <Button size="sm" className="mt-3">Hayvan Ekle</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
