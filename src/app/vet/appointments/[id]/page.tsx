import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, getSpeciesEmoji } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Video, MapPin, User, PawPrint, Phone, AlertCircle, FileText, MessageCircle } from "lucide-react";
import RateOwnerButton from "@/components/vet/RateOwnerButton";
import VetCompleteButton from "@/components/vet/VetCompleteButton";
import DiagnosisNotes from "@/components/vet/DiagnosisNotes";
import ReportModal from "@/components/vet/ReportModal";

export default async function VetAppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/vet-login");

  const { data: vet } = await supabase
    .from("veterinarians").select("id").eq("user_id", user.id).maybeSingle();
  if (!vet) redirect("/vet/profile");

  const { data: apt } = await supabase
    .from("appointments")
    .select(`
      *,
      pet:pets(name, species, breed, birth_date, weight, allergies, chronic_conditions, photo_url),
      owner:users(id, full_name, phone, email)
    `)
    .eq("id", id)
    .eq("vet_id", vet.id)
    .maybeSingle();

  if (!apt) notFound();

  // Past visits for this pet
  const { data: pastVisits } = await supabase
    .from("appointments")
    .select(`
      id, datetime, complaint,
      medical_records(vet_notes, medications)
    `)
    .eq("pet_id", apt.pet_id)
    .eq("status", "completed")
    .neq("id", id)
    .order("datetime", { ascending: false })
    .limit(5);

  const dt = new Date(apt.datetime);
  const isPast = dt < new Date();
  const isToday = dt.toDateString() === new Date().toDateString();

  const petAge = apt.pet?.birth_date
    ? Math.floor((Date.now() - new Date(apt.pet.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;
  const isVideo = apt.type === "video";
  const canJoin = isVideo && apt.status === "confirmed" && isToday;

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: "Onay Bekliyor", color: "bg-yellow-100 text-yellow-700" },
    confirmed: { label: "Onaylandı", color: "bg-green-100 text-green-700" },
    completed: { label: "Tamamlandı", color: "bg-gray-100 text-gray-700" },
    cancelled: { label: "İptal Edildi", color: "bg-red-100 text-red-700" },
  };
  const statusInfo = statusMap[apt.status] || statusMap.pending;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href="/vet/appointments" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Randevular
      </Link>

      {/* Join video banner — links to split-screen consultation view */}
      {canJoin && (
        <div className="bg-blue-600 rounded-2xl p-5 text-center">
          <Video className="w-8 h-8 text-white mx-auto mb-2" />
          <p className="text-white font-bold text-lg mb-3">Video Görüşme Zamanı</p>
          <Link href={`/vet/consultation/${apt.id}`}>
            <Button className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-8">
              <Video className="w-4 h-4 mr-2" /> Konsültasyonu Başlat
            </Button>
          </Link>
        </div>
      )}

      {/* Platform Guarantee — video appointments only */}
      {isVideo && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">💛</span>
          <div>
            <p className="text-sm font-bold text-yellow-900">Veterineri Bul Güvencesi</p>
            <p className="text-sm text-yellow-800 mt-1 leading-relaxed">
              Bu görüşme platform güvencesi kapsamındadır. Pet sahibi sorun yaşarsa iade garantimiz devrededir.
              <br />
              <span className="text-xs text-yellow-700 font-medium mt-1 block">
                Yalnızca platform üzerinden yapılan görüşmeler için geçerlidir.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Status */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">{formatDateTime(apt.datetime)}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                {isVideo ? (
                  <Badge variant="default" className="text-xs"><Video className="w-3 h-3 mr-1" />Video</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs"><MapPin className="w-3 h-3 mr-1" />Yüz Yüze</Badge>
                )}
              </div>
            </div>
            {apt.status === "confirmed" && isPast && (
              <VetCompleteButton appointmentId={apt.id} />
            )}
          </div>
          {apt.complaint && (
            <p className="text-sm text-gray-500 mt-2">Şikayet: <span className="font-medium text-gray-700">{apt.complaint}</span></p>
          )}
        </CardContent>
      </Card>

      {/* Patient Summary */}
      {(apt.pet?.allergies || apt.pet?.chronic_conditions || (pastVisits && pastVisits.length > 0)) && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" /> Hasta Özeti
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {apt.pet?.allergies && (
              <div className="flex items-start gap-2 bg-red-50 rounded-lg p-2.5 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-800 uppercase tracking-wide">⚠️ ALERJİ — DİKKAT</p>
                  <p className="text-sm text-red-700 mt-0.5">{apt.pet.allergies}</p>
                </div>
              </div>
            )}
            {apt.pet?.chronic_conditions && (
              <div className="flex items-start gap-2 bg-purple-50 rounded-lg p-2.5 border border-purple-200">
                <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <p className="text-xs text-purple-700"><strong>Kronik:</strong> {apt.pet.chronic_conditions}</p>
              </div>
            )}
            {pastVisits && pastVisits.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Geçmiş Ziyaretler</p>
                <div className="space-y-2">
                  {(pastVisits as { id: string; datetime: string; complaint?: string; medical_records?: { vet_notes?: string; medications?: unknown[] }[] }[]).map(v => {
                    const note = Array.isArray(v.medical_records) ? v.medical_records[0]?.vet_notes : undefined;
                    return (
                      <div key={v.id} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-gray-100">
                        <div className="w-1.5 h-1.5 bg-[#166534] rounded-full mt-2 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-gray-800">
                            {new Date(v.datetime).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                          {v.complaint && <p className="text-xs text-gray-500">Şikayet: {v.complaint}</p>}
                          {note && <p className="text-xs text-gray-600 mt-0.5 italic">{note.slice(0, 80)}{note.length > 80 ? "…" : ""}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pet */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-[#166534]" /> Hasta
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-[#F0FDF4] rounded-xl flex items-center justify-center text-2xl">
              {getSpeciesEmoji(apt.pet?.species || "")}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{apt.pet?.name}</p>
              <p className="text-sm text-gray-500">
                {apt.pet?.species}
                {apt.pet?.breed && ` · ${apt.pet.breed}`}
                {petAge !== null && ` · ${petAge} yaş`}
                {apt.pet?.weight && ` · ${apt.pet.weight} kg`}
              </p>
            </div>
          </div>
          {apt.pet?.allergies && (
            <div className="flex items-start gap-2 bg-orange-50 rounded-lg p-2.5 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700"><strong>Alerji:</strong> {apt.pet.allergies}</p>
            </div>
          )}
          {apt.pet?.chronic_conditions && (
            <div className="flex items-start gap-2 bg-red-50 rounded-lg p-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700"><strong>Kronik:</strong> {apt.pet.chronic_conditions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Owner */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-[#166534]" /> Pet Sahibi
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <p className="font-semibold text-gray-900">{apt.owner?.full_name}</p>
          {apt.owner?.phone && (
            <a href={`tel:${apt.owner.phone}`} className="flex items-center gap-2 text-sm text-[#166534] hover:underline">
              <Phone className="w-4 h-4" /> {apt.owner.phone}
            </a>
          )}
        </CardContent>
      </Card>

      {apt.notes && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-gray-500 mb-1">Randevu Notu</p>
            <p className="text-sm text-gray-700">{apt.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Diagnosis notes with disease reporting reminder */}
      {(apt.status === "confirmed" || apt.status === "completed") && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#166534]" /> Tanı Notu
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DiagnosisNotes appointmentId={apt.id} />
          </CardContent>
        </Card>
      )}

      {/* ── Chat: always shown except cancelled ──────────────────────────────── */}
      {apt.status !== "cancelled" && (
        <Link href={`/vet/appointments/${apt.id}/chat`}>
          <Button className="w-full bg-[#166534] hover:bg-[#14532D] text-white">
            <MessageCircle className="w-4 h-4 mr-2" />
            Pet Sahibiyle Mesajlaş
          </Button>
        </Link>
      )}

      <div className="pb-6 flex justify-center">
        <ReportModal appointmentId={apt.id} appointmentStatus={apt.status} />
      </div>
    </div>
  );
}
