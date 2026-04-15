"use client";

export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PawPrint, Stethoscope, ArrowRight, Clock, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GuidanceBanner } from "@/components/auth/GuidanceBanner";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useSignIn } from "@/hooks/useSignIn";

async function signInWithGoogleForVet() {
  const { createClient: createC } = await import("@/lib/supabase/client");
  const supabase = createC();
  document.cookie = "oauth_role=vet;path=/;max-age=300;SameSite=Lax";
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

// ── Password schema ───────────────────────────────────────────────────────────
const passwordSchema = z.object({
  email:    z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
});
type PasswordForm = z.infer<typeof passwordSchema>;

// ── Main component ────────────────────────────────────────────────────────────
function VetLoginContent() {
  const {
    loading,
    guidance,
    rateLocked,
    rateLockLabel,
    highlightGoogle,
    forgotMode,
    forgotEmail,
    forgotLoading,
    signIn,
    clearGuidance,
    openForgotMode,
    setForgotMode,
    setForgotEmail,
    sendForgotPassword,
  } = useSignIn({
    expectedRole: "vet",
    successPath: "/vet/dashboard",
    returnPathPrefix: "/vet/",
    wrongRoleVariant: "wrong-role-vet",
    registerHref: "/auth/vet-register",
  });

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleVetLogin = async (data: PasswordForm) => {
    await signIn(data.email, data.password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 whitespace-nowrap min-h-[44px]">
            <PawPrint size={28} color="#1A6B4A" />
            <div className="flex items-center gap-1.5">
              <span className="font-black text-2xl text-gray-900">Veterineri Bul</span>
            </div>
          </Link>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-xl text-center"><span className="font-black text-blue-700">Veteriner Hekim</span> Girişi</CardTitle>
            <CardDescription className="text-center">Veteriner hesabınıza erişmek için giriş yapın</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Brute-force lockout banner */}
            {rateLocked && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Çok fazla başarısız giriş denemesi.</p>
                  <p className="text-sm text-red-700 mt-1">
                    Hesabınız <span className="font-mono font-bold">{rateLockLabel}</span> sonra açılacak.
                  </p>
                </div>
              </div>
            )}

            {!forgotMode ? (
              <form onSubmit={handleSubmit(handleVetLogin)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="vet-email">E-posta Adresi</Label>
                  <Input
                    id="vet-email"
                    type="email"
                    inputMode="email"
                    placeholder="veteriner@email.com"
                    className="min-h-[44px]"
                    {...register("email", { onChange: clearGuidance })}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vet-password">Şifre</Label>
                  <PasswordInput
                    id="vet-password"
                    placeholder="••••••••"
                    {...register("password", { onChange: clearGuidance })}
                  />
                  {errors.password && (
                    <p className="text-xs text-red-500">{errors.password.message}</p>
                  )}
                  <div className="text-right">
                    <button
                      type="button"
                      className="text-xs text-gray-400 hover:text-[#166534] transition-colors"
                      onClick={() => openForgotMode(getValues("email") || "")}
                    >
                      Şifremi unuttum
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" loading={loading} disabled={rateLocked}>
                  Giriş Yap <ArrowRight className="w-4 h-4 ml-1" />
                </Button>

                {/* Guidance banner */}
                {guidance && (
                  <GuidanceBanner
                    guidance={guidance}
                    onForgotPassword={() => openForgotMode(getValues("email") || guidance.value)}
                    onDismiss={clearGuidance}
                    registerHref="/auth/vet-register"
                  />
                )}

                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">veya</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <button
                  type="button"
                  onClick={() => signInWithGoogleForVet()}
                  className={`w-full flex items-center justify-center gap-3 border rounded-xl py-2.5 px-4 transition-all text-sm font-medium text-gray-700 ${
                    highlightGoogle
                      ? "border-[#166534] bg-[#F0FDF4] ring-2 ring-[#166534]/30 scale-[1.01]"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {highlightGoogle ? "👆 Google ile Giriş Yap" : "Google ile Giriş Yap"}
                </button>

                {/* Bottom links */}
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <p className="text-sm text-center text-gray-500">Veteriner hesabınız yok mu?</p>
                  <Link href="/auth/vet-register">
                    <Button type="button" className="w-full bg-[#166534] hover:bg-[#14532D] text-white">
                      Veteriner Olarak Kayıt Ol <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </form>
            ) : (
              /* Forgot password section */
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <button type="button" className="text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setForgotMode(false)}>
                    ← Geri
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Şifremi Unuttum</span>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
                  E-posta adresinize şifre sıfırlama bağlantısı göndereceğiz.
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">E-posta Adresi</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="veteriner@email.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <Button type="button" className="w-full" loading={forgotLoading}
                  onClick={() => sendForgotPassword(forgotEmail)}>
                  Link Gönder <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VetLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#1A6B4A]" /></div>}>
      <VetLoginContent />
    </Suspense>
  );
}
