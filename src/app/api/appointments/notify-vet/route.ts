import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendNewBookingEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    // Auth check — caller must be a logged-in user
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { appointmentId } = await req.json();
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId zorunludur" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .select(`
        id, datetime, type,
        owner:users!appointments_owner_id_fkey(full_name),
        pet:pets(name),
        vet:veterinarians!appointments_vet_id_fkey(user:users(full_name, email))
      `)
      .eq("id", appointmentId)
      .maybeSingle();

    if (aptErr || !apt) {
      return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    }

    type VetData = { user: { full_name: string; email: string } | { full_name: string; email: string }[] | null };
    type OwnerData = { full_name: string };
    type PetData = { name: string };

    const vetData = (Array.isArray(apt.vet) ? apt.vet[0] : apt.vet) as VetData | null;
    const vetUser = Array.isArray(vetData?.user) ? vetData?.user[0] : vetData?.user;
    const ownerData = (Array.isArray(apt.owner) ? apt.owner[0] : apt.owner) as OwnerData | null;
    const petData = (Array.isArray(apt.pet) ? apt.pet[0] : apt.pet) as PetData | null;

    if (vetUser?.email) {
      const dt = new Date(apt.datetime as string);
      sendNewBookingEmail({
        to: vetUser.email,
        vetName: vetUser.full_name ?? "Veteriner",
        ownerName: ownerData?.full_name ?? "Kullanıcı",
        petName: petData?.name ?? "Hayvan",
        date: dt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
        time: dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        type: (apt.type as string) === "video" ? "Video Görüşme" : "Yüz Yüze",
        appointmentId,
      }).catch((err) => console.error("[appointments/notify-vet] email failed:", err));
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("notify-vet error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
