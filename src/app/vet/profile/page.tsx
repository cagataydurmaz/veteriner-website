"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, X, CheckCircle, Loader2, CreditCard, Camera,
  MapPin, FileText, Info, User, Shield, Video, Stethoscope, Siren,
} from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { TURKISH_CITIES, VETERINARY_SCHOOLS } from "@/lib/constants";

const SPECIALTIES = [
  "Genel Pratisyen", "Cerrahi", "Dermatoloji", "Kardiyoloji",
  "Nöroloji", "Onkoloji", "Ortopedi", "Oftalmoloji",
  "Diş", "Egzotik", "Büyük Hayvan", "Küçük Hayvan",
] as const;
type Specialty = (typeof SPECIALTIES)[number];

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/* ── Specialty Tag Input ──────────────────────────────────────────────────────
   Replaces the checkbox grid with a compact chip-based tag input.
   Users type to filter the autocomplete dropdown, press Enter or click a
   suggestion to add a specialty, and click × on a chip to remove it.
   Backspace on an empty input removes the last chip.
──────────────────────────────────────────────────────────────────────────── */
function SpecialtyTagInput({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (s: string[]) => void;
}) {
  const [query, setQuery]     = useState("");
  const [open, setOpen]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = (SPECIALTIES as readonly string[]).filter(
    (s) => !selected.includes(s) && s.toLowerCase().includes(query.toLowerCase())
  );

  const add = (s: string) => {
    if (!selected.includes(s)) onChange([...selected, s]);
    setQuery("");
    inputRef.current?.focus();
  };

  const remove = (s: string) => onChange(selected.filter((x) => x !== s));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      add(suggestions[0]);
    }
    if (e.key === "Backspace" && !query && selected.length > 0) {
      remove(selected[selected.length - 1]);
    }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-[#F0FDF4] border border-[#166534]/20 text-[#166534] text-xs font-semibold rounded-full"
            >
              {s}
              <button
                type="button"
                onClick={() => remove(s)}
                aria-label={`${s} kaldır`}
                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-[#166534]/15 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length ? "Daha fazla ekle…" : "Uzmanlık alanı ekle…"}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/25 placeholder:text-gray-300"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden max-h-48 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => add(s)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#F0FDF4] hover:text-[#166534] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected.length === 0 && (
        <p className="text-xs text-amber-500 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          En az bir uzmanlık alanı seçin
        </p>
      )}
    </div>
  );
}

/* ── Service Card ─────────────────────────────────────────────────────────────
   Unified card per service: icon · name · description · toggle · optional fee.
   Replaces the scattered toggle + indented fee input pattern.
──────────────────────────────────────────────────────────────────────────── */
function ServiceCard({
  icon: Icon,
  color,
  bgActive,
  borderActive,
  label,
  description,
  enabled,
  onToggle,
  fee,
  onFeeChange,
  feeLabel,
  feeMin = 200,
}: {
  icon: React.ElementType;
  color: string;
  bgActive: string;
  borderActive: string;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  fee?: number;
  onFeeChange?: (v: number) => void;
  feeLabel?: string;
  feeMin?: number;
}) {
  return (
    <div
      className={`rounded-xl border-2 transition-all duration-200 ${
        enabled ? `${borderActive} ${bgActive}` : "border-gray-100 bg-gray-50/50"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              enabled ? color : "bg-gray-100"
            }`}
          >
            <Icon className={`w-5 h-5 ${enabled ? "text-white" : "text-gray-400"}`} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${enabled ? "text-gray-900" : "text-gray-500"}`}>
              {label}
            </p>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${label}: ${enabled ? "aktif" : "pasif"}`}
          className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#166534] ${
            enabled ? color : "bg-gray-200"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              enabled ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Fee row — shown only when service is enabled and fee prop provided */}
      {enabled && fee !== undefined && onFeeChange && feeLabel && (
        <div className="px-4 pb-4 flex items-center gap-3 border-t border-white/60">
          <Label className="text-xs text-gray-500 shrink-0 flex items-center gap-1 mt-0">
            <CreditCard className="w-3 h-3" />
            {feeLabel}
          </Label>
          <Input
            type="number"
            min={feeMin}
            step={50}
            value={fee}
            onChange={(e) => onFeeChange(Math.max(feeMin, parseInt(e.target.value) || feeMin))}
            className="max-w-[130px] h-8 text-sm"
          />
          <p className="text-xs text-gray-400">Min ₺{feeMin}</p>
        </div>
      )}
    </div>
  );
}

type Tab = "genel" | "belgeler" | "hesap";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "genel",    label: "Genel",    icon: User },
  { id: "belgeler", label: "Belgeler", icon: FileText },
  { id: "hesap",    label: "Hesap",    icon: Shield },
];

export default function VetProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>("genel");
  const [loading,   setLoading]   = useState(false);
  const [fetching,  setFetching]  = useState(true);

  // Avatar
  const [avatarFile,       setAvatarFile]       = useState<File | null>(null);
  const [avatarPreview,    setAvatarPreview]     = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [avatarError,      setAvatarError]       = useState("");
  const [initials,         setInitials]          = useState("V");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Account info
  const [email,  setEmail]  = useState("");
  const [vetId,  setVetId]  = useState<string | null>(null);

  const [form, setForm] = useState({
    bio: "",
    education: "",
    specialties: [] as string[],
    video_consultation_fee: 300,
    nobetci_fee: 500,
    offers_in_person: true,
    offers_video: false,
    offers_nobetci: false,
    is_on_call: false,
    city: "",
    working_hours_start: "09:00",
    working_hours_end: "18:00",
    working_days: ["pzt", "sal", "car", "per", "cum"] as string[],
  });

  const [educationOther, setEducationOther] = useState("");
  const [originalCity,   setOriginalCity]   = useState("");
  const [originalFee,    setOriginalFee]    = useState(300);

  // Diploma
  const [diplomaFile,       setDiplomaFile]       = useState<File | null>(null);
  const [currentDiplomaUrl, setCurrentDiplomaUrl] = useState<string | null>(null);
  const diplomaInputRef = useRef<HTMLInputElement>(null);

  // City change modal
  const [cityChangeModal, setCityChangeModal] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const { data } = await supabase
        .from("veterinarians")
        .select("id, bio, education, specialty, video_consultation_fee, nobetci_fee, offers_in_person, offers_video, offers_nobetci, is_on_call, city, diploma_url, working_hours_start, working_hours_end, working_days")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setVetId(data.id);
        const fee  = data.video_consultation_fee || 300;
        const city = data.city || "";
        const savedEdu  = data.education || "";
        const knownSchool  = VETERINARY_SCHOOLS.includes(savedEdu);
        const eduDropdown  = knownSchool ? savedEdu : (savedEdu ? "Yurt Dışı — Diğer" : "");
        const eduOther     = (!knownSchool && savedEdu) ? savedEdu : "";

        let parsedSpecialties: string[] = [];
        if (data.specialty) {
          try {
            const parsed = JSON.parse(data.specialty);
            parsedSpecialties = Array.isArray(parsed) ? parsed : [data.specialty];
          } catch {
            parsedSpecialties = [data.specialty];
          }
        }

        setForm({
          bio: data.bio || "",
          education: eduDropdown,
          specialties: parsedSpecialties,
          video_consultation_fee: fee,
          nobetci_fee: data.nobetci_fee || 500,
          offers_in_person: data.offers_in_person ?? true,
          offers_video: data.offers_video ?? false,
          offers_nobetci: data.offers_nobetci ?? false,
          is_on_call: data.is_on_call ?? false,
          city,
          working_hours_start: data.working_hours_start || "09:00",
          working_hours_end:   data.working_hours_end   || "18:00",
          working_days: data.working_days || ["pzt", "sal", "car", "per", "cum"],
        });
        setEducationOther(eduOther);
        setOriginalCity(city);
        setOriginalFee(fee);
        setCurrentDiplomaUrl(data.diploma_url || null);
      }

      const { data: userData } = await supabase
        .from("users")
        .select("avatar_url, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (userData) {
        setCurrentAvatarUrl(userData.avatar_url || null);
        setInitials(
          userData.full_name
            ?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "V"
        );
      }

      setFetching(false);
    })();
  }, []);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    if (file.size > MAX_AVATAR_BYTES) { setAvatarError("Fotoğraf 2MB'dan küçük olmalıdır."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Sadece JPG, PNG veya WebP yükleyebilirsiniz."); return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleDiplomaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Diploma PDF, JPG veya PNG olmalıdır."); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Diploma dosyası en fazla 10 MB olabilir."); return;
    }
    setDiplomaFile(file);
    toast.info("Diploma değişikliği kaydedilince yeniden onay süreci başlar.");
  };

  const handleSave = async (skipCityCheck = false) => {
    if (form.specialties.length === 0) { toast.error("En az bir uzmanlık alanı seçiniz"); return; }
    if (!form.city) { toast.error("Lütfen şehir seçiniz"); return; }

    if (!skipCityCheck && form.city && form.city !== originalCity) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: vetRow } = await supabase.from("veterinarians").select("id").eq("user_id", user.id).maybeSingle();
        if (vetRow) {
          const { count } = await supabase.from("appointments").select("*", { count: "exact", head: true })
            .eq("vet_id", vetRow.id).in("status", ["pending", "confirmed"]).gte("datetime", new Date().toISOString());
          if ((count ?? 0) > 0) { setCityChangeModal(true); return; }
        }
      }
    }

    setLoading(true);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      if (avatarFile) {
        const ext = avatarFile.type === "image/webp" ? "webp" : avatarFile.type === "image/png" ? "png" : "jpg";
        const path = `avatars/${user.id}/avatar.${ext}`;
        const { error: avatarUploadError } = await supabase.storage
          .from("avatars").upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (avatarUploadError) throw avatarUploadError;
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        const urlWithCache = `${publicUrl}?t=${Date.now()}`;
        await supabase.from("users").update({ avatar_url: urlWithCache }).eq("id", user.id);
        setCurrentAvatarUrl(urlWithCache);
        setAvatarFile(null);
        setAvatarPreview(null);
      }

      const fee = Math.max(200, Math.floor(form.video_consultation_fee));
      const resolvedEducation =
        form.education === "Yurt Dışı — Diğer" ? educationOther.trim() : form.education;

      let diplomaUrl = currentDiplomaUrl;
      let needsReVerification = false;
      if (diplomaFile) {
        // Upload via server-side route (service_role) — bypasses storage RLS WITH CHECK
        const fd = new FormData();
        fd.append("file", diplomaFile);
        const dipRes = await fetch("/api/vet/upload-diploma", { method: "POST", body: fd });
        const dipData = await dipRes.json() as { url?: string; error?: string };
        if (!dipRes.ok) throw new Error(dipData.error ?? "Diploma yüklenemedi");
        diplomaUrl = dipData.url!;
        needsReVerification = true;
      }

      // Route the DB write through our API (service_role) to bypass RLS WITH CHECK
      const profileRes = await fetch("/api/vet/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: form.bio,
          education: resolvedEducation,
          specialty: JSON.stringify(form.specialties),
          video_consultation_fee: fee,
          offers_in_person: form.offers_in_person,
          offers_video: form.offers_video,
          offers_nobetci: form.offers_nobetci,
          nobetci_fee: form.offers_nobetci ? (form.nobetci_fee || 500) : null,
          is_on_call: form.is_on_call,
          city: form.city || null,
          working_hours_start: form.working_hours_start,
          working_hours_end: form.working_hours_end,
          working_days: form.working_days,
          ...(diplomaUrl ? { diploma_url: diplomaUrl } : {}),
          needs_re_verification: needsReVerification,
        }),
      });
      const profileData = await profileRes.json() as { error?: string; message?: string };
      if (!profileRes.ok) throw new Error(profileData.error ?? "Profil kaydedilemedi");

      if (needsReVerification) {
        setCurrentDiplomaUrl(diplomaUrl);
        setDiplomaFile(null);
      }
      toast.success(profileData.message ?? "Profil güncellendi");
      setOriginalCity(form.city);
      setOriginalFee(fee);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#166534]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* ── City Change Modal ─────────────────────────────────────────────────── */}
      {cityChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Şehir Değişikliği</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Aktif randevularınız var. Şehir değişikliği mevcut randevuları iptal etmez, ancak
              hayvan sahipleri farklı bir konumda görecek. Devam etmek istiyor musunuz?
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setCityChangeModal(false)}
              >
                Vazgeç
              </button>
              <button
                className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
                onClick={() => { setCityChangeModal(false); handleSave(true); }}
              >
                Evet, Değiştir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Profil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Bilgilerinizi yönetin</p>
      </div>

      {/* ── Tab strip ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px]
                ${activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}
              `}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-xs">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 1 — GENEL
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "genel" && (
        <>
          {/* Avatar */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#166534]" />
              Profil Fotoğrafı
            </h2>
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                {(avatarPreview || currentAvatarUrl) ? (
                  <img
                    src={avatarPreview || currentAvatarUrl!}
                    alt="Profil fotoğrafı"
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#DCFCE7]"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-[#166534] to-[#15803D] rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">{initials}</span>
                  </div>
                )}
                {(avatarPreview || currentAvatarUrl) && (
                  <button
                    onClick={() => { setAvatarFile(null); setAvatarPreview(null); if (!avatarPreview) setCurrentAvatarUrl(null); }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={avatarInputRef} type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden" onChange={handleAvatarSelect}
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#166534] hover:text-[#166534] transition-colors"
                >
                  <Upload className="w-4 h-4" /> Fotoğraf Seç
                </button>
                <p className="text-xs text-gray-400 mt-1.5">JPG, PNG veya WebP — Maks. 2MB</p>
                {avatarError && <p className="text-xs text-red-600 mt-1">{avatarError}</p>}
                {avatarFile && <p className="text-xs text-[#166534] mt-1 font-medium">✓ {avatarFile.name} seçildi</p>}
              </div>
            </div>
          </div>

          {/* Bio + education + specialties + city */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Genel Bilgiler</h2>

            <div className="space-y-1.5">
              <Label>Biyografi</Label>
              <Textarea
                rows={4}
                placeholder="Kendinizi ve uzmanlık alanınızı anlatın…"
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Mezun Olduğunuz Okul</Label>
              <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 select-none">
                {form.education === "Yurt Dışı — Diğer" ? (educationOther || "—") : (form.education || "—")}
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0" />
                Okul bilgisi kayıt sırasında belirlenir, sonradan değiştirilemez.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Uzmanlık Alanları</Label>
              <SpecialtyTagInput
                selected={form.specialties}
                onChange={(s) => setForm(f => ({ ...f, specialties: s as typeof f.specialties }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" /> Şehir
              </Label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]"
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              >
                <option value="">Şehir seçin</option>
                {TURKISH_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {form.city !== originalCity && originalCity && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Şehir değişikliği mevcut randevuları etkilemez ancak profiliniz yeni şehirde görünür.
                </p>
              )}
            </div>
          </div>

          {/* ── Hizmetler & Ana Anahtarlar — Unified Service Cards ──────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-[#166534]" />
                Hizmetler &amp; Ana Anahtarlar
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Kapalı hizmetler panelde pasif görünür.
              </p>
            </div>

            {/* Klinikte Muayene */}
            <ServiceCard
              icon={MapPin}
              color="bg-[#166534]"
              bgActive="bg-[#F0FDF4]/60"
              borderActive="border-[#166534]/20"
              label="Klinikte Muayene"
              description="Fiziksel muayene randevuları"
              enabled={form.offers_in_person}
              onToggle={() => setForm(f => ({ ...f, offers_in_person: !f.offers_in_person }))}
            />

            {/* Online Görüşme */}
            <ServiceCard
              icon={Video}
              color="bg-blue-600"
              bgActive="bg-blue-50/40"
              borderActive="border-blue-200"
              label="Online Görüşme"
              description={'Dashboard\'daki "Online" toggle\'ını açar'}
              enabled={form.offers_video}
              onToggle={() => setForm(f => ({ ...f, offers_video: !f.offers_video }))}
              fee={form.offers_video ? form.video_consultation_fee : undefined}
              onFeeChange={(v) => setForm(f => ({ ...f, video_consultation_fee: v }))}
              feeLabel="Görüşme Ücreti (₺)"
            />

            {/* Nöbetçi / Acil */}
            <ServiceCard
              icon={Siren}
              color="bg-amber-500"
              bgActive="bg-amber-50/40"
              borderActive="border-amber-200"
              label="Nöbetçi / Acil Hizmet"
              description={'Dashboard\'daki "Nöbetçi" toggle\'ını açar'}
              enabled={form.offers_nobetci}
              onToggle={() => setForm(f => ({ ...f, offers_nobetci: !f.offers_nobetci }))}
              fee={form.offers_nobetci ? form.nobetci_fee : undefined}
              onFeeChange={(v) => setForm(f => ({ ...f, nobetci_fee: v }))}
              feeLabel="Nöbet Ücreti (₺)"
            />
          </div>

          {(form.specialties.length === 0 || !form.city) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Kaydedebilmek için{" "}
                {form.specialties.length === 0 && !form.city ? "uzmanlık alanı ve şehir" : form.specialties.length === 0 ? "uzmanlık alanı" : "şehir"}{" "}
                seçmelisiniz.
              </span>
            </div>
          )}

          <Button
            onClick={() => handleSave(false)}
            loading={loading}
            disabled={form.specialties.length === 0 || !form.city}
            className="w-full bg-[#166534] hover:bg-[#14532D] text-white"
          >
            Kaydet
          </Button>
        </>
      )}


      {/* ════════════════════════════════════════════════════════════════════════
          TAB 2 — BELGELER
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "belgeler" && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#166534]" />
              <h2 className="font-semibold text-gray-900">Diplomanız</h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Veteriner hekim diploması, hesabınızın doğrulanması için gereklidir.
              Admin ekibimiz belgenizi inceleyerek hesabınızı onaylar.
            </p>
            {currentDiplomaUrl ? (
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Diploma yüklendi ✅</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Değişiklik için{" "}
                    <a href="mailto:destek@veterineribul.com" className="underline hover:text-green-900">
                      destek@veterineribul.com
                    </a>
                  </p>
                </div>
              </div>
            ) : (
              <>
                {diplomaFile && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Yeni diploma seçildi. Kaydet sonrası profiliniz incelemeye alınır.
                  </div>
                )}
                <input
                  ref={diplomaInputRef} type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden" onChange={handleDiplomaSelect}
                />
                <button
                  type="button" onClick={() => diplomaInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 hover:border-[#166534] hover:bg-[#F0FDF4] transition-colors"
                >
                  <Upload className="w-5 h-5 text-[#166534]" />
                  <span className="text-sm text-gray-600 font-medium">
                    {diplomaFile ? diplomaFile.name : "Diploma yükle"}
                  </span>
                  <span className="text-xs text-gray-400">PDF, JPG veya PNG — Maks. 10MB</span>
                </button>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Info className="w-3 h-3 shrink-0" />
                  Diploma yüklendikten sonra admin onayına gider.
                </p>
                {diplomaFile && (
                  <Button
                    onClick={() => handleSave(false)}
                    loading={loading}
                    disabled={form.specialties.length === 0 || !form.city}
                    className="w-full bg-[#166534] hover:bg-[#14532D] text-white"
                  >
                    Diplomayı Kaydet
                  </Button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 3 — HESAP
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "hesap" && (
        <div className="space-y-4">
          {/* Account info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#166534]" />
              Hesap Bilgileri
            </h2>
            <div className="space-y-1.5">
              <Label>E-posta</Label>
              <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 select-none">
                {email || "—"}
              </div>
              <p className="text-xs text-gray-400">E-posta değiştirmek için destek ekibiyle iletişime geçin.</p>
            </div>
          </div>

          {/* Password */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Şifre</h2>
            <p className="text-sm text-gray-500">Şifrenizi sıfırlamak için e-posta adresinize bağlantı gönderilebilir.</p>
            <Link
              href="/auth/forgot-password"
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#166534] hover:text-[#166534] transition-colors"
            >
              Şifremi Sıfırla
            </Link>
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-xl border border-red-200 p-5 space-y-3">
            <h2 className="font-semibold text-red-700">Tehlikeli Bölge</h2>
            <p className="text-sm text-gray-500">
              Hesabınızı silmek veya devre dışı bırakmak için destek ekibiyle iletişime geçiniz.
              Hesap silme işlemi geri alınamaz.
            </p>
            <a
              href="mailto:destek@veterineribul.com?subject=Hesap%20Silme%20Talebi"
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Hesabı Sil
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
