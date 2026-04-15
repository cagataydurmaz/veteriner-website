import { createServiceClient } from "@/lib/supabase/server";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import VetManagementTable, { type Vet as VetType } from "@/components/admin/VetManagementTable";

export default async function AdminVetsPage() {
  const supabase = createServiceClient();

  const { data: vets, error: vetsError } = await supabase
    .from("veterinarians")
    .select(`
      id, specialty, bio, city, district,
      chamber_number, sicil_no,
      license_number, license_document_url, rejection_reason,
      is_verified, average_rating, total_reviews,
      consultation_fee, video_consultation_fee,
      offers_in_person, offers_video,
      subscription_tier, account_status,
      suspended_until, suspension_reason,
      admin_note, created_at,
      user:users(full_name, email, phone, city, created_at)
    `)
    .order("created_at", { ascending: false });

  if (vetsError) {
    console.error("[admin/vets] query error:", JSON.stringify(vetsError));
  }

  const pendingCount = (vets || []).filter((v) => !v.is_verified && v.account_status !== "deleted").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Veteriner Yönetimi</h1>
        <p className="text-sm text-gray-500 mt-1">
          {vets?.length || 0} kayıtlı veteriner
        </p>
      </div>

      <VetManagementTable initialVets={(vets || []) as unknown as VetType[]} pendingCount={pendingCount} />
    </div>
  );
}
