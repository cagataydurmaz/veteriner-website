/**
 * Translate a raw Supabase auth error message to Turkish.
 *
 * Returns:
 *   - A Turkish string              → show as toast/message
 *   - "__EMAIL_NOT_CONFIRMED__"     → sentinel: show resend-confirmation banner
 *   - null                          → caller decides (wrong-password / not-found logic)
 *
 * Patterns are version-agnostic: we check multiple substrings so a Supabase
 * SDK upgrade that rewrites the English copy won't silently break detection.
 */
export function translateAuthError(message: string): string | null {
  const lower = (message ?? "").toLowerCase();

  // Supabase server-side rate limit (OTP / email cooldown)
  if (
    lower.includes("after 45") ||
    lower.includes("security purposes") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return "Çok fazla deneme yapıldı. Lütfen 45 saniye bekleyip tekrar deneyin.";
  }

  // Email not confirmed
  if (
    lower.includes("email not confirmed") ||
    lower.includes("not confirmed") ||
    lower.includes("email_not_confirmed")
  ) {
    return "__EMAIL_NOT_CONFIRMED__";
  }

  // Password / credentials errors — caller handles not-found vs wrong-password split
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials") ||
    lower.includes("wrong password") ||
    lower.includes("incorrect password")
  ) {
    return null;
  }

  // OTP / magic-link expired
  if (
    lower.includes("otp expired") ||
    lower.includes("token has expired") ||
    lower.includes("link has expired")
  ) {
    return "Doğrulama bağlantısının süresi doldu. Lütfen yeni bir link isteyin.";
  }

  // Network / server errors
  if (
    lower.includes("fetch failed") ||
    lower.includes("networkerror") ||
    lower.includes("timeout")
  ) {
    return "Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.";
  }

  return null; // unrecognised — caller falls back to generic message
}
