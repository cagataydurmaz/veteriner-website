"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { checkIdentity, checkRateLimit, recordRateLimit } from "@/lib/auth/api";
import { translateAuthError } from "@/lib/auth/errors";
import { useCountdown } from "./useCountdown";
import { consumeReturnPath } from "./useInactivityLogout";
import type { Guidance, GuidanceVariant } from "@/lib/auth/types";

export interface SignInConfig {
  /** The role this login page expects ("owner" | "vet") */
  expectedRole: "owner" | "vet";
  /** Where to redirect on success */
  successPath: string;
  /** Prefix to validate returnPath against (e.g. "/vet/") */
  returnPathPrefix: string;
  /** Guidance variant when logged-in user has wrong role (e.g. owner tries vet login) */
  wrongRoleVariant: GuidanceVariant;
  /** Register URL for "not found" guidance */
  registerHref: string;
}

export function useSignIn(config: SignInConfig) {
  const router = useRouter();
  const [loading, setLoading]                   = useState(false);
  const [guidance, setGuidance]                 = useState<Guidance | null>(null);
  const [rateLocked, setRateLocked]             = useState(false);
  const [rateLockedUntil, setRateLockedUntil]   = useState<string | null>(null);
  const [highlightGoogle, setHighlightGoogle]   = useState(false);
  const [forgotMode, setForgotMode]             = useState(false);
  const [forgotEmail, setForgotEmail]           = useState("");
  const [forgotLoading, setForgotLoading]       = useState(false);

  const { remaining: rateLockRemaining, label: rateLockLabel } = useCountdown(rateLockedUntil);

  useEffect(() => {
    if (rateLocked && rateLockRemaining === 0) {
      setRateLocked(false);
      setRateLockedUntil(null);
    }
  }, [rateLocked, rateLockRemaining]);

  const clearGuidance = () => {
    setGuidance(null);
    setHighlightGoogle(false);
  };

  const openForgotMode = (email: string) => {
    setForgotEmail(email);
    clearGuidance();
    setForgotMode(true);
  };

  const signIn = async (email: string, password: string) => {
    if (rateLocked) return;
    setLoading(true);
    clearGuidance();

    try {
      // 1. Rate limit check
      const rl = await checkRateLimit(email);
      if (rl.locked) {
        setRateLocked(true);
        setRateLockedUntil(rl.lockedUntil);
        return;
      }

      // 2. Pre-flight identity check
      const check = await checkIdentity({ email });

      if (check.exists) {
        if (check.role === "owner" && config.expectedRole === "vet") {
          setGuidance({ variant: "wrong-role-owner", value: email, href: "/auth/login" });
          return;
        }
        if (check.role === "vet" && config.expectedRole === "owner") {
          setGuidance({ variant: "wrong-role-vet", value: email, href: "/auth/vet-login" });
          return;
        }
        if (check.role === "admin") {
          setGuidance({ variant: "wrong-role-admin", value: email, href: "/auth/admin-login" });
          return;
        }
        if (check.provider === "google") {
          setGuidance({ variant: "wrong-provider-google", value: email });
          setHighlightGoogle(true);
          return;
        }
      }

      // 3. Sign in
      const supabase = createClient();
      const { error, data: authData } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const translated = translateAuthError(error.message);
        if (translated === "__EMAIL_NOT_CONFIRMED__") {
          setGuidance({ variant: "email-not-confirmed", value: email });
          return;
        }
        if (translated) {
          toast.error(translated);
          return;
        }
        const rlResult = await recordRateLimit(email);
        if (rlResult.locked) {
          setRateLocked(true);
          setRateLockedUntil(rlResult.lockedUntil);
        } else if (!check.exists) {
          setGuidance({ variant: "not-found", value: email, href: config.registerHref });
        } else {
          setGuidance({ variant: "wrong-password", value: email });
        }
        return;
      }

      if (!authData?.user) {
        toast.error("Giriş yapılamadı. Lütfen tekrar deneyin.");
        return;
      }

      // 4. Role check from DB
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();
      const role = userData?.role;

      if (role !== config.expectedRole) {
        await supabase.auth.signOut();
        if (role === "owner") {
          setGuidance({ variant: "wrong-role-owner", value: email, href: "/auth/login" });
        } else if (role === "vet") {
          setGuidance({ variant: "wrong-role-vet", value: email, href: "/auth/vet-login" });
        } else if (role === "admin") {
          setGuidance({ variant: "wrong-role-admin", value: email, href: "/auth/admin-login" });
        } else {
          router.push("/auth/role-select");
        }
        return;
      }

      // 5. Vet-specific checks
      if (config.expectedRole === "vet") {
        const { data: vetData } = await supabase
          .from("veterinarians")
          .select("account_status, suspended_until, is_verified")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (vetData?.account_status === "banned") {
          await supabase.auth.signOut();
          router.push("/hesap-askiya-alindi?reason=banned");
          return;
        }
        if (
          vetData?.account_status === "suspended" &&
          vetData?.suspended_until &&
          new Date(vetData.suspended_until) > new Date()
        ) {
          await supabase.auth.signOut();
          router.push(`/hesap-askiya-alindi?reason=suspension&until=${encodeURIComponent(vetData.suspended_until)}`);
          return;
        }
        if (vetData?.is_verified === false) {
          router.push("/vet/pending-approval");
          return;
        }
      }

      // 6. Navigate to dashboard
      const returnPath = consumeReturnPath();
      router.push(
        returnPath?.startsWith(config.returnPathPrefix) ? returnPath : config.successPath
      );
    } catch {
      toast.error("Giriş yapılamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const sendForgotPassword = async (email: string) => {
    if (!email.includes("@")) { toast.error("Geçerli bir e-posta adresi girin"); return; }
    setForgotLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      const translated = translateAuthError(error.message);
      toast.error(translated ?? "Gönderilemedi. Lütfen tekrar deneyin.");
    } else {
      toast.success("Şifre sıfırlama linki gönderildi!");
      setForgotMode(false);
    }
  };

  return {
    // State
    loading,
    guidance,
    rateLocked,
    rateLockLabel,
    highlightGoogle,
    forgotMode,
    forgotEmail,
    forgotLoading,
    // Actions
    signIn,
    clearGuidance,
    openForgotMode,
    setForgotMode,
    setForgotEmail,
    sendForgotPassword,
  };
}
