import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/rate-limit
 *
 * Body: { email?: string, action: "check" | "record" }
 * Key = "<ip>::<normalised-email>"
 *
 * Tiers:
 *   5  fails → 15 min lockout
 *   10 fails → 1 h lockout
 *   20 fails → 1 h lockout + admin WhatsApp alert + system_errors
 */

interface Tier {
  after: number;
  minutes: number;
}

const TIERS: Tier[] = [
  { after: 5,  minutes: 15 },
  { after: 10, minutes: 60 },
  { after: 20, minutes: 60 },   // same duration, but also alerts admin
];

function pickTier(count: number): Tier | null {
  // Walk from highest threshold downward
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (count >= TIERS[i].after) return TIERS[i];
  }
  return null;
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, action } = body as {
      email?: string;
      action: "check" | "record";
    };

    if (!action) {
      return NextResponse.json({ error: "action zorunludur" }, { status: 400 });
    }

    const ip  = getIp(req);
    const key = `${ip}::${(email ?? "").toLowerCase().trim()}`;
    const supabase = await createServiceClient();

    // ── Fetch current record ───────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("rate_limit")
      .select("attempt_count, locked_until")
      .eq("key", key)
      .maybeSingle();

    // Helper: is currently locked?
    const isNowLocked =
      !!existing?.locked_until &&
      new Date(existing.locked_until) > new Date();

    // ── CHECK ──────────────────────────────────────────────────────────────────
    if (action === "check") {
      if (!existing || !isNowLocked) {
        // If lock expired, reset silently
        if (existing?.locked_until && !isNowLocked) {
          await supabase
            .from("rate_limit")
            .update({ attempt_count: 0, locked_until: null })
            .eq("key", key);
        }
        return NextResponse.json({ allowed: true, locked: false, lockedUntil: null });
      }
      return NextResponse.json({
        allowed: false,
        locked: true,
        lockedUntil: existing.locked_until,
      });
    }

    // ── RECORD ─────────────────────────────────────────────────────────────────
    if (action === "record") {
      // If currently locked, don't increment further (avoid counter abuse)
      if (isNowLocked) {
        return NextResponse.json({
          allowed: false,
          locked: true,
          lockedUntil: existing!.locked_until,
        });
      }

      const currentCount = existing?.attempt_count ?? 0;
      const newCount     = currentCount + 1;
      const tier         = pickTier(newCount);
      const lockedUntil  = tier
        ? new Date(Date.now() + tier.minutes * 60 * 1000).toISOString()
        : null;

      await supabase
        .from("rate_limit")
        .upsert(
          {
            key,
            attempt_count: newCount,
            locked_until: lockedUntil,
            last_attempt_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      // Logging
      if (newCount >= 20) {
        void supabase
          .from("system_errors")
          .insert({
            severity: "high",
            message: `Brute force: IP=${ip} email=${email ?? "?"} — ${newCount} deneme`,
          });
      } else if (newCount >= 5) {
        void supabase
          .from("system_errors")
          .insert({
            severity: "low",
            message: `Hız sınırı: IP=${ip} email=${email ?? "?"} — ${newCount} deneme`,
          });
      }

      return NextResponse.json({
        allowed: !lockedUntil,
        locked: !!lockedUntil,
        lockedUntil,
        attemptCount: newCount,
      });
    }

    return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
