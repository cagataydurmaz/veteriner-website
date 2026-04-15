"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Eye, EyeOff, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import PasswordStrength from "@/components/ui/PasswordStrength";

// ── Link states ───────────────────────────────────────────────────────────────
type LinkState = "loading" | "valid" | "expired" | "used" | "invalid";

function ResetPasswordContent() {
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [show, setShow]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [linkState, setLinkState]   = useState<LinkState>("loading");
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Callback route already exchanged the code and established the session.
    // We just need to confirm the session is in PASSWORD_RECOVERY state.
    const supabase = createClient();
    let settled = false;

    // 1. Check if there's already an active recovery session (callback redirected here)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return;
      if (session) {
        // Session established by callback — valid recovery session
        settled = true;
        setLinkState("valid");
      }
    });

    // 2. Also listen for PASSWORD_RECOVERY event (handles edge cases)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        settled = true;
        setLinkState("valid");
      }
    });

    // 3. Error params from callback (expired/used/invalid links)
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error_code") ?? params.get("error");
    if (errorCode) {
      const desc = (params.get("error_description") ?? "").toLowerCase();
      settled = true;
      setLinkState(
        errorCode === "otp_expired" || desc.includes("expired") ? "expired" :
        desc.includes("used") || errorCode === "access_denied"  ? "used"    : "invalid"
      );
      return;
    }

    // 4. Timeout: if no session after 6s, link was not exchanged → expired
    const timeout = setTimeout(() => {
      if (!settled) setLinkState("expired");
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // ── Resend reset email ──────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!resendEmail.includes("@")) {
      toast.error("Geçerli bir e-posta adresi girin");
      return;
    }
    setResendLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setResendLoading(false);
    if (error) {
      const lower = error.message.toLowerCase();
      toast.error(
        lower.includes("after 45") || lower.includes("security purposes") || lower.includes("rate limit")
          ? "Çok fazla deneme yaptınız. Lütfen 45 saniye bekleyip tekrar deneyin."
          : "Gönderilemedi. Lütfen tekrar deneyin."
      );
    } else {
      setResendSent(true);
    }
  };

  // ── Password update ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Şifre en az 8 karakter olmalı"); return; }
    if (password !== confirm) { toast.error("Şifreler eşleşmiyor"); return; }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("Şifre güncellenemedi. Lütfen tekrar deneyin.");
    } else {
      toast.success("Şifren güncellendi! Giriş yapabilirsin.");
      router.push("/auth/login");
    }
    setLoading(false);
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (linkState === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Lock className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-gray-600 text-sm">Bağlantı doğrulanıyor...</p>
            <p className="text-gray-400 text-xs mt-2">
              Eğer bu sayfa yüklenmiyorsa, e-postadaki linke tekrar tıklayın.
            </p>
            <Link href="/auth/login" className="text-[#166534] text-xs hover:underline mt-4 block">
              Giriş sayfasına dön
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Expired or Used link (#7) ───────────────────────────────────────────────
  if (linkState === "expired" || linkState === "used" || linkState === "invalid") {
    const isUsed = linkState === "used";
    const headline = isUsed
      ? "Bu link daha önce kullanıldı."
      : "Şifre sıfırlama linkinizin süresi doldu.";
    const sub = isUsed
      ? "Her link yalnızca bir kez kullanılabilir. Yeni bir şifre sıfırlama talebinde bulunun."
      : "Bağlantılar 60 dakika geçerlidir. Lütfen yeni bir link isteyin.";

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="pb-4 text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-7 h-7 text-amber-600" />
              </div>
              <CardTitle className="text-xl">{headline}</CardTitle>
              <CardDescription>{sub}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {resendSent ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                  <p className="text-sm font-semibold text-green-800">Yeni link gönderildi!</p>
                  <p className="text-xs text-green-700 mt-1">
                    E-posta kutunuzu kontrol edin. Spam klasörünü de göz atın.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="resend-email">E-posta Adresiniz</Label>
                    <Input
                      id="resend-email"
                      type="email"
                      placeholder="ornek@email.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full gap-2"
                    loading={resendLoading}
                    onClick={handleResend}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Yeni Link Gönder
                  </Button>
                </>
              )}
              <Link
                href="/auth/login"
                className="block text-center text-sm text-gray-500 hover:text-[#166534] transition-colors"
              >
                ← Giriş sayfasına dön
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Valid link — show password form ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#DCFCE7] rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7 text-[#166534]" />
          </div>
        </div>
        <Card>
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl">Yeni Şifre Belirle</CardTitle>
            <CardDescription>Hesabın için yeni bir şifre gir</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Yeni Şifre</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    placeholder="En az 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Şifre Tekrar</Label>
                <Input
                  id="confirm"
                  type={show ? "text" : "password"}
                  placeholder="Şifreni tekrar gir"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-500">Şifreler eşleşmiyor</p>
                )}
              </div>
              <Button type="submit" className="w-full" loading={loading}>
                Şifremi Güncelle
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
