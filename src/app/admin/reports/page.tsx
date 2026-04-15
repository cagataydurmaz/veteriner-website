import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flag, AlertTriangle, Shield, Clock } from "lucide-react";
import AdminReportsClient, { type Report, type FraudFlag } from "./client";

export default async function AdminReportsPage() {
  const supabase = createServiceClient();

  const [{ data: reports }, { data: flags }, { data: blocked }] = await Promise.all([
    supabase
      .from("violation_reports")
      .select(`
        id, reason, details, status, created_at,
        reporter:users!violation_reports_reporter_id_fkey(full_name),
        vet:veterinarians!violation_reports_vet_id_fkey(
          id, specialty, user:users!veterinarians_user_id_fkey(full_name)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("fraud_flags")
      .select(`
        id, flag_type, details, is_resolved, created_at,
        vet:veterinarians!fraud_flags_vet_id_fkey(
          id, specialty, user:users!veterinarians_user_id_fkey(full_name)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("blocked_messages")
      .select("id, block_reason, created_at, sender:users!blocked_messages_sender_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const pendingReports = (reports || []).filter(r => r.status === "pending").length;
  const unresolvedFlags = (flags || []).filter(f => !f.is_resolved).length;
  const blockedCount = (blocked || []).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">İhlal Raporları & Güvenlik</h1>
        <p className="text-sm text-gray-500 mt-1">Platform ihlalleri, şüpheli davranışlar ve engellenen mesajlar</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Flag className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingReports}</p>
                <p className="text-xs text-gray-500">Bekleyen Rapor</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{unresolvedFlags}</p>
                <p className="text-xs text-gray-500">Çözülmemiş Şüpheli Davranış</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{blockedCount}</p>
                <p className="text-xs text-gray-500">Engellenen Mesaj (son 20)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AdminReportsClient
        reports={(reports || []) as unknown as Report[]}
        flags={(flags || []) as unknown as FraudFlag[]}
        blockedMessages={blocked || []}
      />
    </div>
  );
}
