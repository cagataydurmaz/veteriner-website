import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendConsultationSummaryEmail } from "@/lib/email";

interface ConsultationNotes {
  genel_durum: string;
  bulgular:    string | null;
  oneri:       string | null;
  ilac_notu:   string | null;
  takip_gunu:  number | null;
}

/**
 * POST /api/appointments/complete
 *
 * Completes an appointment and runs Phase 5 escrow release + commission split.
 *
 * Appointment types handled:
 *   clinic    → escrow was "not_applicable"; payment_status stays as-is
 *               Just marks status=completed, no money movement.
 *
 *   online    → escrow was "pending" or "held"
 *   emergency → escrow was "pending" or "held"
 *               Releases escrow:
 *                 escrow_status = "released"
 *                 payment_status = "completed"
 *                 platform_commission = amount * commission_rate_pct / 100
 *                 vet_payout = amount - platform_commission
 *               Inserts payments row with both columns.
 *
 * 48-hour messaging window is opened for all types.
 * Optional consultationNotes → saved to medical_records.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    let body: { appointmentId: string; consultationNotes?: ConsultationNotes };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }

    const { appointmentId, consultationNotes } = body;
    if (!appointmentId)
      return NextResponse.json({ error: "appointmentId zorunludur" }, { status: 400 });

    // ── Verify caller is a vet ────────────────────────────────────────────────
    const { data: vet } = await supabase
      .from("veterinarians")
      .select("id, commission_rate_pct")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vet) return NextResponse.json({ error: "Veteriner profili bulunamadı" }, { status: 403 });

    const commissionPct: number = vet.commission_rate_pct ?? 15;

    // ── Load appointment ─────────────────────────────────────────────────────
    const { data: apt } = await supabase
      .from("appointments")
      .select(`
        id, type, appointment_type, status,
        payment_status, payment_amount, escrow_status,
        iyzico_transaction_id, notes, owner_id, pet_id,
        pet:pets(name, species),
        owner:users!owner_id(full_name, email)
      `)
      .eq("id", appointmentId)
      .eq("vet_id", vet.id)
      .maybeSingle();

    if (!apt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    if (apt.status === "completed")
      return NextResponse.json({ success: true, message: "Randevu zaten tamamlandı" });
    if (apt.status === "cancelled")
      return NextResponse.json({ error: "İptal edilen randevu tamamlanamaz" }, { status: 400 });
    if (apt.status !== "confirmed")
      return NextResponse.json({ error: "Sadece onaylanmış randevular tamamlanabilir" }, { status: 400 });

    // ── 48-hour messaging window ──────────────────────────────────────────────
    const messagingExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Resolve appointment_type (new column) with fallback to legacy type column
    const aptType: string = apt.appointment_type ?? (apt.type === "video" ? "online" : "clinic");
    const isPaymentAppointment = aptType === "online" || aptType === "emergency";

    // ── Commission & payout calculation ──────────────────────────────────────
    const amount: number = apt.payment_amount ?? 0;
    const platformCommission = isPaymentAppointment
      ? Math.round(amount * commissionPct) / 100   // rounded to nearest paisa
      : 0;
    const vetPayout = isPaymentAppointment
      ? amount - platformCommission
      : 0;

    // ── Update appointment ────────────────────────────────────────────────────
    const appointmentUpdate: Record<string, unknown> = {
      status:               "completed",
      messaging_expires_at: messagingExpiresAt,
    };

    if (isPaymentAppointment) {
      // Only release if escrow was actually held (guard against double-completion)
      if (apt.escrow_status === "released")
        return NextResponse.json({ success: true, message: "Escrow zaten serbest bırakıldı" });

      appointmentUpdate.escrow_status   = "released";
      appointmentUpdate.payment_status  = "completed";
    }

    // ── All DB writes use service_role to avoid RLS WITH CHECK correlated
    //    sub-query failures on the veterinarians / appointments / payments tables.
    const service = createServiceClient();

    const { error: updateErr } = await service
      .from("appointments")
      .update(appointmentUpdate)
      .eq("id", appointmentId);

    if (updateErr) {
      console.error("complete: appointment update error:", updateErr);
      return NextResponse.json({ error: "Randevu güncellenemedi" }, { status: 500 });
    }

    // ── Reset is_busy (Layer 3 mutex release) ────────────────────────────────
    // CRITICAL: if this update fails, the vet remains permanently locked.
    // is_busy is a Layer 3 column — blocked by RLS WITH CHECK for user clients.
    // Must use service_role client so the reset is never silently rejected.
    const { error: busyResetErr } = await service
      .from("veterinarians")
      .update({ is_busy: false })
      .eq("id", vet.id);

    if (busyResetErr) {
      // Non-fatal for the owner (appointment is already marked complete), but
      // the vet will be stuck in is_busy=true until the cron self-heals (≤5 min).
      // Log urgently so the issue is visible in Vercel logs.
      console.error("[appointments/complete] CRITICAL: is_busy reset failed for vet", vet.id, busyResetErr);
    }

    // ── Log payment record ────────────────────────────────────────────────────
    const paymentType =
      aptType === "online"    ? "video_consultation" :
      aptType === "emergency" ? "emergency_consultation" :
      "in_person_consultation";

    const paymentStatus = isPaymentAppointment ? "released" : "paid_at_clinic";

    const paymentDescription =
      aptType === "online"    ? `Online görüşme tamamlandı — ₺${vetPayout.toFixed(2)} veterinere aktarılıyor` :
      aptType === "emergency" ? `Acil görüşme tamamlandı — ₺${vetPayout.toFixed(2)} veterinere aktarılıyor` :
      "Klinik muayene tamamlandı";

    const { error: paymentInsertErr } = await service.from("payments").insert({
      vet_id:              vet.id,
      owner_id:            apt.owner_id,
      appointment_id:      appointmentId,
      amount:              amount,
      type:                paymentType,
      status:              paymentStatus,
      description:         paymentDescription,
      platform_commission: platformCommission,
      vet_payout:          vetPayout,
    });

    if (paymentInsertErr) {
      // Revenue loss risk: log with full context for manual reconciliation.
      console.error("[appointments/complete] CRITICAL: payment record insert failed", {
        appointmentId,
        vetId: vet.id,
        amount,
        vetPayout,
        platformCommission,
        error: paymentInsertErr,
      });
    }

    // ── Save medical record (if notes provided) ───────────────────────────────
    let followUpDate: string | null = null;

    if (consultationNotes) {
      const { genel_durum, bulgular, oneri, ilac_notu, takip_gunu } = consultationNotes;

      if (takip_gunu && takip_gunu > 0) {
        followUpDate = new Date(Date.now() + takip_gunu * 24 * 60 * 60 * 1000)
          .toISOString().split("T")[0];
      }

      const { error: medicalRecordErr } = await service.from("medical_records").insert({
        appointment_id: appointmentId,
        pet_id:         apt.pet_id,
        soap_notes: {
          subjective: (apt.notes as string) ?? "",
          objective:  bulgular   ?? "",
          assessment: genel_durum,
          plan:       oneri      ?? "",
        },
        vet_notes:      ilac_notu ?? null,
        follow_up_date: followUpDate,
      });

      if (medicalRecordErr) {
        // Missing patient history: log for manual entry.
        console.error("[appointments/complete] medical_records insert failed", {
          appointmentId,
          petId: apt.pet_id,
          error: medicalRecordErr,
        });
      }
    }

    // ── Send consultation summary email ───────────────────────────────────────
    const ownerData = Array.isArray(apt.owner) ? apt.owner[0] : apt.owner as { full_name?: string; email?: string } | null;
    const petData   = Array.isArray(apt.pet)   ? apt.pet[0]   : apt.pet   as { name?: string; species?: string } | null;

    if (ownerData?.email) {
      const { data: vetUser } = await supabase
        .from("users").select("full_name").eq("id", user.id).maybeSingle();

      sendConsultationSummaryEmail({
        to:              ownerData.email,
        ownerName:       ownerData.full_name ?? "Hayvan Sahibi",
        vetName:         `Vet. Hek. ${vetUser?.full_name ?? ""}`,
        petName:         petData?.name ?? "Hayvanınız",
        petSpecies:      petData?.species ?? "",
        appointmentId,
        appointmentType: (apt.type as "video" | "in_person") ?? "in_person",
        notes: consultationNotes ? {
          genel_durum:    consultationNotes.genel_durum,
          bulgular:       consultationNotes.bulgular,
          oneri:          consultationNotes.oneri,
          ilac_notu:      consultationNotes.ilac_notu,
          follow_up_date: followUpDate,
        } : null,
      }).catch((emailErr) => console.error("[appointments/complete] summary email failed:", emailErr));
    }

    // ── Response ─────────────────────────────────────────────────────────────
    const message = isPaymentAppointment
      ? `Görüşme tamamlandı. ₺${vetPayout.toFixed(2)} 1–3 iş günü içinde hesabınıza aktarılacak. (Platform komisyonu: ₺${platformCommission.toFixed(2)})`
      : "Muayene tamamlandı.";

    return NextResponse.json({
      success:             true,
      message,
      escrow_released:     isPaymentAppointment,
      amount,
      platform_commission: platformCommission,
      vet_payout:          vetPayout,
      commission_pct:      commissionPct,
    });

  } catch (err) {
    console.error("appointments/complete error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
