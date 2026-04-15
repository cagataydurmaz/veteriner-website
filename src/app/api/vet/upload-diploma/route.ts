import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/vet/upload-diploma
 * Accepts multipart/form-data with a single `file` field.
 *
 * Why server-side?  The "diplomas" Supabase Storage bucket has an RLS policy
 * that blocks user-client uploads (same WITH CHECK correlated sub-query issue
 * as the veterinarians table).  Using the service_role key here bypasses RLS
 * entirely while still verifying the caller's session first.
 *
 * Validation:
 *   • File type: PDF, JPG, PNG only
 *   • File size: ≤ 5 MB
 *
 * Returns: { url: string, message: string }
 */
export async function POST(req: Request) {
  try {
    // ── Auth: verify caller session ───────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    // ── Parse multipart body ──────────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Geçersiz form verisi — multipart/form-data bekleniyor" },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }

    // ── Validate type ─────────────────────────────────────────────────────────
    const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: "Sadece PDF, JPG veya PNG yüklenebilir" },
        { status: 400 }
      );
    }

    // ── Validate size (5 MB) ──────────────────────────────────────────────────
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Dosya boyutu 5 MB'ı geçemez" },
        { status: 400 }
      );
    }

    // ── Build storage path ────────────────────────────────────────────────────
    const ext =
      file.type === "application/pdf" ? "pdf" :
      file.type === "image/png"       ? "png" : "jpg";
    const path = `diplomas/${user.id}/diploma.${ext}`;

    // ── Upload via service_role (bypasses storage RLS) ────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const service = createServiceClient();
    const { error: uploadError } = await service.storage
      .from("diplomas")
      .upload(path, buffer, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.error("[upload-diploma] storage error:", uploadError);
      return NextResponse.json(
        { error: "Dosya yüklenemedi — lütfen tekrar deneyin" },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = service.storage
      .from("diplomas")
      .getPublicUrl(path);

    return NextResponse.json({ url: publicUrl, message: "Diploma yüklendi" });
  } catch (err) {
    console.error("[upload-diploma]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
