"use client";

export const dynamic = 'force-dynamic';

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, PawPrint, Eye, EyeOff, Stethoscope } from "lucide-react";
import { translateAuthError } from "@/lib/auth/errors";

async function signInWithGoogle() {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TURKISH_CITIES } from "@/lib/constants";
import PasswordStrength from "@/components/ui/PasswordStrength";

const baseSchema = z.object({
  full_name:        z.string().min(2, "Ad soyad en az 2 karakter olmalıdır"),
  city:             z.string().min(1, "Şehir seçiniz"),
  kvkk_consent:     z.boolean().refine((v) => v, "KVKK metnini onaylamanız gerekir"),
  email:            z.string().optional(),
  password:         z.string().optional(),
  confirm_password: z.string().optional(),
}).superRefine((data, ctx) => {
  // Only validate password fields when not in isComplete mode (email is present)
  if (data.email) {
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Geçerli bir e-posta adresi girin", path: ["email"] });
    }
    if (!data.password || data.password.length < 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Şifre en az 8 karakter olmalıdır", path: ["password"] });
    }
    if (data.password && !/[A-Z]/.test(data.password)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Şifre en az bir büyük harf içermelidir", path: ["password"] });
    }
    if (data.password && !/[0-9]/.test(data.password)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Şifre en az bir rakam içermelidir", path: ["password"] });
    }
    if (data.password !== data.confirm_password) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Şifreler eşleşmiyor", path: ["confirm_password"] });
    }
  }
});

type RegisterForm = z.infer<typeof baseSchema>;

function RegisterContent() {
  const [loading, setLoading]         = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const router       = useRouter();
  const searchParams = useSearchParams();
  const isComplete   = searchParams.get("complete") === "true";

  const prefillEmail = searchParams.get("email") ?? "";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(baseSchema),
    mode: "onBlur",
    defaultValues: { email: prefillEmail },
  });

  const passwordValue = watch("password") ?? "";

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    const supabase = createClient();
    try {
      // ── Complete profile after Google/OTP sign-in ─────────────────────────
      if (isComplete) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Oturum bulunamadı");

        const { error } = await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          role: "owner",
          full_name: data.full_name,
          city: data.city,
          // Persist KVKK consent timestamp (Law No. 6698)
          is_kvkk_approved: data.kvkk_consent === true,
          kvkk_approved_at: data.kvkk_consent === true ? new Date().toISOString() : null,
        }, { onConflict: "id" });

        if (error) throw error;
        toast.success("Kayıt tamamlandı! Hoş geldiniz.");
        router.push("/owner/dashboard");
        return;
      }

      // ── Email + password sign-up ──────────────────────────────────────────
      if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        toast.error("Geçerli bir e-posta adresi girin");
        setLoading(false);
        return;
      }

      // Pre-flight: check if email already exists
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      const checkData = await checkRes.json();
      if (checkData.exists) {
        toast.error(
          checkData.role === "vet"
            ? "Bu e-posta adresi zaten veteriner hesabı olarak kayıtlı. Lütfen giriş yapın veya farklı bir e-posta kullanın."
            : "Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın.",
          { duration: 5000 }
        );
        setLoading(false);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password!,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: data.full_name, city: data.city },
        },
      });

      if (signUpError) throw signUpError;

      if (signUpData.session) {
        // Auto-confirm is on: create profile immediately
        const { error: upsertError } = await supabase.from("users").upsert({
          id: signUpData.user!.id,
          email: signUpData.user!.email,
          role: "owner",
          full_name: data.full_name,
          city: data.city,
          // Persist KVKK consent timestamp (Law No. 6698)
          is_kvkk_approved: data.kvkk_consent === true,
          kvkk_approved_at: data.kvkk_consent === true ? new Date().toISOString() : null,
        }, { onConflict: "id" });
        if (upsertError) throw upsertError;
        toast.success("Kayıt başarılı! Hoş geldiniz.");
        router.push("/owner/dashboard");
      } else {
        // Email confirmation required
        toast.success(
          "Kayıt başarılı! E-posta adresinize doğrulama linki gönderdik.",
          { duration: 8000, description: "E-postanızı doğruladıktan sonra giriş yapabilirsiniz." }
        );
        router.push("/auth/login?reason=registered");
      }
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : "Hata oluştu";
      const lower = raw.toLowerCase();
      const translated = translateAuthError(raw);
      const msg = translated
        ? translated
        : lower.includes("already registered") || lower.includes("user already exists")
        ? "Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın."
        : raw;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
            <CardTitle className="text-xl text-center">
              {isComplete ? "Kaydı Tamamla" : "Hesap Oluştur"}
            </CardTitle>
            <CardDescription className="text-center">
              <span className="font-bold text-[#166534]">Pet Sahibi</span> olarak kayıt olun
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isComplete && (
              <>
                <button
                  onClick={signInWithGoogle}
                  className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl py-2.5 px-4 mb-4 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google ile Kayıt Ol
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">veya e-posta ile</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Ad Soyad</Label>
                <Input id="full_name" placeholder="Ahmet Yılmaz" {...register("full_name")} />
                {errors.full_name && <p className="text-xs text-red-500">{errors.full_name.message}</p>}
              </div>

              {!isComplete && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-posta Adresi</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ornek@email.com"
                      {...register("email")}
                    />
                    {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Şifre <span className="text-gray-400 font-normal text-xs">(en az 8 karakter)</span></Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        className="pr-10"
                        {...register("password")}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPass(v => !v)}
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={passwordValue} />
                    {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_password">Şifre Tekrar</Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                        type={showConfirm ? "text" : "password"}
                        placeholder="••••••••"
                        className="pr-10"
                        {...register("confirm_password")}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowConfirm(v => !v)}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirm_password && <p className="text-xs text-red-500">{errors.confirm_password.message}</p>}
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="city">Şehir</Label>
                <select
                  id="city"
                  className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]"
                  {...register("city")}
                >
                  <option value="">Şehir seçin</option>
                  {TURKISH_CITIES.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="kvkk"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#166534] focus:ring-[#166534]"
                  {...register("kvkk_consent")}
                />
                <label htmlFor="kvkk" className="text-xs text-gray-600">
                  <Link href="/kvkk" className="text-[#166534] hover:underline">KVKK Aydınlatma Metni</Link>
                  &apos;ni okudum ve{" "}
                  <Link href="/kullanim-kosullari" className="text-[#166534] hover:underline">Kullanım Koşulları</Link>
                  &apos;nı kabul ediyorum.
                </label>
              </div>
              {errors.kvkk_consent && <p className="text-xs text-red-500">{errors.kvkk_consent.message}</p>}

              <Button type="submit" className="w-full" loading={loading}>
                {isComplete ? "Kaydı Tamamla" : "Kayıt Ol"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <p className="text-sm text-center text-gray-500">
                Zaten hesabınız var mı?{" "}
                <Link href="/auth/login" className="text-[#166534] font-medium hover:underline">Giriş Yap</Link>
              </p>
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs text-center text-gray-500"><span className="font-bold text-gray-700">Veteriner Hekim</span> misiniz?</p>
                <Link href="/auth/vet-register">
                  <Button type="button" variant="outline" className="w-full border-[#166534] text-[#166534] hover:bg-[#F0FDF4]">
                    <Stethoscope className="w-4 h-4 mr-2" />
                    Veteriner Olarak Kayıt Ol →
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
