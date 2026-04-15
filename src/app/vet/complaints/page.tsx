import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Clock, Search, Info } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Şikayetlerim" };

const STATUS_MAP: Record<string, { label: string; variant: "warning" | "default" | "success" | "secondary" | "outline" }> = {
  open:         { label: "Açık",        variant: "warning" },
  under_review: { label: "İnceleniyor", variant: "default" },
  resolved:     { label: "Çözüldü",     variant: "success" },
  rejected:     { label: "Reddedildi",  variant: "secondary" },
};

const REASON_MAP: Record<string, string> = {
  no_show:           "Randevuya gelmedi",
  rude_behavior:     "Kaba davranış",
  wrong_diagnosis:   "Yanlış teşhis",
  overcharge:        "Fazla ücret",
  late:              "Geç kalma",
  other:             "Diğer",
};

export default async function VetComplaintsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/vet-login");

  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vet) redirect("/vet/profile");

  // Get appointment IDs for this vet, then fetch complaints linked to them
  const { data: vetApts } = await supabase
    .from("appointments")
    .select("id")
    .eq("vet_id", vet.id);

  const aptIds = (vetApts || []).map((a: { id: string }) => a.id);

  const { data: complaints } = aptIds.length
    ? await supabase
        .from("complaints")
        .select(`
          id, reason, description, status, resolution, reporter_type, created_at, resolved_at,
          appointment:appointments!complaints_appointment_id_fkey(
            id, datetime, type,
            owner:users!appointments_owner_id_fkey(full_name)
          )
        `)
        .in("appointment_id", aptIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const all = complaints || [];
  const open = all.filter((c) => c.status === "open").length;
  const reviewing = all.filter((c) => c.status === "under_review").length;
  const resolved = all.filter((c) => c.status === "resolved").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Şikayetlerim</h1>
        <p className="text-sm text-gray-500 mt-1">
          Hakkınızda yapılan şikayetler. Yalnızca görüntüleme amaçlıdır.
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Şikayetler yönetici ekibimiz tarafından incelenir. Hakkınızda itirazınız varsa <strong>destek@veterineribul.com</strong> adresine yazabilirsiniz.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Açık", value: open, icon: Clock, color: "bg-yellow-100 text-yellow-600" },
          { label: "İnceleniyor", value: reviewing, icon: Search, color: "bg-blue-100 text-blue-600" },
          { label: "Çözüldü", value: resolved, icon: CheckCircle, color: "bg-green-100 text-green-600" },
          { label: "Toplam", value: all.length, icon: AlertTriangle, color: "bg-gray-100 text-gray-600" },
        ].map((stat) => {
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

      {/* List */}
      {all.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Şikayet bulunmuyor</p>
            <p className="text-sm text-gray-400 mt-1">Harika! Hakkınızda açık şikayet yok.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {all.map((c: any) => {
            const cfg = STATUS_MAP[c.status] ?? { label: c.status, variant: "outline" as const };
            return (
              <Card key={c.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">
                          {REASON_MAP[c.reason] ?? c.reason}
                        </p>
                        <Badge variant={cfg.variant} className="text-xs">
                          {cfg.label}
                        </Badge>
                      </div>
                      {c.appointment && (
                        <p className="text-xs text-gray-500">
                          Randevu:{" "}
                          {new Date(c.appointment.datetime).toLocaleDateString("tr-TR", {
                            day: "numeric", month: "long", year: "numeric",
                          })}{" "}
                          — {c.appointment.owner?.full_name}
                        </p>
                      )}
                      {c.description && (
                        <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded-lg px-3 py-2">
                          {c.description}
                        </p>
                      )}
                      {c.resolution && (
                        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mt-1">
                          <strong>Karar:</strong> {c.resolution}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 shrink-0">
                      {formatDate(c.created_at)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
