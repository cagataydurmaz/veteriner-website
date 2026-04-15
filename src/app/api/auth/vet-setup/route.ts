import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Called right after vet signUp — uses service role to bypass RLS
// (unconfirmed users can't write to public.users via client)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId, email, full_name, city,
      chamber_number, sicil_no, license_number,
      specialty, district, bio,
      consultation_fee, license_document_url,
      kvkk_consent,   // boolean — sent from vet register form
    } = body;

    if (!userId || !email) {
      return NextResponse.json({ error: "userId ve email zorunludur" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Check if this email already exists with a different role (conflict guard)
    const { data: existingByEmail } = await supabase
      .from("users")
      .select("id, role")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existingByEmail && existingByEmail.id !== userId) {
      // A different account already owns this email
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın veya farklı bir e-posta kullanın." },
        { status: 409 }
      );
    }

    // Upsert into public.users with role=vet
    const kvkkApproved = kvkk_consent === true;
    const { error: userError } = await supabase.from("users").upsert({
      id: userId,
      email,
      role: "vet",
      full_name: full_name || "",
      city: city || null,
      // Persist KVKK consent timestamp (Law No. 6698)
      is_kvkk_approved: kvkkApproved,
      kvkk_approved_at: kvkkApproved ? new Date().toISOString() : null,
    }, { onConflict: "id" });

    if (userError) {
      console.error("users upsert error:", userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Check if veterinarians record already exists (avoid duplicate)
    const { data: existing } = await supabase
      .from("veterinarians")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: vetError } = await supabase.from("veterinarians").insert({
        user_id: userId,
        chamber_number,
        sicil_no,
        license_number,
        specialty,
        city,
        district: district || null,
        bio: bio || null,
        license_document_url: license_document_url || null,
        consultation_fee: parseFloat(consultation_fee) || 0,
        video_consultation_fee: parseFloat(consultation_fee) * 0.8 || 0,
        subscription_tier: "basic",
        is_verified: false,
      });

      if (vetError) {
        console.error("veterinarians insert error:", vetError);
        return NextResponse.json({ error: vetError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    console.error("vet-setup error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
