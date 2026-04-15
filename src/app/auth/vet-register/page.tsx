"use client";

export const dynamic = 'force-dynamic';

import { useState, Suspense, useEffect } from "react";
import { useFormAutoSave } from "@/hooks/useFormAutoSave";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Upload, CheckCircle, AlertCircle, PawPrint, Eye, EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TURKISH_CITIES, VETERINARY_SPECIALTIES } from "@/lib/constants";
import { translateAuthError } from "@/lib/auth/errors";
import PasswordStrength from "@/components/ui/PasswordStrength";

async function signInWithGoogleForVet() {
  document.cookie = "oauth_role=vet;path=/;max-age=600;SameSite=Lax";
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

const emailPasswordSchema = z.object({
  full_name: z.string().min(2, "Ad soyad gereklidir"),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string()
    .min(8, "Şifre en az 8 karakter olmalıdır")
    .regex(/[A-Z]/, "Şifre en az bir büyük harf içermelidir")
    .regex(/[0-9]/, "Şifre en az bir rakam içermelidir"),
  password_confirm: z.string(),
  chamber_number: z.string().min(4, "TVHB üye numarası gereklidir"),
  sicil_no: z.string().min(3, "Veteriner Hekimler Odası sicil numarası gereklidir"),
  license_number: z.string().min(4, "Lisans numarası gereklidir"),
  specialty: z.string().min(1, "Uzmanlık alanı seçiniz"),
  city: z.string().min(1, "Şehir seçiniz"),
  district: z.string().optional(),
  bio: z.string().optional(),
  consultation_fee: z.string().min(1, "Muayene ücreti gereklidir"),
  kvkk_consent: z.boolean().refine((v) => v, "KVKK metnini onaylamanız gerekir"),
  platform_agreement: z.boolean().refine((v) => v, "Platform kullanım sözleşmesini kabul etmeniz gerekir"),
  kanun_5996: z.boolean().refine((v) => v, "5996 sayılı Kanun yükümlülüklerini kabul etmeniz gerekir"),
}).refine((data) => data.password === data.password_confirm, {
  message: "Şifreler eşleşmiyor",
  path: ["password_confirm"],
});

const googleSchema = z.object({
  full_name: z.string().min(2, "Ad soyad gereklidir"),
  chamber_number: z.string().min(4, "TVHB üye numarası gereklidir"),
  sicil_no: z.string().min(3, "Veteriner Hekimler Odası sicil numarası gereklidir"),
  license_number: z.string().min(4, "Lisans numarası gereklidir"),
  specialty: z.string().min(1, "Uzmanlık alanı seçiniz"),
  city: z.string().min(1, "Şehir seçiniz"),
  district: z.string().optional(),
  bio: z.string().optional(),
  consultation_fee: z.string().min(1, "Muayene ücreti gereklidir"),
  kvkk_consent: z.boolean().refine((v) => v, "KVKK metnini onaylamanız gerekir"),
  platform_agreement: z.boolean().refine((v) => v, "Platform kullanım sözleşmesini kabul etmeniz gerekir"),
  kanun_5996: z.boolean().refine((v) => v, "5996 sayılı Kanun yükümlülüklerini kabul etmeniz gerekir"),
});

type EmailPasswordForm = z.infer<typeof emailPasswordSchema>;
type GoogleForm = z.infer<typeof googleSchema>;

function VetRegisterContent() {
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [diplomaError, setDiplomaError] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [registered, setRegistered] = useState(false);
  const [workingDays, setWorkingDays] = useState<string[]>(["Pazartesi","Salı","Çarşamba","Perşembe","Cuma"]);
  const [workingHoursStart, setWorkingHoursStart] = useState("09:00");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("18:00");
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGoogleMode = searchParams.get("google") === "true";
  // Pre-fill email when redirected from login "not found" banner
  const prefillEmail = searchParams.get("email") ?? "";

  const emailPasswordForm = useForm<EmailPasswordForm>({
    resolver: zodResolver(emailPasswordSchema),
    mode: "onBlur",
    defaultValues: { email: prefillEmail },
  });
  const passwordValue = emailPasswordForm.watch("password") ?? "";

  const googleForm = useForm<GoogleForm>({
    resolver: zodResolver(googleSchema),
    mode: "onBlur",
  });

  // Auto-save: restore on refresh, clear after success
  // Exclude password fields from storage for security
  const { clearSaved: clearEmailSaved } = useFormAutoSave(emailPasswordForm, "vet_register_draft");
  const { clearSaved: clearGoogleSaved } = useFormAutoSave(googleForm, "vet_register_google_draft");

  // Purge password fields from storage immediately after they are set
  useEffect(() => {
    const sub = emailPasswordForm.watch((_, { name }) => {
      if (name === "password" || name === "password_confirm") {
        try {
          const saved = sessionStorage.getItem("vet_register_draft");
          if (saved) {
            const parsed = JSON.parse(saved);
            delete parsed.password;
            delete parsed.password_confirm;
            sessionStorage.setItem("vet_register_draft", JSON.stringify(parsed));
          }
        } catch { /* ignore */ }
      }
    });
    return () => sub.unsubscribe();
  }, [emailPasswordForm]);

  const handleNextStep = async () => {
    const valid = await emailPasswordForm.trigger(["full_name", "email", "password", "password_confirm"]);
    if (!valid) {
      const pwErr = emailPasswordForm.formState.errors.password?.message;
      if (pwErr) {
        toast.error(
          `Şifre geçersiz: ${pwErr}\n\nÖrnek güçlü şifre: Veteriner1`,
          { duration: 5000, description: "Şifreniz en az 8 karakter, 1 büyük harf ve 1 rakam içermelidir." }
        );
      }
      return;
    }

    // Pre-flight: check if email already exists with a different role
    const email = emailPasswordForm.getValues("email");
    const checkRes = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const checkData = await checkRes.json();
    if (checkData.exists) {
      const msg =
        checkData.role === "owner"
          ? "Bu e-posta adresi zaten Pet Sahibi hesabı olarak kayıtlı. Lütfen giriş yapın veya farklı bir e-posta kullanın."
          : "Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın veya farklı bir e-posta kullanın.";
      emailPasswordForm.setError("email", { message: msg });
      return;
    }

    setStep(2);
  };

  const onSubmitEmailPassword = async (data: EmailPasswordForm) => {
    if (!diplomaFile) { setDiplomaError(true); return; }
    // File type & size validation
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(diplomaFile.type)) {
      toast.error("Diploma dosyası yalnızca PDF, JPG veya PNG formatında olabilir");
      return;
    }
    if (diplomaFile.size > 10 * 1024 * 1024) {
      toast.error("Diploma dosyası en fazla 10 MB olabilir");
      return;
    }
    setDiplomaError(false);
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { role: "vet", full_name: data.full_name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Kullanıcı oluşturulamadı");

      // Upload diploma (best effort — storage bucket may not exist yet)
      let license_document_url: string | null = null;
      const fileExt = diplomaFile.name.split(".").pop();
      const fileName = `${authData.user.id}/diploma.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("license-documents")
        .upload(fileName, diplomaFile);
      if (!uploadError) license_document_url = fileName;

      // Use service-role API to write public.users + veterinarians
      // (client can't write for unconfirmed users due to RLS)
      const res = await fetch("/api/auth/vet-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authData.user.id,
          email: data.email,
          full_name: data.full_name,
          city: data.city,
          chamber_number: data.chamber_number,
          sicil_no: data.sicil_no,
          license_number: data.license_number,
          specialty: data.specialty,
          district: data.district || null,
          bio: data.bio || null,
          consultation_fee: data.consultation_fee,
          license_document_url,
          working_days: workingDays,
          working_hours_start: workingHoursStart,
          working_hours_end: workingHoursEnd,
          kvkk_consent: data.kvkk_consent === true,  // persist to DB
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        // Cleanup orphaned auth user so they can retry registration
        await supabase.auth.signOut();
        throw new Error(err.error || "Profil oluşturulamadı. Lütfen tekrar deneyin.");
      }

      clearEmailSaved();
      clearGoogleSaved();
      setRegistered(true);
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : "Hata oluştu";
      const lower = raw.toLowerCase();
      const translated = translateAuthError(raw);
      const msg = translated
        ? translated
        : lower.includes("already registered") ||
          lower.includes("already been registered") ||
          lower.includes("user already exists") ||
          lower.includes("zaten kayıtlı")
        ? "Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın veya farklı bir e-posta kullanın."
        : raw;
      toast.error(msg, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const onSubmitGoogle = async (data: GoogleForm) => {
    if (!diplomaFile) { setDiplomaError(true); return; }
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(diplomaFile.type)) {
      toast.error("Diploma dosyası yalnızca PDF, JPG veya PNG formatında olabilir");
      return;
    }
    if (diplomaFile.size > 10 * 1024 * 1024) {
      toast.error("Diploma dosyası en fazla 10 MB olabilir");
      return;
    }
    setDiplomaError(false);
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı. Lütfen tekrar Google ile giriş yapın.");

      // Upload diploma (best effort)
      let license_document_url: string | null = null;
      const fileExt = diplomaFile.name.split(".").pop();
      const fileName = `${user.id}/diploma.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("license-documents")
        .upload(fileName, diplomaFile);
      if (!uploadError) license_document_url = fileName;

      // Use service-role API — client RLS blocks INSERT on public.users
      const res = await fetch("/api/auth/vet-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          full_name: data.full_name,
          city: data.city,
          chamber_number: data.chamber_number,
          sicil_no: data.sicil_no,
          license_number: data.license_number,
          specialty: data.specialty,
          district: data.district || null,
          bio: data.bio || null,
          consultation_fee: data.consultation_fee,
          license_document_url,
          working_days: workingDays,
          working_hours_start: workingHoursStart,
          working_hours_end: workingHoursEnd,
          kvkk_consent: data.kvkk_consent === true,  // persist to DB
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Kayıt tamamlanamadı");
      }

      clearEmailSaved();
      clearGoogleSaved();
      setRegistered(true);
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : "Hata oluştu";
      const lower = raw.toLowerCase();
      const translated = translateAuthError(raw);
      const msg = translated
        ? translated
        : lower.includes("duplicate") || lower.includes("already")
        ? "Bu e-posta/sicil no ile zaten bir kayıt mevcut. Lütfen giriş sayfasından devam edin."
        : raw;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const DAYS = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
  const HOURS = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

  const WorkingSchedule = () => (
    <div className="space-y-3 bg-[#F0FDF4] border border-green-200 rounded-xl p-4">
      <p className="text-xs font-bold text-[#166534] uppercase tracking-wide">Çalışma Takvimi (Opsiyonel)</p>
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">Çalışma Günleri</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => setWorkingDays(prev =>
                prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
              )}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                workingDays.includes(day)
                  ? "bg-[#166534] text-white border-[#166534]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-[#166534]"
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <p className="text-xs text-gray-500 font-medium">Başlangıç</p>
          <select
            value={workingHoursStart}
            onChange={e => setWorkingHoursStart(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]/30 min-h-[44px]"
          >
            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-xs text-gray-500 font-medium">Bitiş</p>
          <select
            value={workingHoursEnd}
            onChange={e => setWorkingHoursEnd(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]/30 min-h-[44px]"
          >
            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-gray-400">Randevu saatleri bu aralıkta sunulur. Panelden her zaman değiştirebilirsiniz.</p>
    </div>
  );

  const DiplomaUpload = () => (
    <div className="space-y-1.5">
      <Label>Diploma / Mezuniyet Belgesi <span className="text-red-500">*</span></Label>
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          diplomaError ? "border-red-400 bg-red-50" : diplomaFile ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-[#166534]"
        }`}
        onClick={() => document.getElementById("diploma-file")?.click()}
      >
        {diplomaFile ? (
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-700 font-medium">{diplomaFile.name}</p>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 font-medium">Diploma yükleyin (Zorunlu)</p>
            <p className="text-xs text-gray-400 mt-1">PDF, JPG veya PNG — maks. 10MB</p>
          </>
        )}
      </div>
      {diplomaError && (
        <div className="flex items-center gap-1.5 text-red-500">
          <AlertCircle className="w-4 h-4" />
          <p className="text-xs">Diploma belgesi zorunludur</p>
        </div>
      )}
      <input
        id="diploma-file"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          if (f && f.size > 10 * 1024 * 1024) {
            toast.error("Diploma dosyası en fazla 10 MB olabilir");
            e.target.value = "";
            return;
          }
          setDiplomaFile(f);
          setDiplomaError(false);
        }}
      />
    </div>
  );

  if (registered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-[#166534]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Başvurunuz Alındı!</h2>
            <p className="text-gray-600 mb-2">
              Diplomanız ve bilgileriniz inceleniyor. Admin onayı sonrasında profiliniz yayınlanacak.
            </p>
            <p className="text-sm text-gray-500 mb-6">Onay bildirimi e-posta ile gönderilecektir.</p>
            <div className="bg-[#F0FDF4] rounded-lg p-3 mb-6 text-left">
              <p className="text-xs text-[#166534] font-medium mb-1">Süreç Hakkında:</p>
              <ul className="text-xs text-[#16A34A] space-y-1">
                <li>• Diploma ve TVHB üye numaranız doğrulanacak</li>
                <li>• Onay genellikle 1-2 iş günü sürer</li>
                <li>• Onay sonrası profiliniz arama sonuçlarında görünür</li>
              </ul>
            </div>
            <Button onClick={() => router.push("/auth/vet-login")} variant="outline" className="w-full">
              Giriş Sayfasına Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 whitespace-nowrap min-h-[44px]">
            <PawPrint size={28} color="#1A6B4A" />
            <div className="flex items-center gap-1.5">
              <span className="font-black text-2xl text-gray-900">Veterineri Bul</span>
            </div>
          </Link>
        </div>

        {/* Google mode: single step — professional details only */}
        {isGoogleMode ? (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm text-green-700 font-medium">Google hesabınızla bağlandınız</span>
              </div>
              <CardTitle className="text-xl">Mesleki Bilgilerinizi Ekleyin</CardTitle>
              <CardDescription>Diploma ve TVHB bilgileriniz admin tarafından doğrulanacak</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={googleForm.handleSubmit(onSubmitGoogle)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Ad Soyad</Label>
                  <Input placeholder="Vet. Hek. Ahmet Kaya" {...googleForm.register("full_name")} />
                  {googleForm.formState.errors.full_name && <p className="text-xs text-red-500">{googleForm.formState.errors.full_name.message}</p>}
                </div>

                <div className="bg-[#F0FDF4] border border-green-200 rounded-lg p-3 space-y-3">
                  <p className="text-xs text-[#166534] font-medium">Zorunlu Doğrulama Bilgileri</p>
                  <div className="space-y-1.5">
                    <Label>TVHB Üye Numarası <span className="text-red-500">*</span></Label>
                    <Input placeholder="Türk Veteriner Hekimleri Birliği üye no" {...googleForm.register("chamber_number")} />
                    {googleForm.formState.errors.chamber_number && <p className="text-xs text-red-500">{googleForm.formState.errors.chamber_number.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Veteriner Hekimler Odası Sicil No <span className="text-red-500">*</span></Label>
                    <Input placeholder="Bağlı olduğunuz odanın sicil numarası" {...googleForm.register("sicil_no")} />
                    {googleForm.formState.errors.sicil_no && <p className="text-xs text-red-500">{googleForm.formState.errors.sicil_no.message}</p>}
                    <p className="text-xs text-[#16A34A]">Bu bilgi admin tarafından oda kayıtlarıyla doğrulanacaktır.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Lisans Numarası</Label>
                    <Input placeholder="12345" {...googleForm.register("license_number")} />
                    {googleForm.formState.errors.license_number && <p className="text-xs text-red-500">{googleForm.formState.errors.license_number.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Muayene Ücreti (₺)</Label>
                    <Input type="number" placeholder="500" {...googleForm.register("consultation_fee")} />
                    {googleForm.formState.errors.consultation_fee && <p className="text-xs text-red-500">{googleForm.formState.errors.consultation_fee.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Uzmanlık Alanı</Label>
                  <select className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]" {...googleForm.register("specialty")}>
                    <option value="">Uzmanlık seçin</option>
                    {VETERINARY_SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {googleForm.formState.errors.specialty && <p className="text-xs text-red-500">{googleForm.formState.errors.specialty.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Şehir</Label>
                    <select className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]" {...googleForm.register("city")}>
                      <option value="">Şehir seçin</option>
                      {TURKISH_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {googleForm.formState.errors.city && <p className="text-xs text-red-500">{googleForm.formState.errors.city.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>İlçe (Opsiyonel)</Label>
                    <Input placeholder="Kadıköy" {...googleForm.register("district")} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Hakkınızda (Opsiyonel)</Label>
                  <Textarea placeholder="Uzmanlık alanlarınız, deneyiminiz..." rows={3} {...googleForm.register("bio")} />
                </div>

                <WorkingSchedule />

                <DiplomaUpload />

                {/* Platform Anti-Circumvention Agreement */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Platform Kullanım Sözleşmesi</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Platform dışına müşteri yönlendirmeyeceğimi, iletişim bilgisi paylaşmayacağımı kabul ediyorum.
                    İhlal durumunda hesabım kapatılacak ve abonelik ücreti iade edilmeyecektir.
                    <br /><br />
                    <strong className="text-amber-900">Platform üzerinden tanışılan pet sahipleriyle platform dışında ücretli hizmet vermek yasaktır. İhlalde hesap kalıcı kapatılır.</strong>
                    <br /><br />
                    <strong>İlk ihlalde:</strong> Uyarı + 7 gün askıya alma<br />
                    <strong>İkinci ihlalde:</strong> Kalıcı hesap kapatma
                  </p>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" id="g_platform_agreement" className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500" {...googleForm.register("platform_agreement")} />
                    <label htmlFor="g_platform_agreement" className="text-xs text-amber-800 font-medium cursor-pointer">
                      Bu koşulları okudum ve kabul ediyorum.
                    </label>
                  </div>
                  {googleForm.formState.errors.platform_agreement && (
                    <p className="text-xs text-red-500">{googleForm.formState.errors.platform_agreement.message}</p>
                  )}
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-orange-800 uppercase tracking-wide">5996 Sayılı Kanun Beyanı</p>
                  <p className="text-xs text-orange-700 leading-relaxed">
                    5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu kapsamındaki
                    mesleki yükümlülüklerimi bildiğimi ve platformu bu çerçevede kullanacağımı; ihbar
                    zorunluluğu gerektiren hastalıklarda (kuduz, şap, brucella vb.) ilgili mercilere
                    bildirimde bulunacağımı kabul ediyorum.
                  </p>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" id="g_kanun_5996" className="mt-0.5 h-4 w-4 rounded border-orange-400 text-orange-600 focus:ring-orange-500" {...googleForm.register("kanun_5996")} />
                    <label htmlFor="g_kanun_5996" className="text-xs text-orange-800 font-medium cursor-pointer">
                      5996 sayılı Kanun kapsamındaki yükümlülüklerimi kabul ediyorum.
                    </label>
                  </div>
                  {googleForm.formState.errors.kanun_5996 && (
                    <p className="text-xs text-red-500">{googleForm.formState.errors.kanun_5996.message}</p>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <input type="checkbox" id="kvkk" className="mt-0.5 h-4 w-4 rounded border-gray-300" {...googleForm.register("kvkk_consent")} />
                  <label htmlFor="kvkk" className="text-xs text-gray-600">
                    <Link href="/kvkk/veteriner" className="text-[#166534] hover:underline">KVKK Metni</Link>&apos;ni
                    ve <Link href="/kullanim-kosullari" className="text-[#166534] hover:underline">Kullanım Koşulları</Link>&apos;nı kabul ediyorum.
                  </label>
                </div>
                {googleForm.formState.errors.kvkk_consent && <p className="text-xs text-red-500">{googleForm.formState.errors.kvkk_consent.message}</p>}

                <Button type="submit" loading={loading} className="w-full">Başvuruyu Gönder</Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Email/password mode: 2-step form */
          <>
            {/* Steps */}
            <div className="flex items-center mb-6">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? "bg-[#166534] text-white" : "bg-gray-200 text-gray-500"}`}>
                    {s}
                  </div>
                  <div className="flex-1 text-xs text-gray-500 ml-2">
                    {s === 1 ? "Hesap Bilgileri" : "Mesleki Bilgiler"}
                  </div>
                  {s < 2 && <div className={`h-px flex-1 ${step >= 2 ? "bg-[#166534]" : "bg-gray-200"}`} />}
                </div>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 bg-[#F0FDF4] text-[#166534] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#166534]/20">
                    🩺 Veteriner Hekim Kayıt Platformu
                  </span>
                </div>
                <CardTitle className="text-xl">
                  <span className="font-black text-blue-700">Veteriner Hekim</span>{" "}
                  {step === 1 ? "Kaydı" : "Mesleki Bilgiler"}
                </CardTitle>
                <CardDescription>
                  {step === 1
                    ? "Veteriner hesabınız için kişisel bilgilerinizi girin"
                    : "Diploma ve TVHB üye bilgilerinizi ekleyin — admin onayı gereklidir"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {step === 1 && (
                  <>
                    {/* Google quick signup */}
                    <button
                      type="button"
                      onClick={signInWithGoogleForVet}
                      className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl py-2.5 px-4 mb-4 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google ile Hızlı Kayıt
                    </button>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">veya e-posta ile</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  </>
                )}

                <form onSubmit={emailPasswordForm.handleSubmit(onSubmitEmailPassword)} className="space-y-4">
                  {step === 1 && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Ad Soyad</Label>
                        <Input placeholder="Vet. Hek. Ahmet Kaya" {...emailPasswordForm.register("full_name")} />
                        {emailPasswordForm.formState.errors.full_name && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.full_name.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>E-posta</Label>
                        <Input type="email" placeholder="veteriner@email.com" {...emailPasswordForm.register("email")} />
                        {emailPasswordForm.formState.errors.email && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.email.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Şifre <span className="text-gray-400 font-normal text-xs">(en az 8 karakter, büyük harf ve rakam içermeli)</span></Label>
                        <div className="relative">
                          <Input type={showPass ? "text" : "password"} placeholder="••••••••" className="pr-10" {...emailPasswordForm.register("password")} />
                          <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowPass(v => !v)}>
                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <PasswordStrength password={passwordValue} />
                        {emailPasswordForm.formState.errors.password && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.password.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Şifre Tekrar</Label>
                        <div className="relative">
                          <Input type={showConfirm ? "text" : "password"} placeholder="••••••••" className="pr-10" {...emailPasswordForm.register("password_confirm")} />
                          <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowConfirm(v => !v)}>
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {emailPasswordForm.formState.errors.password_confirm && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.password_confirm.message}</p>}
                      </div>
                      <Button type="button" className="w-full" onClick={handleNextStep}>Devam Et</Button>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <div className="bg-[#F0FDF4] border border-blue-200 rounded-lg p-3 space-y-3">
                        <p className="text-xs text-[#166534] font-medium">Zorunlu Doğrulama Bilgileri</p>
                        <div className="space-y-1.5">
                          <Label>TVHB Üye Numarası <span className="text-red-500">*</span></Label>
                          <Input placeholder="Türk Veteriner Hekimleri Birliği üye no" {...emailPasswordForm.register("chamber_number")} />
                          {emailPasswordForm.formState.errors.chamber_number && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.chamber_number.message}</p>}
                          <p className="text-xs text-[#16A34A]">Türk Veteriner Hekimleri Birliği kayıt numaranız</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Veteriner Hekimler Odası Sicil No <span className="text-red-500">*</span></Label>
                          <Input placeholder="Bağlı olduğunuz odanın sicil numarası" {...emailPasswordForm.register("sicil_no")} />
                          {emailPasswordForm.formState.errors.sicil_no && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.sicil_no.message}</p>}
                          <p className="text-xs text-[#16A34A]">Admin tarafından oda kayıtlarıyla doğrulanacaktır.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Lisans Numarası</Label>
                          <Input placeholder="12345" {...emailPasswordForm.register("license_number")} />
                          {emailPasswordForm.formState.errors.license_number && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.license_number.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label>Muayene Ücreti (₺)</Label>
                          <Input type="number" placeholder="500" {...emailPasswordForm.register("consultation_fee")} />
                          {emailPasswordForm.formState.errors.consultation_fee && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.consultation_fee.message}</p>}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Uzmanlık Alanı</Label>
                        <select className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]" {...emailPasswordForm.register("specialty")}>
                          <option value="">Uzmanlık seçin</option>
                          {VETERINARY_SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {emailPasswordForm.formState.errors.specialty && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.specialty.message}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Şehir</Label>
                          <select className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]" {...emailPasswordForm.register("city")}>
                            <option value="">Şehir seçin</option>
                            {TURKISH_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {emailPasswordForm.formState.errors.city && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.city.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label>İlçe (Opsiyonel)</Label>
                          <Input placeholder="Kadıköy" {...emailPasswordForm.register("district")} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Hakkınızda (Opsiyonel)</Label>
                        <Textarea placeholder="Uzmanlık alanlarınız, deneyiminiz..." rows={3} {...emailPasswordForm.register("bio")} />
                      </div>

                      <WorkingSchedule />

                      <DiplomaUpload />

                      {/* Platform Anti-Circumvention Agreement */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Platform Kullanım Sözleşmesi</p>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          Platform dışına müşteri yönlendirmeyeceğimi, iletişim bilgisi paylaşmayacağımı kabul ediyorum.
                          İhlal durumunda hesabım kapatılacak ve abonelik ücreti iade edilmeyecektir.
                          <br /><br />
                          <strong className="text-amber-900">Platform üzerinden tanışılan pet sahipleriyle platform dışında ücretli hizmet vermek yasaktır. İhlalde hesap kalıcı kapatılır.</strong>
                          <br /><br />
                          <strong>İlk ihlalde:</strong> Uyarı + 7 gün askıya alma<br />
                          <strong>İkinci ihlalde:</strong> Kalıcı hesap kapatma
                        </p>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" id="platform_agreement" className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500" {...emailPasswordForm.register("platform_agreement")} />
                          <label htmlFor="platform_agreement" className="text-xs text-amber-800 font-medium cursor-pointer">
                            Bu koşulları okudum ve kabul ediyorum.
                          </label>
                        </div>
                        {emailPasswordForm.formState.errors.platform_agreement && (
                          <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.platform_agreement.message}</p>
                        )}
                      </div>

                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-bold text-orange-800 uppercase tracking-wide">5996 Sayılı Kanun Beyanı</p>
                        <p className="text-xs text-orange-700 leading-relaxed">
                          5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu kapsamındaki
                          mesleki yükümlülüklerimi bildiğimi ve platformu bu çerçevede kullanacağımı; ihbar
                          zorunluluğu gerektiren hastalıklarda (kuduz, şap, brucella vb.) ilgili mercilere
                          bildirimde bulunacağımı kabul ediyorum.
                        </p>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" id="kanun_5996" className="mt-0.5 h-4 w-4 rounded border-orange-400 text-orange-600 focus:ring-orange-500" {...emailPasswordForm.register("kanun_5996")} />
                          <label htmlFor="kanun_5996" className="text-xs text-orange-800 font-medium cursor-pointer">
                            5996 sayılı Kanun kapsamındaki yükümlülüklerimi kabul ediyorum.
                          </label>
                        </div>
                        {emailPasswordForm.formState.errors.kanun_5996 && (
                          <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.kanun_5996.message}</p>
                        )}
                      </div>

                      <div className="flex items-start gap-2">
                        <input type="checkbox" id="kvkk" className="mt-0.5 h-4 w-4 rounded border-gray-300" {...emailPasswordForm.register("kvkk_consent")} />
                        <label htmlFor="kvkk" className="text-xs text-gray-600">
                          <Link href="/kvkk/veteriner" className="text-[#166534] hover:underline">KVKK Metni</Link>&apos;ni
                          ve <Link href="/kullanim-kosullari" className="text-[#166534] hover:underline">Kullanım Koşulları</Link>&apos;nı kabul ediyorum.
                        </label>
                      </div>
                      {emailPasswordForm.formState.errors.kvkk_consent && <p className="text-xs text-red-500">{emailPasswordForm.formState.errors.kvkk_consent.message}</p>}

                      <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">Geri</Button>
                        <Button type="submit" loading={loading} className="flex-1">Başvur</Button>
                      </div>
                    </>
                  )}
                </form>

                <div className="mt-4 space-y-3">
                  <p className="text-sm text-center text-gray-500">
                    Zaten hesabınız var mı?{" "}
                    <Link href="/auth/vet-login" className="text-[#166534] font-medium hover:underline">Veteriner Girişi →</Link>
                  </p>
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <p className="text-xs text-center text-gray-500">Hayvan sahibi misiniz?</p>
                    <Link href="/auth/register">
                      <button type="button" className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-xl py-2.5 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                        🐾 Pet Sahibi Kaydı →
                      </button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default function VetRegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>}>
      <VetRegisterContent />
    </Suspense>
  );
}
