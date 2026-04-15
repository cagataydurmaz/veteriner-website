import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSpeciesEmoji, getAgeFromBirthDate } from "@/lib/utils";
import type { Vaccine } from "@/types";
import PassportPrintButton from "@/components/owner/PassportPrintButton";

interface Params { params: Promise<{ id: string }> }

export default async function PetPassportPage({ params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: pet } = await supabase
    .from("pets").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!pet) notFound();

  const { data: vaccines } = await supabase
    .from("vaccines").select("*").eq("pet_id", id).order("given_date", { ascending: false });

  const profileUrl = `https://veterineribul.com/owner/pets/${id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(profileUrl)}&bgcolor=ffffff&color=166534&format=png`;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Print / Download button — hidden in print */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Evcil Hayvan Pasaportu</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pet.name} — yazdırılabilir sürüm</p>
        </div>
        <PassportPrintButton />
      </div>

      {/* Passport Document */}
      <div className="bg-white border-2 border-[#166534] rounded-2xl overflow-hidden shadow-lg print:shadow-none print:border-gray-400">
        {/* Header */}
        <div className="bg-[#166534] px-6 py-4 flex items-center justify-between">
          <div className="text-white">
            <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Dijital Evcil Hayvan Pasaportu</p>
            <p className="text-xl font-bold mt-0.5">Veterineri Bul</p>
          </div>
          <div className="text-right text-white/80 text-xs">
            <p>veterineribul.com</p>
            <p className="mt-0.5">Türkiye</p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-3 gap-6">
          {/* Left: Photo + QR */}
          <div className="col-span-1 flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-[#166534]/20 bg-gray-50 flex items-center justify-center">
              {pet.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl">{getSpeciesEmoji(pet.species)}</span>
              )}
            </div>
            {/* QR Code */}
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR Kod" width={100} height={100} className="mx-auto rounded-lg border border-gray-200" />
              <p className="text-[9px] text-gray-400 mt-1">Profili görüntüle</p>
            </div>
          </div>

          {/* Right: Info */}
          <div className="col-span-2 space-y-3">
            <div>
              <p className="text-2xl font-bold text-gray-900">{pet.name}</p>
              <p className="text-sm text-gray-600">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: "Doğum Tarihi", value: pet.birth_date ? formatDate(pet.birth_date) : "Bilinmiyor" },
                { label: "Yaş", value: pet.birth_date ? getAgeFromBirthDate(pet.birth_date) : "—" },
                { label: "Ağırlık", value: pet.weight ? `${pet.weight} kg` : "—" },
                { label: "Mikroçip No", value: pet.microchip_number || "—" },
                { label: "Pasaport No", value: pet.passport_number || "—" },
                { label: "Alerjiler", value: pet.allergies || "Yok" },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400">{f.label}</p>
                  <p className={`text-sm font-medium ${f.label === "Alerjiler" && pet.allergies ? "text-red-700" : "text-gray-900"}`}>
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
            {pet.chronic_conditions && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                <p className="text-xs text-red-600 font-medium">⚠️ Kronik Durumlar: {pet.chronic_conditions}</p>
              </div>
            )}
          </div>
        </div>

        {/* Vaccines Table */}
        <div className="px-6 pb-6">
          <p className="text-sm font-bold text-gray-900 mb-3 border-t border-gray-100 pt-4">Aşı Geçmişi</p>
          {vaccines && vaccines.length > 0 ? (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Aşı Adı</th>
                  <th className="text-left pb-2 font-medium">Yapılma Tarihi</th>
                  <th className="text-left pb-2 font-medium">Yenileme Tarihi</th>
                  <th className="text-left pb-2 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(vaccines as Vaccine[]).map(v => {
                  const overdue = v.next_due_date && new Date(v.next_due_date) < new Date();
                  return (
                    <tr key={v.id}>
                      <td className="py-1.5 font-medium text-gray-900">{v.name}</td>
                      <td className="py-1.5 text-gray-600">{formatDate(v.given_date)}</td>
                      <td className="py-1.5 text-gray-600">{v.next_due_date ? formatDate(v.next_due_date) : "—"}</td>
                      <td className="py-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${overdue ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {overdue ? "Süresi Dolmuş" : "Geçerli"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aşı kaydı bulunmuyor</p>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 text-xs text-gray-400 flex justify-between border-t border-gray-100">
          <span>veterineribul.com</span>
          <span>Belge Tarihi: {formatDate(new Date().toISOString())}</span>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
