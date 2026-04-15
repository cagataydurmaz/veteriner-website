import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Star, CheckCircle, Flag, Clock } from "lucide-react";
import ReviewsClient from "./client";

export type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  is_flagged: boolean;
  created_at: string;
  owner: { full_name: string } | null;
  vet: { specialty: string; user: { full_name: string } | null } | null;
};

export default async function AdminReviewsPage() {
  const supabase = createServiceClient();

  const { data: reviews } = await supabase
    .from("reviews")
    .select(`
      id, rating, comment, is_approved, is_flagged, created_at,
      owner:users!reviews_owner_id_fkey(full_name),
      vet:veterinarians!reviews_vet_id_fkey(
        specialty,
        user:users!veterinarians_user_id_fkey(full_name)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  const all = (reviews || []) as unknown as ReviewRow[];

  const total = all.length;
  const pending = all.filter(r => !r.is_approved && !r.is_flagged).length;
  const approved = all.filter(r => r.is_approved).length;
  const flagged = all.filter(r => r.is_flagged).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Yorum Yönetimi</h1>
        <p className="text-sm text-gray-500 mt-1">Veteriner değerlendirmelerini denetle ve yönet</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Toplam Yorum", value: total, icon: Star, color: "bg-blue-100 text-blue-600" },
          { label: "Onay Bekleyen", value: pending, icon: Clock, color: "bg-yellow-100 text-yellow-600" },
          { label: "Onaylı", value: approved, icon: CheckCircle, color: "bg-[#F0FDF4] text-[#166534]" },
          { label: "Bayraklı", value: flagged, icon: Flag, color: "bg-red-100 text-red-600" },
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

      <ReviewsClient reviews={all} />
    </div>
  );
}
