import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/otp-attempt
 *
 * Body: { identifier: string, action: "check" | "record" | "clear" }
 *   identifier — normalised email or phone (+90…)
 *
 * Returns:
 *   { allowed: boolean, locked: boolean, attemptsLeft: number,
 *     lockedUntil: string|null, showWarning: boolean }
 *
 * Thresholds
 *   WARN_AFTER  = 3  → showWarning: true, "N hakkınız kaldı" on the UI
 *   MAX_BEFORE_LOCK = 5  → locked for LOCKOUT_MINUTES
 *   LOCKOUT_MINUTES = 30
 */

const WARN_AFTER       = 3;
const MAX_BEFORE_LOCK  = 5;
const LOCKOUT_MINUTES  = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, action } = body as {
      identifier: string;
      action: "check" | "record" | "clear";
    };

    if (!identifier || !action) {
      return NextResponse.json(
        { error: "identifier ve action zorunludur" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const key = identifier.toLowerCase().trim();

    // ── CLEAR (on successful OTP) ──────────────────────────────────────────────
    if (action === "clear") {
      await supabase.from("otp_attempts").delete().eq("identifier", key);
      return NextResponse.json({ cleared: true });
    }

    // ── Fetch current record ───────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("otp_attempts")
      .select("attempt_count, locked_until")
      .eq("identifier", key)
      .maybeSingle();

    // ── CHECK ──────────────────────────────────────────────────────────────────
    if (action === "check") {
      if (!existing) {
        return NextResponse.json({
          allowed: true,
          locked: false,
          attemptsLeft: MAX_BEFORE_LOCK,
          lockedUntil: null,
          showWarning: false,
        });
      }

      // Currently locked?
      if (
        existing.locked_until &&
        new Date(existing.locked_until) > new Date()
      ) {
        return NextResponse.json({
          allowed: false,
          locked: true,
          attemptsLeft: 0,
          lockedUntil: existing.locked_until,
          showWarning: false,
        });
      }

      // Lock expired — treat as fresh
      if (
        existing.locked_until &&
        new Date(existing.locked_until) <= new Date()
      ) {
        await supabase
          .from("otp_attempts")
          .update({ attempt_count: 0, locked_until: null })
          .eq("identifier", key);
        return NextResponse.json({
          allowed: true,
          locked: false,
          attemptsLeft: MAX_BEFORE_LOCK,
          lockedUntil: null,
          showWarning: false,
        });
      }

      const attemptsLeft = Math.max(0, MAX_BEFORE_LOCK - existing.attempt_count);
      return NextResponse.json({
        allowed: attemptsLeft > 0,
        locked: false,
        attemptsLeft,
        lockedUntil: null,
        showWarning: existing.attempt_count >= WARN_AFTER,
      });
    }

    // ── RECORD (failed attempt) ────────────────────────────────────────────────
    if (action === "record") {
      const currentCount = existing?.attempt_count ?? 0;
      const newCount = currentCount + 1;
      let lockedUntil: string | null = null;

      if (newCount >= MAX_BEFORE_LOCK) {
        lockedUntil = new Date(
          Date.now() + LOCKOUT_MINUTES * 60 * 1000
        ).toISOString();

        // Log suspicious activity (fire-and-forget)
        void supabase
          .from("system_errors")
          .insert({
            severity: "medium",
            message: `OTP kilidi: ${key} — ${newCount} başarısız deneme, ${LOCKOUT_MINUTES} dk askı`,
          });
      }

      await supabase
        .from("otp_attempts")
        .upsert(
          {
            identifier: key,
            attempt_count: newCount,
            locked_until: lockedUntil,
            last_attempt_at: new Date().toISOString(),
          },
          { onConflict: "identifier" }
        );

      const attemptsLeft = Math.max(0, MAX_BEFORE_LOCK - newCount);
      return NextResponse.json({
        allowed: attemptsLeft > 0,
        locked: newCount >= MAX_BEFORE_LOCK,
        attemptsLeft,
        lockedUntil,
        showWarning: newCount >= WARN_AFTER,
      });
    }

    return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
