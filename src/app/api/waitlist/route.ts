import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, city, source } = await request.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Geçerli bir email adresi girin" },
        { status: 400 }
      );
    }
    const supabase = await createClient();
    const { error } = await supabase.from("waitlist").insert({
      email: email.trim().toLowerCase(),
      city: city || null,
      source: source || "demo_card",
    });
    if (error) {
      // Duplicate email: still return success (no info leak)
      console.error("Waitlist insert error:", error);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu" },
      { status: 500 }
    );
  }
}
