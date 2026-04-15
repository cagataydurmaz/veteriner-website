import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import dynamic from "next/dynamic";

const AnalyticsClient = dynamic(
  () => import("@/components/vet/AnalyticsClient"),
  {
    loading: () => (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    ),
  }
);

export default async function VetAnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/vet-login");

  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id, average_rating, total_reviews")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vet) redirect("/vet/profile");

  return (
    <AnalyticsClient
      vetId={vet.id}
      avgRating={vet.average_rating ?? null}
      totalReviews={vet.total_reviews ?? 0}
    />
  );
}
