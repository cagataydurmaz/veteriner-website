import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getAgeFromBirthDate, getSpeciesEmoji } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  AlertTriangle,
  Syringe,
  FileText,
  Weight,
  Camera,
  Edit,
  Plus,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Printer,
} from "lucide-react";
import WeightChart from "@/components/owner/WeightChart";
import PetDeleteButton from "@/components/owner/PetDeleteButton";
import type { Vaccine, MedicalRecord, WeightLog, PetPhoto } from "@/types";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function PetDetailPage({ params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: pet } = await supabase
    .from("pets")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!pet) notFound();

  const [{ data: vaccines }, { data: medicalRecords }, { data: weightLogs }, { data: photos }] =
    await Promise.all([
      supabase
        .from("vaccines")
        .select("*, vet:veterinarians(user:users(full_name))")
        .eq("pet_id", id)
        .order("given_date", { ascending: false }),
      supabase
        .from("medical_records")
        .select("*, appointment:appointments!appointment_id(id, datetime, type, pet_id, vet:veterinarians(user:users(full_name)))")
        .eq("appointment.pet_id", id)
        .not("appointment", "is", null)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("weight_logs")
        .select("*")
        .eq("pet_id", id)
        .order("recorded_at", { ascending: true }),
      supabase
        .from("pet_photos")
        .select("*")
        .eq("pet_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const overdueVaccines = (vaccines || []).filter(
    (v: Vaccine) => v.next_due_date && new Date(v.next_due_date) < new Date()
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/owner/pets">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        </Link>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl overflow-hidden shrink-0">
            {pet.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
            ) : (
              getSpeciesEmoji(pet.species)
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{pet.name}</h1>
            <p className="text-gray-500">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/owner/pets/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Düzenle
              </Button>
            </Link>
            <PetDeleteButton petId={id} petName={pet.name} />
          </div>
        </div>
      </div>

      {/* Medical Records Lock-in Notice */}
      <div className="rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] p-3 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-[#166534] shrink-0" />
        <p className="text-xs text-[#166534] leading-relaxed">
          <span className="font-semibold">🔒 Tüm tıbbi kayıtlar güvenle saklanmaktadır.</span>{" "}
          Aşı geçmişi, muayene notları ve sağlık kayıtları yalnızca platform üzerinden erişilebilir.
        </p>
      </div>

      {/* Overdue Alert */}
      {overdueVaccines.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-orange-800">
              {overdueVaccines.length} aşı tarihi geçmiş!
            </p>
            <p className="text-sm text-orange-700 mt-1">
              {overdueVaccines.map((v: Vaccine) => v.name).join(", ")}
            </p>
            <Link href="/owner/appointments/book">
              <Button size="sm" className="mt-2 bg-orange-600 hover:bg-orange-700 text-xs h-7">
                Randevu Al
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Yaş", value: getAgeFromBirthDate(pet.birth_date) },
          { label: "Ağırlık", value: pet.weight ? `${pet.weight} kg` : "—" },
          { label: "Aşı Sayısı", value: `${vaccines?.length || 0}` },
          { label: "Tıbbi Kayıt", value: `${medicalRecords?.length || 0}` },
        ].map((info) => (
          <Card key={info.label}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-[#166534]">{info.value}</p>
              <p className="text-xs text-gray-500 mt-1">{info.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Health Notes */}
      {(pet.allergies || pet.chronic_conditions) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="space-y-2">
              {pet.allergies && (
                <p className="text-sm text-yellow-800">
                  <span className="font-medium">⚠️ Alerjiler:</span> {pet.allergies}
                </p>
              )}
              {pet.chronic_conditions && (
                <p className="text-sm text-yellow-800">
                  <span className="font-medium">📋 Kronik Durumlar:</span> {pet.chronic_conditions}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="vaccines">
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="vaccines" className="flex items-center gap-1">
            <Syringe className="w-3.5 h-3.5" />
            Aşılar ({vaccines?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="records" className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            Kayıtlar ({medicalRecords?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="passport" className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Pasaport
          </TabsTrigger>
          <TabsTrigger value="weight" className="flex items-center gap-1">
            <Weight className="w-3.5 h-3.5" />
            Kilo
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex items-center gap-1">
            <Camera className="w-3.5 h-3.5" />
            Fotoğraflar
          </TabsTrigger>
        </TabsList>

        {/* Vaccines Tab */}
        <TabsContent value="vaccines">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Aşı Geçmişi</CardTitle>
                <Link href={`/owner/pets/${id}/add-vaccine`}>
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-1" /> Aşı Ekle
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {vaccines && vaccines.length > 0 ? (
                <div className="space-y-3">
                  {vaccines.map((vaccine: Vaccine) => {
                    const isOverdue = vaccine.next_due_date && new Date(vaccine.next_due_date) < new Date();
                    const isDueSoon = vaccine.next_due_date && !isOverdue &&
                      new Date(vaccine.next_due_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                    return (
                      <div
                        key={vaccine.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isOverdue ? "border-red-200 bg-red-50" : isDueSoon ? "border-orange-200 bg-orange-50" : "border-gray-100"
                        }`}
                      >
                        <div>
                          <p className="font-medium text-sm text-gray-900">{vaccine.name}</p>
                          <p className="text-xs text-gray-500">
                            Yapıldı: {formatDate(vaccine.given_date)}
                          </p>
                          {vaccine.notes && (
                            <p className="text-xs text-gray-400">{vaccine.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          {vaccine.next_due_date && (
                            <Badge variant={isOverdue ? "destructive" : isDueSoon ? "warning" : "secondary"}>
                              {isOverdue ? "Geçmiş" : isDueSoon ? "Yakında" : "Güncel"}
                            </Badge>
                          )}
                          {vaccine.next_due_date && (
                            <p className="text-xs text-gray-500 mt-1">
                              Sonraki: {formatDate(vaccine.next_due_date)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">Henüz aşı kaydı yok</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Passport Tab */}
        <TabsContent value="passport">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#166534]" /> Dijital Evcil Hayvan Pasaportu
                </CardTitle>
                <div className="flex gap-2">
                  <Link href={`/owner/pets/${id}/passport`}>
                    <Button size="sm" variant="outline" className="text-[#166534] border-[#166534]/30 hover:bg-[#F0FDF4]">
                      <Printer className="w-4 h-4 mr-1" /> Pasaportu İndir
                    </Button>
                  </Link>
                  <Link href={`/owner/pets/${id}/edit`}>
                    <Button size="sm" variant="outline">
                      <Edit className="w-4 h-4 mr-1" /> Düzenle
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Passport status badge */}
              {(() => {
                const expiry = pet.passport_expiry ? new Date(pet.passport_expiry) : null;
                const now = new Date();
                const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                let status: "valid" | "expiring" | "expired" | "none" = "none";
                if (expiry) {
                  if (expiry < now) status = "expired";
                  else if (expiry < thirtyDaysFromNow) status = "expiring";
                  else status = "valid";
                }

                return (
                  <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                    status === "valid" ? "bg-green-50 border-green-200" :
                    status === "expiring" ? "bg-orange-50 border-orange-200" :
                    status === "expired" ? "bg-red-50 border-red-200" :
                    "bg-gray-50 border-gray-200"
                  }`}>
                    {status === "valid" && <ShieldCheck className="w-6 h-6 text-green-600 shrink-0" />}
                    {status === "expiring" && <ShieldAlert className="w-6 h-6 text-orange-600 shrink-0" />}
                    {status === "expired" && <ShieldX className="w-6 h-6 text-red-600 shrink-0" />}
                    {status === "none" && <BookOpen className="w-6 h-6 text-gray-400 shrink-0" />}
                    <div>
                      <p className={`font-bold text-sm ${
                        status === "valid" ? "text-green-800" :
                        status === "expiring" ? "text-orange-800" :
                        status === "expired" ? "text-red-800" :
                        "text-gray-600"
                      }`}>
                        {status === "valid" ? "Pasaport Geçerli" :
                         status === "expiring" ? "Pasaport Süresi Dolmak Üzere" :
                         status === "expired" ? "Pasaport Süresi Dolmuş" :
                         "Pasaport Bilgisi Girilmemiş"}
                      </p>
                      {expiry && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Son geçerlilik: {formatDate(pet.passport_expiry)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Passport fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Mikroçip Numarası", value: pet.microchip_number, note: "15 haneli ISO 11784/11785" },
                  { label: "Pasaport Numarası", value: pet.passport_number, note: null },
                  { label: "Düzenleme Tarihi", value: pet.passport_issue_date ? formatDate(pet.passport_issue_date) : null, note: null },
                  { label: "Son Geçerlilik", value: pet.passport_expiry ? formatDate(pet.passport_expiry) : null, note: null },
                ].map((field) => (
                  <div key={field.label} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">{field.label}</p>
                    <p className={`text-sm font-medium ${field.value ? "text-gray-900 font-mono" : "text-gray-400 font-normal"}`}>
                      {field.value || "Girilmemiş"}
                    </p>
                    {field.note && <p className="text-xs text-gray-400 mt-0.5">{field.note}</p>}
                  </div>
                ))}
              </div>

              {/* Kuduz vaccine — legally required */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">
                  🔴 Kuduz Aşısı <span className="text-red-600 font-normal">(Yasal Zorunluluk)</span>
                </p>
                {pet.rabies_vaccine_date ? (
                  <div className={`p-3 rounded-xl border ${
                    pet.rabies_vaccine_expiry && new Date(pet.rabies_vaccine_expiry) < new Date()
                      ? "bg-red-50 border-red-200"
                      : "bg-green-50 border-green-200"
                  }`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Kuduz (Rabies)</p>
                        <p className="text-xs text-gray-500">Yapıldı: {formatDate(pet.rabies_vaccine_date)}</p>
                      </div>
                      {pet.rabies_vaccine_expiry && (
                        <Badge variant={new Date(pet.rabies_vaccine_expiry) < new Date() ? "destructive" : "secondary"}>
                          {new Date(pet.rabies_vaccine_expiry) < new Date() ? "Süresi Dolmuş" : formatDate(pet.rabies_vaccine_expiry)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700 font-medium">Kuduz aşısı kaydı bulunamadı</p>
                    <p className="text-xs text-red-600 mt-1">
                      Kuduz aşısı Türkiye&apos;de köpekler için yasal zorunluluktur.
                    </p>
                    <Link href="/owner/appointments/book">
                      <Button size="sm" className="mt-2 bg-red-600 hover:bg-red-700 text-xs h-7">
                        Randevu Al
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400">
                Pasaport bilgileri veteriner muayenesi sırasında güncellenebilir.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medical Records Tab */}
        <TabsContent value="records">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tıbbi Kayıtlar</CardTitle>
            </CardHeader>
            <CardContent>
              {medicalRecords && medicalRecords.length > 0 ? (
                <div className="space-y-4">
                  {medicalRecords.map((record: MedicalRecord & {
                    appointment: {
                      datetime: string;
                      type: string;
                      vet: { user: { full_name: string } }
                    }
                  }) => {
                    const assessment = record.soap_notes?.assessment ?? "";
                    const statusMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
                      "iyi":    { label: "İyi",                 color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
                      "orta":   { label: "Orta",                color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
                      "dikkat": { label: "Dikkat Gerektiriyor", color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200"   },
                    };
                    const statusInfo  = statusMap[assessment.toLowerCase()] ?? null;
                    const typeLabel   = record.appointment?.type === "video" ? "📹 Video" : record.appointment?.type === "in_person" ? "🏥 Klinik" : "🚨 Acil";

                    return (
                      <div key={record.id} className={`border rounded-xl p-4 ${statusInfo ? statusInfo.border : "border-gray-100"}`}>
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div>
                            <p className="font-semibold text-sm text-gray-900">
                              {record.appointment?.datetime
                                ? formatDate(record.appointment.datetime)
                                : "Tarih belirtilmemiş"}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Vet. Hek. {record.appointment?.vet?.user?.full_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                              {typeLabel}
                            </span>
                            {statusInfo && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* SOAP notes — skip assessment (shown as badge above) */}
                        {record.soap_notes && (
                          <div className="space-y-1.5">
                            {[
                              { key: "subjective", label: "Şikayet",        color: "text-gray-600"  },
                              { key: "objective",  label: "Bulgular",        color: "text-blue-700"  },
                              { key: "plan",       label: "Öneri & Tedavi",  color: "text-green-700" },
                            ].map(({ key, label, color }) => {
                              const value = record.soap_notes![key as keyof typeof record.soap_notes] as string;
                              return value ? (
                                <div key={key} className="text-xs">
                                  <span className="font-semibold text-gray-500">{label}: </span>
                                  <span className={color}>{value}</span>
                                </div>
                              ) : null;
                            })}
                          </div>
                        )}

                        {/* İlaç notu */}
                        {record.vet_notes && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs">
                              <span className="font-semibold text-purple-600">İlaç Önerisi: </span>
                              <span className="text-gray-600">{record.vet_notes}</span>
                            </p>
                          </div>
                        )}

                        {/* Medications (structured) */}
                        {record.medications && Array.isArray(record.medications) && record.medications.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-600 mb-1">İlaçlar:</p>
                            {record.medications.map((med, idx: number) => (
                              <div key={idx} className="text-xs text-gray-600">
                                • {typeof med === "object" && med !== null && "name" in med ? (med as { name: string; dosage: string; duration: string }).name : ""}
                                {" — "}
                                {typeof med === "object" && med !== null && "dosage" in med ? (med as { dosage: string }).dosage : ""}
                                {" — "}
                                {typeof med === "object" && med !== null && "duration" in med ? (med as { duration: string }).duration : ""}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Follow-up */}
                        {record.follow_up_date && (
                          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                            📅 Takip önerisi: {formatDate(record.follow_up_date)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">Tıbbi kayıt bulunmuyor</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weight Tab */}
        <TabsContent value="weight">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Kilo Takibi</CardTitle>
                <Link href={`/owner/pets/${id}/add-weight`}>
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-1" /> Kilo Ekle
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {weightLogs && weightLogs.length > 0 ? (
                <>
                  <WeightChart data={weightLogs as WeightLog[]} />
                  <div className="mt-4 space-y-2">
                    {weightLogs.slice(-5).reverse().map((log: WeightLog) => (
                      <div key={log.id} className="flex justify-between text-sm">
                        <span className="text-gray-500">{formatDate(log.recorded_at)}</span>
                        <span className="font-medium">{log.weight} kg</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">Kilo kaydı bulunamadı</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Fotoğraf Galerisi</CardTitle>
                <Link href={`/owner/pets/${id}/add-photo`}>
                  <Button size="sm" variant="outline">
                    <Camera className="w-4 h-4 mr-1" /> Fotoğraf Ekle
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {photos && photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo: PetPhoto) => (
                    <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.photo_url}
                        alt={photo.caption || "Hayvan fotoğrafı"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">Fotoğraf bulunamadı</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
