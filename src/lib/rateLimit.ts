import { createServiceClient } from "@/lib/supabase/server";

export type RateLimitAction = "appointment" | "symptom_check" | "message" | "ai_chat";

interface LimitConfig {
  max: number;
  windowMs: number;
  message: string;
}

const LIMITS: Record<RateLimitAction, LimitConfig> = {
  appointment: {
    max: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: "Saatte en fazla 10 randevu denemesi yapabilirsiniz. Lütfen daha sonra tekrar deneyin.",
  },
  symptom_check: {
    max: 5,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    message: "Günlük semptom kontrolü limitinize ulaştınız (günde 5). Yarın tekrar deneyin.",
  },
  message: {
    max: 50,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    message: "Günlük mesaj limitinize ulaştınız (günde 50). Yarın tekrar deneyin.",
  },
  ai_chat: {
    max: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: "Saatte en fazla 20 AI mesajı gönderebilirsiniz. Lütfen daha sonra tekrar deneyin.",
  },
};

export async function checkRateLimit(
  userId: string,
  action: RateLimitAction
): Promise<{ allowed: boolean; message?: string; remaining?: number }> {
  const supabase = await createServiceClient();
  const { max, windowMs, message } = LIMITS[action];
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const { count, error } = await supabase
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", windowStart);

  if (error) {
    // If rate limit check fails, allow the request (fail open)
    console.error("Rate limit check error:", error.message);
    return { allowed: true };
  }

  const currentCount = count ?? 0;

  if (currentCount >= max) {
    return { allowed: false, message, remaining: 0 };
  }

  // Record this attempt
  await supabase.from("rate_limits").insert({
    user_id: userId,
    action,
  });

  return { allowed: true, remaining: max - currentCount - 1 };
}
