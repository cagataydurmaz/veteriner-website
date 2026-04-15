/**
 * Centralized error tracking utility.
 *
 * - Reports all errors to Sentry
 * - Logs to Supabase system_errors table
 *
 * Usage:
 *   import { trackError, trackPaymentError, trackAuthError } from "@/lib/error-tracking";
 *
 *   catch (err) {
 *     await trackError(err, { context: "appointment booking", userId });
 *   }
 */
import * as Sentry from "@sentry/nextjs";

type Severity = "low" | "medium" | "high" | "critical";

interface TrackOptions {
  /** Human-readable context, e.g. "appointment booking" */
  context?: string;
  /** User or vet ID if known */
  userId?: string;
  /** Arbitrary extra data */
  extra?: Record<string, unknown>;
  /** Override severity. Defaults to "high" for unknown errors */
  severity?: Severity;
}

// ── Internal: insert to system_errors ────────────────────────────────────────
async function logToDatabase(
  message: string,
  severity: Severity,
  context: Record<string, unknown>
): Promise<void> {
  try {
    // Lazy import to avoid issues in edge runtime
    const { createServiceClient } = await import("./supabase/server");
    const supabase = await createServiceClient();
    await supabase.from("system_errors").insert({ severity, message, context });
  } catch {
    // Never throw
  }
}

// ── Core tracker ─────────────────────────────────────────────────────────────
export async function trackError(
  err: unknown,
  options: TrackOptions = {}
): Promise<void> {
  const {
    context = "unknown",
    userId,
    extra = {},
    severity = "high",
  } = options;

  const message = err instanceof Error ? err.message : String(err);
  const fullMessage = `[${context}] ${message}`;

  // 1. Sentry
  Sentry.captureException(err, {
    level: severity === "critical" ? "fatal" : severity === "high" ? "error" : "warning",
    extra: { context, userId, ...extra },
  });

  // 2. Database log
  await logToDatabase(fullMessage, severity, { context, userId, ...extra });
}

// ── Domain-specific helpers ───────────────────────────────────────────────────

/** Track a payment failure — always high severity */
export async function trackPaymentError(
  err: unknown,
  options: Omit<TrackOptions, "severity"> & { appointmentId?: string; amount?: number }
): Promise<void> {
  const { appointmentId, amount, ...rest } = options;
  await trackError(err, {
    ...rest,
    severity: "critical",
    context: `payment${options.context ? ` / ${options.context}` : ""}`,
    extra: { ...rest.extra, appointmentId, amount },
  });
}

/** Track an authentication error */
export async function trackAuthError(
  err: unknown,
  options: Omit<TrackOptions, "severity"> = {}
): Promise<void> {
  await trackError(err, {
    ...options,
    severity: "medium",
    context: `auth${options.context ? ` / ${options.context}` : ""}`,
  });
}

/** Track a non-critical API error (3rd-party timeouts, etc.) */
export async function trackApiError(
  err: unknown,
  options: Omit<TrackOptions, "severity"> = {}
): Promise<void> {
  await trackError(err, {
    ...options,
    severity: "medium",
    context: `api${options.context ? ` / ${options.context}` : ""}`,
  });
}

/** Wrap an API route handler — catches unhandled errors and reports them */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  context: string
): T {
  return (async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (err) {
      await trackError(err, { context, severity: "critical" });
      const { NextResponse } = await import("next/server");
      return NextResponse.json({ error: "Sunucu hatası oluştu" }, { status: 500 });
    }
  }) as T;
}
