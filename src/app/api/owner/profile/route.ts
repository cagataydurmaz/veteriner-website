import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/owner/profile
 * Updates owner profile fields (full_name, phone, city, address, avatar_url).
 *
 * Uses service_role for the DB write to ensure consistency with the
 * rest of the codebase where all user-record writes go through service client.
 * Auth validation still performed with user client.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    // Verify this is an owner
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData || !["owner", "vet"].includes(userData.role ?? "")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }

    const body = await req.json() as {
      full_name?: string;
      phone?: string;
      city?: string;
      address?: string;
      avatar_url?: string | null;
    };

    if (body.full_name !== undefined && !body.full_name?.trim()) {
      return NextResponse.json({ error: "Ad soyad boş bırakılamaz" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (body.full_name  !== undefined) update.full_name  = body.full_name.trim();
    if (body.phone      !== undefined) update.phone      = body.phone;
    if (body.city       !== undefined) update.city       = body.city;
    if (body.address    !== undefined) update.address    = body.address;
    if (body.avatar_url !== undefined) update.avatar_url = body.avatar_url;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
    }

    const service = createServiceClient();
    const { error } = await service
      .from("users")
      .update(update)
      .eq("id", user.id);

    if (error) {
      console.error("[api/owner/profile]", error);
      return NextResponse.json({ error: "Profil kaydedilemedi. Tekrar deneyin." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Profil güncellendi" });
  } catch (err) {
    console.error("[api/owner/profile]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
