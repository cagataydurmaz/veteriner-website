"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ShieldCheck, ArrowRight, AlertCircle, Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkRateLimit, recordRateLimit } from "@/lib/auth/api";
import { translateAuthError } from "@/lib/auth/errors";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useCountdown } from "@/hooks/useCountdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

async function signInWithGoogleForAdmin() {
  const { createClient: createC } = await import("@/lib/supabase/client");
  const supabase = createC();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

const schema = z.object({
  email:    z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(6, "Şifre gereklidir"),
});
type Form = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [rateLocked, setRateLocked]     = useState(false);
  const [rateLockedUntil, setRateLockedUntil] = useState<string | null>(null);

  const { remaining, label: rateLockLabel } = useCountdown(rateLockedUntil);

  // Auto-unlock when countdown reaches zero
  useEffect(() => {
    if (rateLocked && remaining === 0) {
      setRateLocked(false);
      setRateLockedUntil(null);
    }
  }, [rateLocked, remaining]);

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: Form) => {
    if (rateLocked) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Server-side rate limit check (same system as owner/vet login)
      const rl = await checkRateLimit(data.email);
      if (rl.locked) {
        setRateLocked(true);
        setRateLockedUntil(rl.lockedUntil);
        return;
      }

      // 2. Sign in
      const supabase = createClient();
      const { error: authError, data: authData } = await supabase.auth.signInWithPassword({
        email:    data.email,
        password: data.password,
      });

      if (authError) {
        const translated = translateAuthError(authError.message);
        if (translated && translated !== "__EMAIL_NOT_CONFIRMED__") {
          setError(translated);
          return;
        }
        // Record failed attempt and check if now locked
        const rlResult = await recordRateLimit(data.email);
        if (rlResult.locked) {
          setRateLocked(true);
          setRateLockedUntil(rlResult.lockedUntil);
        } else {
          const count = (rlResult as { attemptCount?: number }).attemptCount;
          const left  = count ? Math.max(0, 5 - (count % 5)) : null;
          setError(left
            ? `E-posta veya şifre hatalı. (${left} deneme hakkı kaldı)`
            : "E-posta veya şifre hatalı."
          );
        }
        return;
      }

      if (!authData?.user) {
        setError("Giriş yapılamadı. Lütfen tekrar deneyin.");
        return;
      }

      // 3. Verify admin role
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (userData?.role !== "admin") {
        await supabase.auth.signOut();
        setError(userData
          ? "Bu hesap yönetici hesabı değildir."
          : "Admin hesabı bulunamadı. Sistem yöneticinizle iletişime geçin."
        );
        return;
      }

      toast.success("Hoş geldiniz!");
      router.push("/admin/dashboard");
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1A6B4A] mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-black text-white">Yönetici Girişi</h1>
          <p className="text-sm text-gray-500 mt-1">Bu sayfa yalnızca yetkili yöneticiler içindir.</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Lockout banner */}
            {rateLocked && (
              <div className="flex items-start gap-2 rounded-xl bg-orange-950/60 border border-orange-800 p-3">
                <Lock className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-300">
                  Hesap geçici olarak kilitlendi. Kalan süre:{" "}
                  <span className="font-bold tabular-nums">{rateLockLabel}</span>
                </p>
              </div>
            )}

            {/* Error banner */}
            {error && !rateLocked && (
              <div className="flex items-start gap-2 rounded-xl bg-red-950/60 border border-red-800 p-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-gray-300">E-posta Adresi</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                placeholder="admin@veterinerbul.net"
                disabled={rateLocked}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 focus:border-[#1A6B4A] focus:ring-[#1A6B4A]/30 min-h-[44px] disabled:opacity-50"
                {...register("email", { onChange: () => setError(null) })}
              />
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-password" className="text-gray-300">Şifre</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-[#4ade80] hover:text-[#86efac] transition-colors"
                  tabIndex={-1}
                >
                  Şifremi Unuttum
                </Link>
              </div>
              <PasswordInput
                id="admin-password"
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={rateLocked}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 focus:border-[#1A6B4A] focus:ring-[#1A6B4A]/30 disabled:opacity-50"
                {...register("password", { onChange: () => setError(null) })}
              />
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || rateLocked}
              className="w-full bg-[#1A6B4A] hover:bg-[#145538] text-white font-semibold min-h-[44px] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Giriş Yap <ArrowRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-500">veya</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <button
            type="button"
            disabled={rateLocked}
            onClick={signInWithGoogleForAdmin}
            className="w-full flex items-center justify-center gap-3 border border-gray-700 rounded-xl py-2.5 px-4 hover:bg-gray-800 transition-colors text-sm font-medium text-gray-300 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google ile Giriş Yap
          </button>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          Bu URL gizlidir ve genel kullanıma açık değildir.
        </p>
      </div>
    </div>
  );
}
