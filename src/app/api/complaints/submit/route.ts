import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendNewComplaintAdminEmail } from "@/lib/email";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { appointment_id, reason, description, reporter_type } = body;

  if (!appointment_id || !reason || !reporter_type) {
    return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
  }

  // Verify ownership
  if (reporter_type === "owner") {
    const { data: apt } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", appointment_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 403 });
  } else if (reporter_type === "vet") {
    const { data: vetRow } = await supabase
      .from("veterinarians")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!vetRow) return NextResponse.json({ error: "Veteriner bulunamadı" }, { status: 403 });
    const { data: apt } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", appointment_id)
      .eq("vet_id", vetRow.id)
      .maybeSingle();
    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 403 });
  } else {
    return NextResponse.json({ error: "Geçersiz reporter_type" }, { status: 400 });
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from("complaints")
    .select("id")
    .eq("appointment_id", appointment_id)
    .eq("reporter_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Bu randevu için zaten bir şikayet oluşturdunuz" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("complaints")
    .insert({ appointment_id, reporter_id: user.id, reporter_type, reason, description })
    .select("id")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Şikayet oluşturulamadı" }, { status: 500 });

  // Notify admins (fire-and-forget)
  const serviceSupabase = createServiceClient();
  const { data: admins } = await serviceSupabase
    .from("users")
    .select("email")
    .eq("role", "admin");

  if (admins && admins.length > 0) {
    for (const admin of admins) {
      if (admin.email) {
        sendNewComplaintAdminEmail({
          to: admin.email,
          reporterType: reporter_type,
          reason,
          appointmentId: appointment_id,
          complaintId: data.id,
        }).catch((err) => console.error("[complaints/submit] email failed:", err));
      }
    }
  }

  return NextResponse.json({ success: true, id: data.id });
}
