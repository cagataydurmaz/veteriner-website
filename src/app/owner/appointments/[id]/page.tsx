import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, getSpeciesEmoji } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, Video, MapPin, User, PawPrint,
  Phone, ArrowLeft, Clock, AlertCircle, Star, CreditCard, CheckCircle, MessageCircle
} from "lucide-react";
import CancelAppointmentButton from "@/components/owner/CancelAppointmentButton";
import RateVetButton from "@/components/owner/RateVetButton";
import ReportVetButton from "@/components/owner/ReportVetButton";
import ComplaintModal from "@/components/owner/ComplaintModal";
import ClinicMap from "@/components/ClinicMap";
import OwnerAppointmentDetailSync from "@/components/owner/OwnerAppointmentDetailSync";
import JoinVideoButton from "@/components/shared/JoinVideoButton";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Retry loop guards against the S1 race condition: the booking page uses a hard
  // navigation (window.location.href) immediately after insert. In rare cases the
  // appointment row isn't yet visible to the SSR query (Supabase read replica lag
  // or connection pool timing). We retry up to 3 times with 700 ms gaps before
  // falling through to notFound — adds ≤1.4 s only in the race path.
  let apt = null;
  const APT_QUERY = `
    *,
    pet:pets(name, species, breed, birth_date, weight, allergies, chronic_conditions, photo_url),
    vet:veterinarians(
      id, specialty, city, district,
      consultation_fee, video_consultation_fee,
      average_rating, total_reviews,
      user:users(full_name, phone)
    )
  `;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await supabase
      .from("appointments")
      .select(APT_QUERY)
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (data) { apt = data; break; }
    if (attempt < 2) await new Promise<void>(res => setTimeout(res, 700));
  }

  if (!apt) notFound();

  const dt = new Date(apt.datetime);
  const now = new Date();
  const isToday = dt.toDateString() === now.toDateString();
  const isUpcoming = dt > now;
  const isVideo = apt.type === "video";
  const isConfirmed = apt.status === "confirmed";
  const canJoin = isVideo && isConfirmed && isToday;

  // 10 min before window
  const diffMin = (dt.getTime() - now.getTime()) / 60000;
  const inWindow = diffMin <= 10 && diffMin >= -60;

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: "Onay Bekliyor", color: "bg-yellow-100 text-yellow-700" },
    confirmed: { label: "Onaylandı", color: "bg-green-100 text-green-700" },
    completed: { label: "Tamamlandı", color: "bg-gray-100 text-gray-700" },
    cancelled: { label: "İptal Edildi", color: "bg-red-100 text-red-700" },
  };
  const statusInfo = statusMap[apt.status] || statusMap.pending;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Live updates: revalidates RSC data on any appointment UPDATE event */}
      <OwnerAppointmentDetailSync appointmentId={apt.id} />

      {/* Back */}
      <Link href="/owner/appointments" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Randevularım
      </Link>

      {/* Video Join Banner */}
      {canJoin && (
        <div className={`rounded-2xl p-5 text-center ${inWindow ? "bg-blue-600" : "bg-[#166534]"}`}>
          <Video className="w-8 h-8 text-white mx-auto mb-2" />
          <p className="text-white font-bold text-lg mb-1">
            {inWindow ? "Görüşme Zamanı!" : "Video Görüşme Randevusu"}
          </p>
          <p className="text-white/80 text-sm mb-4">
            {inWindow
              ? "Görüşmeye katılmak için hazır olun"
              : `${dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} saatinde başlayacak`}
          </p>
          <JoinVideoButton
            appointmentId={apt.id}
            label={inWindow ? "Görüşmeye Katıl" : "Odaya Gir"}
            variant="white"
            className="px-8"
          />
        </div>
      )}

      {/* Platform Guarantee — video appointments only */}
      {isVideo && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">💛</span>
          <div>
            <p className="text-sm font-bold text-yellow-900">Veterineri Bul Güvencesi</p>
            <p className="text-sm text-yellow-800 mt-1 leading-relaxed">
              Bu görüşme platform güvencesi kapsamındadır. Sorun yaşarsanız iade garantimiz vardır.
              <br />
              <span className="text-xs text-yellow-700 font-medium mt-1 block">
                Yalnızca platform üzerinden yapılan görüşmeler için geçerlidir.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Status Card */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#166534]" />
              <span className="font-semibold text-gray-900">{formatDateTime(apt.datetime)}</span>
            </div>
            <span data-testid="appointment-status" className={`text-xs px-3 py-1 rounded-full font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isVideo ? (
              <div className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                <Video className="w-4 h-4" /> Video Görüşme
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                <MapPin className="w-4 h-4" /> Yüz Yüze
              </div>
            )}
            {apt.complaint && (
              <span className="text-sm text-gray-500">· {apt.complaint}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pet Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-[#166534]" /> Hasta Bilgileri
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
                {apt.pet?.birth_date && ` · ${new Date().getFullYear() - new Date(apt.pet.birth_date).getFullYear()} yaşında`}
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

      {/* Medical Records Lock-in */}
      <div className="rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] px-4 py-3 flex items-center gap-3">
        <CheckCircle className="w-4 h-4 text-[#166534] shrink-0" />
        <p className="text-xs text-[#166534] leading-relaxed">
          <span className="font-semibold">🔒 Tüm tıbbi kayıtlar güvenle saklanmaktadır.</span>{" "}
          Platform dışında bu kayıtlara erişilemez.
        </p>
      </div>

      {/* Vet Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-[#166534]" /> Veteriner
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#DCFCE7] rounded-full flex items-center justify-center text-lg font-bold text-[#166534]">
              {apt.vet?.user?.full_name?.[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">Vet. Hek. {apt.vet?.user?.full_name}</p>
              <p className="text-sm text-gray-500">{apt.vet?.specialty}</p>
              {apt.vet?.average_rating > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs text-gray-600">{apt.vet.average_rating.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({apt.vet.total_reviews} değerlendirme)</span>
                </div>
              )}
            </div>
          </div>
          {(apt.vet?.city || apt.vet?.district) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>
                {[apt.vet.district, apt.vet.city].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
          {/* Vet phone: never shown to protect against off-platform contact */}
        </CardContent>
      </Card>

      {/* Clinic Map — only for confirmed in-person appointments */}
      {isConfirmed && !isVideo && apt.vet?.city && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#166534]" /> Klinik Konumu
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ClinicMap
              query={[apt.vet.district, apt.vet.city].filter(Boolean).join(", ")}
              label={apt.vet.district || apt.vet.city}
              zoom={16}
              height={220}
              showDirections
            />
          </CardContent>
        </Card>
      )}

      {/* Payment status for video */}
      {apt.type === "video" && apt.payment_status && apt.payment_status !== "none" && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-[#166534]" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-0.5">Ödeme Durumu</p>
                <div className="flex items-center gap-2">
                  {apt.payment_status === "held" && <span className="text-sm font-medium text-amber-600">Ödeme beklemede (seans sonrası serbest bırakılacak)</span>}
                  {apt.payment_status === "completed" && <><CheckCircle className="w-4 h-4 text-green-500" /><span className="text-sm font-medium text-green-600">Ödeme tamamlandı</span></>}
                  {apt.payment_status === "refunded_full" && <span className="text-sm font-medium text-blue-600">Tam iade yapıldı</span>}
                  {apt.payment_status === "refunded_partial" && <span className="text-sm font-medium text-orange-600">%50 iade yapıldı</span>}
                </div>
                {apt.payment_amount && (
                  <p className="text-xs text-gray-400 mt-0.5">₺{apt.payment_amount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {apt.notes && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-gray-500 mb-1">Notlar</p>
            <p className="text-sm text-gray-700">{apt.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Rating — completed appointments */}
      {apt.status === "completed" && apt.vet?.id && (
        <RateVetButton
          appointmentId={apt.id}
          vetId={apt.vet.id}
        />
      )}

      {/* Actions */}
      <div className="space-y-2 pb-6">
        {apt.status !== "cancelled" && (
          <Link href={`/owner/appointments/${apt.id}/chat`}>
            <Button className="w-full bg-[#166534] hover:bg-[#14532D] text-white">
              <MessageCircle className="w-4 h-4 mr-2" />
              Veterinerle Mesajlaş
            </Button>
          </Link>
        )}
        {isUpcoming && apt.status !== "cancelled" && (
          <CancelAppointmentButton
            appointmentId={apt.id}
            appointmentType={apt.type}
            paymentStatus={apt.payment_status || "none"}
            datetime={apt.datetime}
          />
        )}
        <Link href={`/veteriner/${apt.vet?.id}`}>
          <Button variant="outline" className="w-full">
            Veteriner Profilini Gör
          </Button>
        </Link>
        {apt.vet?.id && (
          <div className="pt-2 flex justify-center">
            <ReportVetButton vetId={apt.vet.id} appointmentId={apt.id} />
          </div>
        )}
        <div className="flex justify-center">
          <ComplaintModal
            appointmentId={apt.id}
            appointmentStatus={apt.status}
          />
        </div>
      </div>
    </div>
  );
}
