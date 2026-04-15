"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Mail, AlertCircle, Clock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// ── OTP attempt API helpers ───────────────────────────────────────────────────
async function checkOtpAttempts(identifier: string) {
  const res = await fetch("/api/auth/otp-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, action: "check" }),
  });
  return res.json() as Promise<{
    allowed: boolean;
    locked: boolean;
    attemptsLeft: number;
    lockedUntil: string | null;
    showWarning: boolean;
  }>;
}

async function recordOtpAttempt(identifier: string) {
  const res = await fetch("/api/auth/otp-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, action: "record" }),
  });
  return res.json() as Promise<{
    allowed: boolean;
    locked: boolean;
    attemptsLeft: number;
    lockedUntil: string | null;
    showWarning: boolean;
  }>;
}

async function clearOtpAttempts(identifier: string) {
  await fetch("/api/auth/otp-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, action: "clear" }),
  });
}

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!targetIso) { setRemaining(0); return; }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetIso]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return { remaining, label: `${mins} dakika ${String(secs).padStart(2, "0")} saniye` };
}

function OTPContent() {
  const [otp, setOtp]           = useState(["", "", "", "", "", ""]);
  const [loading, setLoading]   = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [resendLoading, setResendLoading] = useState(false);

  // Attempt-limit state
  const [locked, setLocked]           = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [showWarning, setShowWarning]  = useState(false);

  // Expired-OTP state
  const [otpExpired, setOtpExpired] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router    = useRouter();
  const searchParams = useSearchParams();
  const emailRaw  = searchParams.get("email") || "";
  const email     = emailRaw.trim().toLowerCase().includes("@") ? emailRaw.trim().toLowerCase() : "";

  const { remaining: lockRemaining, label: lockLabel } = useCountdown(lockedUntil);

  // ── Resend countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setResendTimer((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Check lockout on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!email) return;
    checkOtpAttempts(email).then((res) => {
      if (res.locked) {
        setLocked(true);
        setLockedUntil(res.lockedUntil);
        setAttemptsLeft(0);
      } else {
        setAttemptsLeft(res.attemptsLeft);
        setShowWarning(res.showWarning);
      }
    }).catch(() => {});
  }, [email]);

  // When lock expires, unlock automatically
  useEffect(() => {
    if (locked && lockRemaining === 0) {
      setLocked(false);
      setLockedUntil(null);
      setAttemptsLeft(5);
      setShowWarning(false);
    }
  }, [locked, lockRemaining]);

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  const verifyOTP = useCallback(async (code: string) => {
    if (locked) return;
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (error) {
        const errMsg = error.message ?? "";
        const errLower = errMsg.toLowerCase();
        const translated = translateAuthError(errMsg);

        // Expired OTP — show banner and let user request a new code
        const isExpired =
          errLower.includes("expired") ||
          errLower.includes("token has expired") ||
          errLower.includes("otp expired");

        if (isExpired) {
          setOtpExpired(true);
          setOtp(["", "", "", "", "", ""]);
          setTimeout(() => inputRefs.current[0]?.focus(), 50);
          return;
        }

        // Rate-limit error from Supabase — use translateAuthError message
        const isRateLimit =
          errLower.includes("after 45") ||
          errLower.includes("security purposes") ||
          errLower.includes("rate limit") ||
          errLower.includes("too many requests");
        if (isRateLimit) {
          toast.error(translated ?? "Çok fazla deneme yapıldı. Lütfen bekleyin.");
          setOtp(["", "", "", "", "", ""]);
          return;
        }

        // Wrong code — record attempt
        const result = await recordOtpAttempt(email);
        setAttemptsLeft(result.attemptsLeft);
        setShowWarning(result.showWarning);

        if (result.locked) {
          setLocked(true);
          setLockedUntil(result.lockedUntil);
          setOtp(["", "", "", "", "", ""]);
          return;
        }

        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);

        if (result.showWarning) {
          toast.error(
            result.attemptsLeft === 1
              ? "Hatalı kod. Son 1 hakkınız kaldı!"
              : `Hatalı kod. ${result.attemptsLeft} hakkınız kaldı.`,
            { duration: 4000 }
          );
        } else {
          toast.error("Hatalı doğrulama kodu.");
        }
        return;
      }

      // ── Success ─────────────────────────────────────────────────────────────
      await clearOtpAttempts(email);

      if (data.user) {
        const { data: userData } = await supabase
          .from("users")
          .select("id, role")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!userData) {
          router.push("/auth/register?complete=true");
        } else if (userData.role === "admin") {
          router.push("/admin/dashboard");
        } else if (userData.role === "vet") {
          router.push("/vet/dashboard");
        } else {
          router.push("/owner/dashboard");
        }
        router.refresh();
      }
    } catch {
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, [locked, email, router]);

  // ── Input handlers ──────────────────────────────────────────────────────────
  const handleChange = (idx: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[idx] = value.slice(-1);
    setOtp(newOtp);
    if (value && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (newOtp.every((d) => d !== "") && newOtp.join("").length === 6) {
      verifyOTP(newOtp.join(""));
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split("");
      setOtp(digits);
      verifyOTP(pasted);
    }
  };

  // ── Resend ──────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendTimer > 0 || resendLoading) return;
    setResendLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;

      // Clear attempt counter on resend
      await clearOtpAttempts(email);
      setLocked(false);
      setLockedUntil(null);
      setAttemptsLeft(5);
      setShowWarning(false);
      setOtpExpired(false);
      setOtp(["", "", "", "", "", ""]);
      setResendTimer(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      toast.success("Yeni kod gönderildi");
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "";
      const translated = translateAuthError(rawMsg);
      toast.error(translated ?? "Kod gönderilemedi. Lütfen tekrar deneyin.");
    } finally {
      setResendLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#DCFCE7] rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-[#166534]" />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl">E-posta Kodunu Girin</CardTitle>
            <CardDescription>
              <span className="font-medium text-gray-700">{email}</span> adresine 6 haneli doğrulama kodu gönderdik.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* ── Lockout banner ─────────────────────────────────────────── */}
            {locked && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Çok fazla hatalı deneme.
                    </p>
                    <p className="text-sm text-red-700 mt-0.5">
                      Hesabınız{" "}
                      <span className="font-mono font-bold">{lockLabel}</span>{" "}
                      sonra açılacak.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Expired OTP banner ─────────────────────────────────────── */}
            {!locked && otpExpired && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-amber-800">
                    Kodunuzun süresi doldu. Lütfen yeni bir kod isteyin.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full bg-[#166534] hover:bg-[#14532D] text-white gap-2"
                  loading={resendLoading}
                  onClick={handleResend}
                  disabled={resendTimer > 0}
                >
                  <RefreshCw className="w-4 h-4" />
                  {resendTimer > 0 ? `Yeni Kod Gönder (${resendTimer}s)` : "Yeni Kod Gönder"}
                </Button>
              </div>
            )}

            {/* ── Warning: attempts left ─────────────────────────────────── */}
            {!locked && !otpExpired && showWarning && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
                <p className="text-sm text-orange-800">
                  {attemptsLeft === 1
                    ? "Son 1 deneme hakkınız kaldı!"
                    : `${attemptsLeft} deneme hakkınız kaldı.`}
                </p>
              </div>
            )}

            {/* ── OTP input grid ─────────────────────────────────────────── */}
            <div
              className={`flex gap-2 justify-center ${locked || otpExpired ? "opacity-40 pointer-events-none" : ""}`}
              onPaste={handlePaste}
            >
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-12 h-12 text-center text-xl font-bold border-2 rounded-lg focus:border-[#166534] focus:outline-none transition-colors disabled:opacity-40"
                  disabled={loading || locked}
                />
              ))}
            </div>

            {/* ── Verify button ──────────────────────────────────────────── */}
            {!otpExpired && (
              <Button
                onClick={() => verifyOTP(otp.join(""))}
                className="w-full"
                loading={loading}
                disabled={otp.some((d) => !d) || locked}
              >
                Doğrula
              </Button>
            )}

            {/* ── Resend section ─────────────────────────────────────────── */}
            {!otpExpired && (
              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-sm text-gray-500">
                    Kodu tekrar gönder ({resendTimer}s)
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="text-sm text-[#166534] font-medium hover:underline disabled:opacity-50"
                  >
                    {resendLoading ? "Gönderiliyor..." : "Kodu Tekrar Gönder"}
                  </button>
                )}
              </div>
            )}

            {/* ── Back link ──────────────────────────────────────────────── */}
            <div className="text-center">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Geri Dön
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OTPPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>}>
      <OTPContent />
    </Suspense>
  );
}
