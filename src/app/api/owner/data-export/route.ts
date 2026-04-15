import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const service = createServiceClient();

  const [
    { data: userData },
    { data: pets },
    { data: appointments },
    { data: reviews },
    { data: symptomChecks },
  ] = await Promise.all([
    service.from("users").select("id, email, full_name, phone, city, created_at").eq("id", user.id).single(),
    service.from("pets").select("*").eq("owner_id", user.id),
    service.from("appointments").select("id, datetime, type, status, complaint, created_at").eq("owner_id", user.id),
    service.from("reviews").select("rating, comment, created_at").eq("owner_id", user.id),
    service.from("symptom_checks").select("symptoms_text, urgency_level, created_at").eq("owner_id", user.id),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    personal_data: userData,
    pets: pets || [],
    appointments: appointments || [],
    reviews: reviews || [],
    symptom_checks: symptomChecks || [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="veterinerbul-verilerim-${Date.now()}.json"`,
    },
  });
}
