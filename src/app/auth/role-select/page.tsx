"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PawPrint, Stethoscope, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ── Server-side role assignment (RLS has no INSERT policy for browser clients) ─
async function assignRole(role: "owner" | "vet") {
  const res = await fetch("/api/auth/set-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Sunucu hatası");
  }
  return res.json() as Promise<{ role: string; existing: boolean }>;
}

function RoleSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<"owner" | null>(null);
  const [checking, setChecking] = useState(true);

  const supabase = createClient();

  // Guard: if user already has a role, redirect to their dashboard
  useEffect(() => {
    let cancelled = false;

    async function checkExistingRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in at all — send to login
        router.replace("/auth/login");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (userData?.role === "admin") {
        router.replace("/admin/dashboard");
        return;
      }
      if (userData?.role === "vet") {
        router.replace("/vet/dashboard");
        return;
      }
      if (userData?.role === "owner") {
        router.replace("/owner/dashboard");
        return;
      }

      // No role yet — show the selector
      setChecking(false);
    }

    checkExistingRole();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRoleSelect = async (role: "owner") => {
    setLoading(role);
    try {
      const result = await assignRole(role);

      if (result.existing) {
        // Row already existed — redirect to the matching dashboard
        if (result.role === "vet")   { router.replace("/vet/dashboard");   return; }
        if (result.role === "admin") { router.replace("/admin/dashboard"); return; }
        router.replace("/owner/dashboard");
        return;
      }

      const returnPath = searchParams.get("returnTo") || "/owner/dashboard";
      router.replace(returnPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bir hata oluştu.";
      toast.error(msg);
      setLoading(null);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1A6B4A] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 bg-[#1A6B4A] rounded-xl flex items-center justify-center">
          <PawPrint className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-black text-[#1A6B4A]">Veterineri Bul</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-black text-gray-900 mb-1">Hesap türünüzü seçin</h1>
        <p className="text-sm text-gray-500 mb-8">
          Platformu nasıl kullanmak istediğinizi seçin. Bu seçim sonradan değiştirilemez.
        </p>

        <div className="space-y-4">
          {/* Pet Owner */}
          <div className="p-6 rounded-2xl border-2 border-gray-200 cursor-pointer hover:border-[#1A6B4A] transition-colors">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center shrink-0 text-2xl">
                🐾
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Pet Sahibiyim</p>
                <p className="text-sm text-gray-500">Evcil hayvanım için veteriner bulmak istiyorum</p>
              </div>
            </div>
            <Button
              className="w-full bg-[#166534] hover:bg-[#14532D] text-white"
              loading={loading === "owner"}
              disabled={loading !== null}
              onClick={() => handleRoleSelect("owner")}
            >
              Pet Sahibi Olarak Devam Et
            </Button>
          </div>

          {/* Veterinarian */}
          <div className="p-6 rounded-2xl border-2 border-gray-200 cursor-pointer hover:border-[#1A6B4A] transition-colors">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <Stethoscope className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Veteriner Hekimim</p>
                <p className="text-sm text-gray-500">Platformda veteriner olarak yer almak istiyorum</p>
              </div>
            </div>
            <Link href="/auth/vet-register">
              <Button
                type="button"
                variant="outline"
                className="w-full border-[#166534] text-[#166534] hover:bg-[#F0FDF4]"
                disabled={loading !== null}
              >
                Veteriner Olarak Kayıt Ol
              </Button>
            </Link>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Devam ederek{" "}
          <Link href="/kullanim-kosullari" className="text-[#1A6B4A] hover:underline">
            Kullanım Koşulları
          </Link>
          {"'nı "}
          ve{" "}
          <Link href="/kvkk" className="text-[#1A6B4A] hover:underline">
            Gizlilik Politikası
          </Link>
          {"'nı "}
          kabul etmiş olursunuz.
        </p>
      </div>
    </div>
  );
}

export default function RoleSelectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#1A6B4A] animate-spin" />
        </div>
      }
    >
      <RoleSelectContent />
    </Suspense>
  );
}
