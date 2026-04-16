import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * DELETE /api/owner/pets/[id]
 *
 * Deletes a pet owned by the authenticated user.
 *
 * DB cascade (ON DELETE CASCADE):  vaccines, weight_logs, pet_photos, reminders
 * DB set null  (ON DELETE SET NULL): appointments.pet_id, medical_records.pet_id,
 *                                    symptom_checks.pet_id
 *
 * Auth: requires owner auth
 * Ownership: verified server-side — pet.owner_id === user.id
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: petId } = await params;

    if (!petId || petId.length < 10) {
      return NextResponse.json({ error: "Geçersiz hayvan ID" }, { status: 400 });
    }

    // ── 1. Auth check ──────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    // ── 2. Ownership check — only the owner can delete their own pet ───────
    // Using user-scoped client so RLS already enforces owner_id filter.
    const { data: pet } = await supabase
      .from("pets")
      .select("id, name")
      .eq("id", petId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!pet) {
      // 404 for both "not found" and "not yours" — don't leak existence
      return NextResponse.json({ error: "Hayvan bulunamadı" }, { status: 404 });
    }

    // ── 3. Delete — service client bypasses RLS WITH CHECK on delete ───────
    const service = createServiceClient();
    const { error } = await service
      .from("pets")
      .delete()
      .eq("id", petId)
      .eq("owner_id", user.id); // double-guard even with service client

    if (error) throw error;

    return NextResponse.json({ ok: true, deleted: pet.name });
  } catch (err) {
    console.error("[DELETE /api/owner/pets/[id]]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
