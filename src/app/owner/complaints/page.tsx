import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle, CheckCircle, Clock, MessageSquare,
  Calendar, Video, MapPin, ChevronRight,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Şikayetlerim" };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open:       { label: "İnceleme Bekliyor", color: "bg-amber-100 text-amber-700" },
  reviewing:  { label: "İnceleniyor",       color: "bg-blue-100 text-blue-700" },
  resolved:   { label: "Sonuçlandı",        color: "bg-gray-100 text-gray-600" },
};

const RESOLUTION_LABELS: Record<string, { label: string; color: string }> = {
  owner_wins: { label: "Lehinize Sonuçlandı",    color: "bg-green-100 text-green-700" },
  vet_wins:   { label: "Veteriner Lehine",        color: "bg-orange-100 text-orange-700" },
  split:      { label: "Kısmi İade Yapıldı",      color: "bg-purple-100 text-purple-700" },
  dismissed:  { label: "Reddedildi",              color: "bg-red-100 text-red-600" },
};

export default async function OwnerComplaintsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: complaints } = await supabase
    .from("complaints")
    .select(`
      id, reason, description, status, resolution, admin_note, created_at, resolved_at,
      appointment:appointments(
        id, datetime, type, status,
        vet:veterinarians(user:users(full_name))
      )
    `)
    .eq("reporter_id", user.id)
    .eq("reporter_type", "owner")
    .order("created_at", { ascending: false });

  const counts = {
    open:      (complaints || []).filter(c => c.status === "open").length,
    reviewing: (complaints || []).filter(c => c.status === "under_review").length,
    resolved:  (complaints || []).filter(c => c.status === "resolved").length,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Şikayetlerim</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Açık şikayetler 48 saat içinde incelenir. Sonuç e-posta ile bildirilir.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Bekliyor",    count: counts.open,      color: "text-amber-600 bg-amber-50",  icon: Clock },
          { label: "İnceleniyor", count: counts.reviewing, color: "text-blue-600 bg-blue-50",    icon: MessageSquare },
          { label: "Sonuçlandı",  count: counts.resolved,  color: "text-gray-600 bg-gray-50",    icon: CheckCircle },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xl font-bold text-gray-900">{s.count}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* How it works — info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">Platform Güvencesi Nasıl Çalışır?</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Tamamlanan randevudan sonra 48 saat içinde şikayet açabilirsiniz.</li>
          <li>Ekibimiz 48 saat içinde inceleyerek sonucu e-posta ile bildirir.</li>
          <li>Video görüşmede sorun yaşandıysa iade kararı verilebilir.</li>
          <li>Karara itiraz etmek için destek@veterineribul.com adresine yazabilirsiniz.</li>
        </ul>
      </div>

      {/* Complaint list */}
      {!complaints || complaints.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">Henüz şikayet oluşturmadınız</p>
          <p className="text-xs text-gray-400 mt-1">
            Sorun yaşadığınız randevunun detay sayfasından şikayet açabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map(c => {
            const apt = Array.isArray(c.appointment) ? c.appointment[0] : c.appointment;
            const vet = apt?.vet ? (Array.isArray(apt.vet) ? apt.vet[0] : apt.vet) : null;
            const vetUser = vet?.user ? (Array.isArray(vet.user) ? vet.user[0] : vet.user) : null;
            const statusMeta = STATUS_LABELS[c.status] ?? STATUS_LABELS.open;
            const resMeta = c.resolution ? RESOLUTION_LABELS[c.resolution] : null;

            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm font-semibold text-gray-900">{c.reason}</span>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${statusMeta.color}`}>
                    {statusMeta.label}
                  </span>
                </div>

                {/* Description */}
                {c.description && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                    {c.description}
                  </p>
                )}

                {/* Appointment info */}
                {apt && (
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {new Date(apt.datetime as string).toLocaleDateString("tr-TR", {
                        day: "numeric", month: "long", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {apt.type === "video"
                      ? <><Video className="w-3.5 h-3.5" /><span>Video</span></>
                      : <><MapPin className="w-3.5 h-3.5" /><span>Yüz Yüze</span></>
                    }
                    {vetUser?.full_name && (
                      <span className="ml-auto font-medium text-gray-700">{vetUser.full_name}</span>
                    )}
                  </div>
                )}

                {/* Resolution */}
                {c.status === "resolved" && (
                  <div className="space-y-1.5 pt-1 border-t border-gray-100">
                    {resMeta && (
                      <span className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full ${resMeta.color}`}>
                        {resMeta.label}
                      </span>
                    )}
                    {c.admin_note && (
                      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-medium text-gray-700">Yönetici Notu: </span>
                        {c.admin_note}
                      </p>
                    )}
                    {c.resolved_at && (
                      <p className="text-[10px] text-gray-400">
                        Sonuçlandı: {new Date(c.resolved_at as string).toLocaleDateString("tr-TR")}
                      </p>
                    )}
                  </div>
                )}

                {/* Appointment detail link */}
                {apt && (
                  <Link
                    href={`/owner/appointments/${apt.id}`}
                    className="flex items-center gap-1 text-xs text-[#166534] hover:underline"
                  >
                    Randevu Detayı <ChevronRight className="w-3 h-3" />
                  </Link>
                )}

                {/* Filed date */}
                <p className="text-[10px] text-gray-400">
                  Şikayet tarihi: {new Date(c.created_at as string).toLocaleDateString("tr-TR")}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Help */}
      <div className="text-center text-xs text-gray-400 pb-4">
        Şikayet sonucuna itiraz etmek için{" "}
        <a href="mailto:destek@veterineribul.com" className="text-[#166534] hover:underline">
          destek@veterineribul.com
        </a>{" "}
        adresine yazabilirsiniz.
      </div>
    </div>
  );
}
