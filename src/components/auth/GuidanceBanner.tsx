"use client";

import Link from "next/link";
import { AlertCircle, ShieldCheck, UserPlus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth/errors";
import type { Guidance } from "@/lib/auth/types";

// Content config for each variant
const CONTENT: Record<
  Guidance["variant"],
  { message: string; button?: string; href?: string; icon: "warn" | "info" | "switch" }
> = {
  "not-found": {
    message: "Bu bilgiyle kayıtlı hesap bulunamadı.",
    button: "Hemen Kayıt Ol",
    icon: "warn",
  },
  "wrong-provider-google": {
    message: "Bu hesap Google ile oluşturuldu. Lütfen Google butonu ile giriş yapın.",
    icon: "info",
  },
  "wrong-provider-email": {
    message: "Bu hesap e-posta ve şifre ile oluşturuldu. Lütfen e-posta ile giriş yapın.",
    icon: "info",
  },
  "wrong-role-owner": {
    message: "Bu e-posta adresi pet sahibi hesabı olarak kayıtlı. Pet sahibi girişi için tıklayın →",
    button: "Pet Sahibi Girişine Git",
    href: "/auth/login",
    icon: "switch",
  },
  "wrong-role-vet": {
    message: "Bu e-posta adresi veteriner hesabı olarak kayıtlı. Veteriner girişi için tıklayın →",
    button: "Veteriner Girişine Git",
    href: "/auth/vet-login",
    icon: "switch",
  },
  "wrong-role-admin": {
    message: "Bu hesap yönetici hesabıdır.",
    button: "Yönetici Girişine Git",
    href: "/auth/admin-login",
    icon: "warn",
  },
  "wrong-password": {
    message: "Şifre hatalı. Şifremi unuttum bağlantısını kullanabilirsiniz.",
    icon: "warn",
  },
  "email-not-confirmed": {
    message: "E-posta adresiniz henüz doğrulanmamış. Kayıt sırasında gönderilen onay e-postasını kontrol edin veya yeni bir doğrulama e-postası isteyin.",
    button: "Yeniden Doğrulama E-postası Gönder",
    icon: "info",
  },
};

interface Props {
  guidance: Guidance;
  onForgotPassword?: () => void;
  onDismiss?: () => void;
  /** override href for "not-found" register link */
  registerHref?: string;
}

export function GuidanceBanner({ guidance, onForgotPassword, onDismiss, registerHref }: Props) {
  const content = CONTENT[guidance.variant];
  const isWarn   = content.icon === "warn";
  const isSwitch = content.icon === "switch";

  // For "not-found", prefer registerHref prop over static config
  const hrefToUse = guidance.variant === "not-found"
    ? (registerHref ?? content.href)
    : (content.href ?? guidance.href);

  const handleResendConfirmation = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email: guidance.value });
    if (error) {
      const translated = translateAuthError(error.message);
      toast.error(translated && translated !== "__EMAIL_NOT_CONFIRMED__"
        ? translated
        : "Gönderilemedi. Lütfen tekrar deneyin."
      );
    } else {
      toast.success("Doğrulama e-postası gönderildi! Gelen kutunuzu kontrol edin.");
      onDismiss?.();
    }
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 mt-1 ${
      isSwitch ? "bg-blue-50 border-blue-200"
      : isWarn  ? "bg-amber-50 border-amber-200"
      : "bg-sky-50 border-sky-200"
    }`}>
      <div className="flex items-start gap-2">
        <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
          isSwitch ? "text-blue-500" : isWarn ? "text-amber-500" : "text-sky-500"
        }`} />
        <p className={`text-sm font-medium leading-snug ${
          isSwitch ? "text-blue-800" : isWarn ? "text-amber-800" : "text-sky-800"
        }`}>
          {content.message}
        </p>
      </div>

      {/* Button with href (register / role switch) */}
      {content.button && hrefToUse && guidance.variant !== "email-not-confirmed" && (
        <Link href={hrefToUse}>
          <Button type="button" size="sm" className="w-full bg-[#166534] hover:bg-[#14532D] text-white gap-2">
            {guidance.variant === "wrong-role-admin"
              ? <ShieldCheck className="w-4 h-4" />
              : <UserPlus className="w-4 h-4" />}
            {content.button}
          </Button>
        </Link>
      )}

      {/* Forgot password link */}
      {guidance.variant === "wrong-password" && onForgotPassword && (
        <button
          type="button"
          className="text-xs text-amber-700 underline w-full text-left"
          onClick={onForgotPassword}
        >
          Şifremi unuttum →
        </button>
      )}

      {/* Resend confirmation email */}
      {guidance.variant === "email-not-confirmed" && (
        <button
          type="button"
          className="w-full text-sm font-medium text-white bg-[#166534] hover:bg-[#14532D] rounded-lg px-4 py-2 transition-colors flex items-center justify-center gap-2"
          onClick={handleResendConfirmation}
        >
          <Mail className="w-4 h-4" />
          {content.button}
        </button>
      )}
    </div>
  );
}
