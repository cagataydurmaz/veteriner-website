"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TURKISH_CITIES } from "@/lib/constants";
import {
  User, Phone, Mail, MapPin, Save, Loader2, Check,
  Camera, Trash2, Home,
} from "lucide-react";
import Image from "next/image";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  avatar_url: string | null;
};

export default function OwnerProfilePage() {
  const [profile, setProfile] = useState<Profile>({
    id: "", full_name: "", email: "", phone: "", city: "", address: "", avatar_url: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const set = useCallback((key: keyof Profile, val: string) =>
    setProfile(p => ({ ...p, [key]: val })), []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("id, full_name, email, phone, city, address, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setProfile(data as Profile);
        if (data.avatar_url) setPreview(data.avatar_url);
      }
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error("Fotoğraf 3MB'dan küçük olmalı");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Sadece resim dosyası yükleyebilirsiniz");
      return;
    }

    // Local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatar_url = urlData.publicUrl + `?t=${Date.now()}`;

      // Route DB write through API (service client)
      await fetch("/api/owner/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url }),
      });
      setProfile(p => ({ ...p, avatar_url }));
      setPreview(avatar_url);
      toast.success("Profil fotoğrafı güncellendi");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Yüklenemedi";
      // If bucket doesn't exist, show helpful message
      if (msg.includes("Bucket not found") || msg.includes("bucket")) {
        toast.error("Supabase Storage 'avatars' bucket oluşturulmalı");
      } else {
        toast.error("Fotoğraf yüklenemedi: " + msg);
      }
      setPreview(profile.avatar_url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = async () => {
    if (!profile.avatar_url) return;
    try {
      const res = await fetch("/api/owner/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: null }),
      });
      if (!res.ok) throw new Error("Kaldırılamadı");
      setProfile(p => ({ ...p, avatar_url: null }));
      setPreview(null);
      toast.success("Fotoğraf kaldırıldı");
    } catch {
      toast.error("Kaldırılamadı");
    }
  };

  const save = async () => {
    if (!profile.full_name.trim()) {
      toast.error("Ad soyad boş bırakılamaz");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/owner/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profile.full_name.trim(),
          phone: profile.phone,
          city: profile.city,
          address: profile.address,
        }),
      });
      const data = await res.json() as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "Kaydedilemedi");
      setSaved(true);
      toast.success(data.message ?? "Profil güncellendi");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-5 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-lg w-48" />
        <div className="bg-white rounded-2xl p-6 flex items-center gap-4">
          <div className="w-20 h-20 bg-gray-200 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-3 bg-gray-100 rounded w-48" />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profilim</h1>
        <p className="text-sm text-gray-500 mt-1">Kişisel bilgilerini ve fotoğrafını düzenle</p>
      </div>

      {/* Photo + name card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-[#DCFCE7] flex items-center justify-center ring-4 ring-white shadow-md">
              {preview ? (
                <Image
                  src={preview}
                  alt="Profil fotoğrafı"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-2xl font-bold text-[#166534]">{initials}</span>
              )}
            </div>

            {/* Upload overlay */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              title="Fotoğraf değiştir"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {/* Name + actions */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-lg truncate">
              {profile.full_name || "İsim yok"}
            </p>
            <p className="text-sm text-gray-500 truncate">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 text-xs text-[#166534] font-medium hover:underline disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5" />
                {preview ? "Fotoğrafı Değiştir" : "Fotoğraf Ekle"}
              </button>
              {preview && (
                <>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={removePhoto}
                    className="inline-flex items-center gap-1.5 text-xs text-red-500 font-medium hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Kaldır
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG — maks. 3MB</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <User className="w-4 h-4 text-[#166534]" />
          Kişisel Bilgiler
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Full name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Ad Soyad</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={profile.full_name}
                onChange={e => set("full_name", e.target.value)}
                placeholder="Ad Soyad"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 transition"
              />
            </div>
          </div>

          {/* Email */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              E-posta
              <span className="ml-1.5 text-gray-400 font-normal">(değiştirilemez)</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
              <input
                value={profile.email}
                disabled
                className="w-full pl-9 pr-4 py-2.5 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Telefon</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={profile.phone || ""}
                onChange={e => set("phone", e.target.value)}
                placeholder="+90 5XX XXX XX XX"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 transition"
              />
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Şehir</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={profile.city || ""}
                onChange={e => set("city", e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 appearance-none bg-white transition"
              >
                <option value="">Şehir seçin</option>
                {TURKISH_CITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Adres</label>
            <div className="relative">
              <Home className="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              <textarea
                value={profile.address || ""}
                onChange={e => set("address", e.target.value)}
                placeholder="Mahalle, sokak, bina no..."
                rows={2}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 resize-none transition"
              />
            </div>
          </div>
        </div>

        <Button
          className="w-full bg-[#166534] hover:bg-[#14532D] text-white h-11 rounded-xl font-medium transition-all"
          onClick={save}
          disabled={saving || saved}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Kaydediliyor...</>
          ) : saved ? (
            <><Check className="w-4 h-4 mr-2" /> Kaydedildi!</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Değişiklikleri Kaydet</>
          )}
        </Button>
      </div>
    </div>
  );
}
