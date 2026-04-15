import type { CheckResult } from "./types";

type RateLimitResult = { allowed: boolean; locked: boolean; lockedUntil: string | null };

/** SAFE_ALLOW: returned when rate-limit service is unreachable.
 *  We allow the request through rather than hard-blocking users,
 *  but log the failure so ops can investigate. */
const SAFE_ALLOW: RateLimitResult = { allowed: true, locked: false, lockedUntil: null };

export async function checkIdentity(
  payload: { email?: string; phone?: string }
): Promise<CheckResult> {
  try {
    const res = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[auth/api] checkIdentity non-OK:", res.status);
      return { exists: false };
    }
    const raw = await res.json();
    if (raw && typeof raw === "object" && "exists" in raw) return raw as CheckResult;
    return { exists: false };
  } catch (err) {
    console.error("[auth/api] checkIdentity failed:", err);
    return { exists: false };
  }
}

export async function checkRateLimit(email: string): Promise<RateLimitResult> {
  try {
    const res = await fetch("/api/auth/rate-limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action: "check" }),
    });
    if (!res.ok) {
      console.warn("[auth/api] checkRateLimit non-OK:", res.status);
      return SAFE_ALLOW;
    }
    return res.json();
  } catch (err) {
    console.error("[auth/api] checkRateLimit failed:", err);
    return SAFE_ALLOW;
  }
}

export async function recordRateLimit(email: string): Promise<RateLimitResult> {
  try {
    const res = await fetch("/api/auth/rate-limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action: "record" }),
    });
    if (!res.ok) {
      console.warn("[auth/api] recordRateLimit non-OK:", res.status);
      return SAFE_ALLOW;
    }
    return res.json();
  } catch (err) {
    console.error("[auth/api] recordRateLimit failed:", err);
    return SAFE_ALLOW;
  }
}
