import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import AppointmentChat from "@/components/chat/AppointmentChat";

export default async function OwnerChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: apt } = await supabase
    .from("appointments")
    .select(`
      id, status, datetime, messaging_expires_at,
      vet:veterinarians(user:users!veterinarians_user_id_fkey(full_name))
    `)
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!apt) notFound();

  const vetUser = Array.isArray(apt.vet)
    ? (Array.isArray(apt.vet[0]?.user) ? apt.vet[0].user[0] : apt.vet[0]?.user)
    : (Array.isArray((apt.vet as { user: unknown })?.user) ? (apt.vet as { user: { full_name: string }[] }).user[0] : (apt.vet as { user: { full_name: string } | null } | null)?.user);

  const vetName = (vetUser as { full_name?: string } | null)?.full_name || "Veteriner";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      <div className="py-3 px-1 flex items-center gap-3 shrink-0">
        <Link href={`/owner/appointments/${id}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Randevu Detayı
        </Link>
        <span className="text-gray-300">·</span>
        <span className="text-sm font-medium text-gray-700">Vet. Hek. {vetName} ile Mesajlaşma</span>
      </div>
      <div className="flex-1 min-h-0">
        <AppointmentChat
          appointmentId={id}
          currentUserId={user.id}
          otherPartyName={`Vet. Hek. ${vetName}`}
          appointmentStatus={apt.status as "pending" | "confirmed" | "completed" | "cancelled" | "no_show"}
          messagingExpiresAt={(apt as { messaging_expires_at?: string | null }).messaging_expires_at}
          isVet={false}
        />
      </div>
    </div>
  );
}
