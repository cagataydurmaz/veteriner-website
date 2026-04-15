"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, PawPrint, Calendar, AlertCircle, Loader2, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { getSpeciesEmoji, formatDate } from "@/lib/utils";

type Patient = {
  pet_id: string;
  pet_name: string;
  pet_species: string;
  pet_breed: string | null;
  pet_age: number | null;
  owner_name: string;
  owner_phone: string | null;
  last_visit: string;
  visit_count: number;
  allergies: string | null;
  chronic_conditions: string | null;
  last_appointment_id: string;
};

export default function VetPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: vet, error: vetError } = await supabase
        .from("veterinarians").select("id").eq("user_id", user.id).maybeSingle();
      if (vetError || !vet) return;

      const { data: apts, error: aptsError } = await supabase
        .from("appointments")
        .select(`
          id, datetime, pet_id,
          pet:pets(name, species, breed, birth_date, allergies, chronic_conditions),
          owner:users(full_name, phone)
        `)
        .eq("vet_id", vet.id)
        .in("status", ["completed", "confirmed"])
        .order("datetime", { ascending: false });

      if (aptsError) throw aptsError;
      if (!apts) { setLoading(false); return; }

      // Deduplicate by pet_id, keep most recent visit
      const seen = new Map<string, Patient>();
      for (const aptRaw of apts) {
        const apt = {
          ...aptRaw,
          pet: Array.isArray(aptRaw.pet) ? aptRaw.pet[0] : aptRaw.pet,
          owner: Array.isArray(aptRaw.owner) ? aptRaw.owner[0] : aptRaw.owner,
        };
        // Calculate age from birth_date
        let age: number | null = null;
        if (apt.pet?.birth_date) {
          const diff = Date.now() - new Date(apt.pet.birth_date).getTime();
          age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        }

        if (!seen.has(apt.pet_id)) {
          seen.set(apt.pet_id, {
            pet_id: apt.pet_id,
            pet_name: apt.pet?.name || "—",
            pet_species: apt.pet?.species || "",
            pet_breed: apt.pet?.breed || null,
            pet_age: age,
            owner_name: apt.owner?.full_name || "—",
            owner_phone: apt.owner?.phone || null,
            last_visit: apt.datetime,
            visit_count: 1,
            allergies: apt.pet?.allergies || null,
            chronic_conditions: apt.pet?.chronic_conditions || null,
            last_appointment_id: apt.id,
          });
        } else {
          seen.get(apt.pet_id)!.visit_count++;
        }
      }

      setPatients(Array.from(seen.values()));
    } catch (err) {
      toast.error("Hastalar yüklenemedi");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const filtered = patients.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.pet_name.toLowerCase().includes(s) || p.owner_name.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hastalarım</h1>
        <p className="text-sm text-gray-500 mt-1">{patients.length} kayıtlı hasta</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Hasta veya sahip ara…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#166534]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4 bg-white rounded-2xl border border-gray-100">
          {search ? (
            <>
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center">
                <Search className="w-7 h-7 text-gray-300" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Sonuç bulunamadı</p>
                <p className="text-sm text-gray-400 mt-1">
                  &quot;{search}&quot; ile eşleşen hasta veya sahip yok.
                </p>
              </div>
              <button
                onClick={() => setSearch("")}
                className="text-sm text-[#166534] hover:underline"
              >
                Aramayı temizle
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-[#F0FDF4] rounded-2xl flex items-center justify-center">
                <PawPrint className="w-8 h-8 text-[#166534]/30" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Henüz hasta kaydı yok</p>
                <p className="text-sm text-gray-400 mt-1 max-w-xs">
                  İlk randevunu tamamladığında hasta sahiplerinin evcil hayvanları
                  burada arşivlenir.
                </p>
              </div>
              <Link href="/vet/appointments">
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#166534] text-white text-sm font-semibold hover:bg-[#14532D] transition-colors">
                  <Calendar className="w-4 h-4" />
                  Randevulara Git
                </button>
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(p => (
            <Link key={p.pet_id} href={`/vet/appointments/${p.last_appointment_id}`}>
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-[#F0FDF4] rounded-xl flex items-center justify-center text-2xl shrink-0">
                      {getSpeciesEmoji(p.pet_species)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900">{p.pet_name}</p>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-500">
                        {p.pet_species}
                        {p.pet_breed && ` · ${p.pet_breed}`}
                        {p.pet_age && ` · ${p.pet_age} yaş`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Sahip: {p.owner_name}
                        {p.owner_phone && ` · ${p.owner_phone}`}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="w-3 h-3 mr-1" />
                          {p.visit_count} ziyaret
                        </Badge>
                        <span className="text-xs text-gray-400">
                          Son: {formatDate(p.last_visit)}
                        </span>
                      </div>
                      {p.allergies && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <AlertCircle className="w-3 h-3 text-orange-500 shrink-0" />
                          <span className="text-xs text-orange-600 truncate">Alerji: {p.allergies}</span>
                        </div>
                      )}
                      {p.chronic_conditions && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                          <span className="text-xs text-red-600 truncate">Kronik: {p.chronic_conditions}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
