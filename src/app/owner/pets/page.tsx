import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSpeciesEmoji, getAgeFromBirthDate, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Pet, Vaccine } from "@/types";

export default async function PetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: pets } = await supabase
    .from("pets")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  // Get overdue vaccines for each pet
  const petIds = (pets || []).map((p: Pet) => p.id);
  const { data: overdueVaccines } = petIds.length
    ? await supabase
        .from("vaccines")
        .select("pet_id, name, next_due_date")
        .in("pet_id", petIds)
        .lte("next_due_date", new Date().toISOString().split("T")[0])
        .not("next_due_date", "is", null)
    : { data: [] };

  const overdueByPet = (overdueVaccines || []).reduce((acc: Record<string, number>, v: { pet_id: string }) => {
    acc[v.pet_id] = (acc[v.pet_id] || 0) + 1;
    return acc;
  }, {});

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: upcomingVaccines }, { data: recentVisits }] = await Promise.all([
    petIds.length ? supabase
      .from("vaccines")
      .select("pet_id")
      .in("pet_id", petIds)
      .gt("next_due_date", today)
      .lte("next_due_date", thirtyDaysFromNow)
      .not("next_due_date", "is", null) : Promise.resolve({ data: [] }),
    petIds.length ? supabase
      .from("appointments")
      .select("pet_id")
      .in("pet_id", petIds)
      .eq("status", "completed")
      .gte("datetime", sixMonthsAgo) : Promise.resolve({ data: [] }),
  ]);

  const upcomingByPet = (upcomingVaccines || []).reduce((acc: Record<string, number>, v: { pet_id: string }) => {
    acc[v.pet_id] = (acc[v.pet_id] || 0) + 1; return acc;
  }, {});
  const recentVisitPetIds = new Set((recentVisits || []).map((r: { pet_id: string }) => r.pet_id));

  function getHealthScore(pet: Pet): { icon: string; label: string; bg: string; text: string; border: string } {
    const birthMs = pet.birth_date ? Date.now() - new Date(pet.birth_date).getTime() : 0;
    const ageMonths = birthMs / (1000 * 60 * 60 * 24 * 30);
    const hasOverdue = (overdueByPet[pet.id] || 0) > 0;
    const hasNoVisit = ageMonths > 6 && !recentVisitPetIds.has(pet.id);
    const hasUpcoming = (upcomingByPet[pet.id] || 0) > 0;
    if (hasOverdue || hasNoVisit) return { icon: "🔴", label: "Aksiyon Gerekli", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
    if (hasUpcoming) return { icon: "🟡", label: "Dikkat", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" };
    return { icon: "🟢", label: "Sağlıklı", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hayvanlarım</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pets?.length || 0} kayıtlı hayvan
          </p>
        </div>
        <Link href="/owner/pets/add">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Hayvan Ekle
          </Button>
        </Link>
      </div>

      {pets && pets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pets.map((pet: Pet) => {
            const score = getHealthScore(pet);
            return (
              <Link key={pet.id} href={`/owner/pets/${pet.id}`}>
                <Card className={`hover:shadow-md transition-shadow cursor-pointer border ${score.border}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-3xl overflow-hidden shrink-0">
                        {pet.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          getSpeciesEmoji(pet.species)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                            <p className="text-sm text-gray-500">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${score.bg} ${score.text} border ${score.border}`}>
                            {score.icon} {score.label}
                          </div>
                        </div>
                        <div className="mt-2 space-y-1">
                          {pet.birth_date && (
                            <p className="text-xs text-gray-500">
                              Yaş: {getAgeFromBirthDate(pet.birth_date)}
                            </p>
                          )}
                          {pet.weight && (
                            <p className="text-xs text-gray-500">
                              Ağırlık: {pet.weight} kg
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {/* Add Pet Card */}
          <Link href="/owner/pets/add">
            <div className="flex flex-col items-center justify-center h-full min-h-[140px] rounded-xl border-2 border-dashed border-gray-300 hover:border-[#166534] transition-colors cursor-pointer p-6 text-center">
              <div className="w-12 h-12 bg-[#F0FDF4] rounded-full flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-[#166534]" />
              </div>
              <p className="text-sm font-medium text-gray-600">Yeni Hayvan Ekle</p>
            </div>
          </Link>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🐾</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Henüz hayvan eklemediniz
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            Evcil hayvanınızı ekleyin ve sağlık takibine başlayın
          </p>
          <Link href="/owner/pets/add">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              İlk Hayvanı Ekle
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
