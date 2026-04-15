import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import AppointmentChat from "@/components/chat/AppointmentChat";

export default async function VetChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/vet-login");

  // Get vet id for this user
  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vet) redirect("/vet/dashboard");

  const { data: apt } = await supabase
    .from("appointments")
    .select(`
      id, status, datetime, messaging_expires_at,
      owner:users!appointments_owner_id_fkey(id, full_name)
    `)
    .eq("id", id)
    .eq("vet_id", vet.id)
    .maybeSingle();

  if (!apt) notFound();

  const owner = Array.isArray(apt.owner) ? apt.owner[0] : apt.owner;
  const ownerName = (owner as { full_name?: string } | null)?.full_name || "Pet Sahibi";

  // For vet, show owner first name only unless confirmed
  const isConfirmed = apt.status === "confirmed" || apt.status === "completed";
  const displayName = isConfirmed
    ? ownerName
    : ownerName.split(" ")[0];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      <div className="py-3 px-1 flex items-center gap-3 shrink-0">
        <Link href={`/vet/appointments`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Randevularım
        </Link>
        <span className="text-gray-300">·</span>
        <span className="text-sm font-medium text-gray-700">{displayName} ile Mesajlaşma</span>
      </div>
      <div className="flex-1 min-h-0">
        <AppointmentChat
          appointmentId={id}
          currentUserId={user.id}
          otherPartyName={displayName}
          appointmentStatus={apt.status as "pending" | "confirmed" | "completed" | "cancelled" | "no_show"}
          messagingExpiresAt={(apt as { messaging_expires_at?: string | null }).messaging_expires_at}
          isVet={true}
        />
      </div>
    </div>
  );
}
