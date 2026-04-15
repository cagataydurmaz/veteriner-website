import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConsultationClient from "@/components/vet/ConsultationClient";
import { getSpeciesEmoji } from "@/lib/utils";

/**
 * /vet/consultation/[id]
 *
 * Vet-only split-screen consultation view:
 *   LEFT  — Agora video call
 *   RIGHT — e-Nabız medical sidebar (lab results, imaging, vaccines, past visits)
 *
 * Only accessible when appointment status is "confirmed" and the appointment
 * belongs to the logged-in vet.
 */

export const dynamic = "force-dynamic";

export default async function VetConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/vet-login");

  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vet) redirect("/vet/profile");

  // Load appointment + relations (include video_room_id so the client skips create-room if it exists)
  const { data: apt } = await supabase
    .from("appointments")
    .select(`
      id, datetime, status, complaint, appointment_type, type, video_room_id,
      pet:pets(id, name, species, breed, birth_date, weight, allergies, chronic_conditions, photo_url),
      owner:users!appointments_owner_id_fkey(id, full_name, phone)
    `)
    .eq("id", id)
    .eq("vet_id", vet.id)
    .in("status", ["confirmed", "completed"])
    .maybeSingle();

  if (!apt) notFound();

  // Supabase returns joined rows as an array even for single-row joins
  const petRaw  = (Array.isArray(apt.pet)   ? apt.pet[0]   : apt.pet)   as unknown as {
    id: string; name: string; species: string; breed?: string;
    birth_date?: string; weight?: number;
    allergies?: string; chronic_conditions?: string; photo_url?: string;
  } | null;
  const ownerRaw = (Array.isArray(apt.owner) ? apt.owner[0] : apt.owner) as unknown as {
    id: string; full_name: string; phone?: string;
  } | null;

  const petId = petRaw?.id ?? "";

  // Load all medical records for this pet
  const { data: medRecords } = await supabase
    .from("medical_records")
    .select(`
      id, created_at, visit_date, diagnosis, vet_notes, medications,
      lab_results, imaging_urls, vaccine_details
    `)
    .eq("pet_id", petId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Load past appointments for this pet (brief history)
  const { data: pastApts } = await supabase
    .from("appointments")
    .select("id, datetime, complaint, status")
    .eq("pet_id", petId)
    .eq("status", "completed")
    .neq("id", id)
    .order("datetime", { ascending: false })
    .limit(10);

  const pet = petRaw;

  const petAge = pet?.birth_date
    ? Math.floor((Date.now() - new Date(pet.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  const owner = ownerRaw;

  return (
    <ConsultationClient
      appointmentId={apt.id}
      initialRoomId={(apt as { video_room_id?: string | null }).video_room_id ?? null}
      appointmentDatetime={apt.datetime}
      appointmentType={apt.appointment_type ?? apt.type}
      complaint={apt.complaint}
      pet={{
        id:                pet?.id ?? "",
        name:              pet?.name ?? "—",
        species:           pet?.species ?? "",
        speciesEmoji:      getSpeciesEmoji(pet?.species ?? ""),
        breed:             pet?.breed,
        age:               petAge,
        weight:            pet?.weight,
        allergies:         pet?.allergies,
        chronic_conditions: pet?.chronic_conditions,
      }}
      owner={{
        id:        owner?.id ?? "",
        full_name: owner?.full_name ?? "—",
        phone:     owner?.phone,
      }}
      medicalRecords={(medRecords ?? []) as MedicalRecord[]}
      pastAppointments={(pastApts ?? []) as PastAppointment[]}
    />
  );
}

// ── Shared types (re-exported for ConsultationClient) ────────────────────────
export interface MedicalRecord {
  id:             string;
  created_at:     string;
  visit_date?:    string;
  diagnosis?:     string;
  vet_notes?:     string;
  medications?:   unknown[];
  lab_results?:   LabResult[];
  imaging_urls?:  string[];
  vaccine_details?: VaccineDetail[];
}

export interface LabResult {
  test:       string;
  result:     string;
  unit?:      string;
  ref_range?: string;
  date?:      string;
}

export interface VaccineDetail {
  vaccine_name: string;
  given_date:   string;
  next_due?:    string;
  batch_no?:    string;
}

export interface PastAppointment {
  id:        string;
  datetime:  string;
  complaint?: string;
  status:    string;
}
