import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";

// Quick rate-limit gate called before client-side appointment creation
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    // 10 appointment attempts per hour
    const check = await checkRateLimit(user.id, "appointment");
    if (!check.allowed) {
      return NextResponse.json({ error: check.message }, { status: 429 });
    }

    return NextResponse.json({ allowed: true, remaining: check.remaining });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
