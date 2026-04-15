"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, ArrowRight, CheckCircle, PawPrint } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Geçerli bir e-posta adresi girin");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setLoading(false);
    if (error) {
      const lower = error.message.toLowerCase();
      toast.error(
        lower.includes("after 45") || lower.includes("security purposes") || lower.includes("rate limit")
          ? "Çok fazla deneme yaptınız. Lütfen 45 saniye bekleyip tekrar deneyin."
          : "Gönderilemedi. Lütfen tekrar deneyin."
      );
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 whitespace-nowrap min-h-[44px]">
            <PawPrint size={28} color="#1A6B4A" />
            <span className="font-black text-2xl text-gray-900">Veterineri Bul</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="pb-4 text-center">
            <div className="w-14 h-14 bg-[#DCFCE7] rounded-full flex items-center justify-center mx-auto mb-3">
              <Mail className="w-7 h-7 text-[#166534]" />
            </div>
            <CardTitle className="text-xl">Şifremi Unuttum</CardTitle>
            <CardDescription>
              E-posta adresinize şifre sıfırlama bağlantısı göndereceğiz
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-green-800">Link gönderildi!</p>
                  <p className="text-xs text-green-700 mt-1">
                    <span className="font-medium">{email}</span> adresine şifre sıfırlama bağlantısı gönderdik.
                    Spam klasörünüzü de kontrol edin.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-[#166534] transition-colors w-full text-center"
                  onClick={() => setSent(false)}
                >
                  Farklı bir e-posta dene
                </button>
                <Link
                  href="/auth/login"
                  className="block text-center text-sm text-gray-500 hover:text-[#166534] transition-colors"
                >
                  ← Giriş sayfasına dön
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-posta Adresi</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ornek@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    className="min-h-[44px]"
                  />
                </div>
                <Button type="submit" className="w-full" loading={loading}>
                  Sıfırlama Linki Gönder
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                <Link
                  href="/auth/login"
                  className="block text-center text-sm text-gray-500 hover:text-[#166534] transition-colors"
                >
                  ← Giriş sayfasına dön
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
