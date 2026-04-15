import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Clock, CheckCircle, FileText, Phone, Mail } from "lucide-react";

export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/vet-login");

  const { data: vet } = await supabase
    .from("veterinarians")
    .select("is_verified, created_at, specialty, city, rejection_reason")
    .eq("user_id", user.id)
    .maybeSingle();

  // If already verified, go to dashboard
  if (vet?.is_verified) redirect("/vet/dashboard");

  const appliedAt = vet?.created_at
    ? new Date(vet.created_at).toLocaleDateString("tr-TR", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const steps = [
    { label: "Başvuru Alındı", done: true, icon: "📋" },
    { label: "Belgeler İnceleniyor", done: true, icon: "🔍" },
    { label: "Admin Onayı Bekleniyor", done: false, icon: "✅" },
    { label: "Hesabınız Aktif", done: false, icon: "🎉" },
  ];

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header card */}
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden mb-6">
          <div className="bg-amber-50 px-6 py-5 border-b border-amber-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Hesabınız İnceleniyor</h1>
              <p className="text-sm text-amber-700">
                Başvurunuz değerlendirme sürecinde
              </p>
            </div>
          </div>

          <div className="px-6 py-5">
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Veteriner hekim başvurunuz alındı. Ekibimiz belgelerinizi ve bilgilerinizi
              incelemektedir. Bu süreç genellikle <strong>1–3 iş günü</strong> sürmektedir.
              Onay sonrasında e-posta ve WhatsApp ile bilgilendirileceksiniz.
            </p>

            {appliedAt && (
              <p className="text-xs text-gray-400">
                Başvuru tarihi: {appliedAt}
              </p>
            )}
          </div>
        </div>

        {/* Progress steps */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Başvuru Durumu</h2>
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                  step.done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                }`}>
                  {step.done ? <CheckCircle className="w-4 h-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                </div>
                <span className={`text-sm ${step.done ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                  {step.label}
                </span>
                {idx === 2 && !step.done && (
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Bekliyor
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Rejection reason if rejected */}
        {vet?.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-5 mb-6">
            <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
              <span>⚠️</span> Başvurunuz Reddedildi
            </h3>
            <p className="text-sm text-red-700 leading-relaxed">{vet.rejection_reason}</p>
            <Link
              href="/vet/profile"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-red-800 hover:underline"
            >
              <FileText className="w-4 h-4" />
              Bilgilerimi Güncelle ve Tekrar Başvur
            </Link>
          </div>
        )}

        {/* Info & actions */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Bu sürede yapabilecekleriniz</h2>
          <Link
            href="/vet/profile"
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
          >
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Profilinizi Tamamlayın</p>
              <p className="text-xs text-gray-500">Biyografi, fotoğraf, ücret bilgilerini girin</p>
            </div>
          </Link>
          <a
            href="mailto:destek@veterineribul.com"
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Destek Alın</p>
              <p className="text-xs text-gray-500">destek@veterineribul.com</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
