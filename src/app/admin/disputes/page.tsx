import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Search, CheckCircle, XCircle } from "lucide-react";
import ComplaintsClient from "./client";

export type ComplaintRow = {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  resolution: string | null;
  admin_note: string | null;
  reporter_type: string;
  created_at: string;
  resolved_at: string | null;
  appointment: {
    id: string;
    datetime: string;
    type: string;
    payment_amount: number | null;
    payment_status: string | null;
    owner: { full_name: string; phone: string | null } | null;
    vet: {
      user: { full_name: string; phone: string | null } | null;
    } | null;
  } | null;
};

export default async function AdminComplaintsPage() {
  const supabase = createServiceClient();

  const { data: complaints } = await supabase
    .from("complaints")
    .select(`
      id, reason, description, status, resolution, admin_note, reporter_type, created_at, resolved_at,
      appointment:appointments!complaints_appointment_id_fkey(
        id, datetime, type, payment_amount, payment_status,
        owner:users!appointments_owner_id_fkey(full_name, phone),
        vet:veterinarians!appointments_vet_id_fkey(
          user:users!veterinarians_user_id_fkey(full_name, phone)
        )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(300);

  const all = (complaints || []) as unknown as ComplaintRow[];

  const open = all.filter(c => c.status === "open").length;
  const reviewing = all.filter(c => c.status === "under_review").length;
  const resolved = all.filter(c => c.status === "resolved").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Şikayetler</h1>
        <p className="text-sm text-gray-500 mt-1">Randevu şikayetlerini incele ve karara bağla</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Açık", value: open, icon: Clock, color: "bg-yellow-100 text-yellow-600" },
          { label: "İnceleniyor", value: reviewing, icon: Search, color: "bg-blue-100 text-blue-600" },
          { label: "Çözüldü", value: resolved, icon: CheckCircle, color: "bg-[#F0FDF4] text-[#166534]" },
          { label: "Toplam", value: all.length, icon: XCircle, color: "bg-gray-100 text-gray-600" },
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

      <ComplaintsClient complaints={all} />
    </div>
  );
}
