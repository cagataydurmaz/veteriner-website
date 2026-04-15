"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Mail, Clock, Save, Trash2, Eye, EyeOff, AlertTriangle, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface NotifPrefs {
  email_notifications: boolean;
  reminder_timing: "1h" | "3h" | "24h";
}

const REMINDER_OPTIONS: { value: "1h" | "3h" | "24h"; label: string; desc: string }[] = [
  { value: "1h",  label: "1 Saat Önce",  desc: "Randevudan 1 saat önce hatırlatma" },
  { value: "3h",  label: "3 Saat Önce",  desc: "Randevudan 3 saat önce hatırlatma" },
  { value: "24h", label: "1 Gün Önce",   desc: "Randevudan 24 saat önce hatırlatma" },
];

export default function OwnerSettingsPage() {
  const router = useRouter();

  // ── Deletion dialog state ──────────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isGoogleOnly, setIsGoogleOnly] = useState(false);

  const confirmDeletion = async () => {
    if (!isGoogleOnly && !deletePassword) { toast.error("Şifrenizi girin"); return; }
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/owner/self-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Hesabınız silindi. İyi günler.", { duration: 4000 });
      router.replace("/auth/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız. Tekrar deneyin.");
      setDeletePassword("");
    } finally {
      setDeleteLoading(false);
    }
  };

  const [prefs, setPrefs] = useState<NotifPrefs>({
    email_notifications: true,
    reminder_timing: "3h",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Detect Google-only users (no email identity)
    const googleOnly =
      user?.app_metadata?.provider === "google" &&
      !user?.identities?.find((i: { provider: string }) => i.provider === "email");
    setIsGoogleOnly(googleOnly);

    const { data } = await supabase
      .from("users")
      .select("email_notifications, reminder_timing")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setPrefs({
        email_notifications: data.email_notifications ?? true,
        reminder_timing: data.reminder_timing ?? "3h",
      });
    }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase
      .from("users")
      .update({
        email_notifications: prefs.email_notifications,
        reminder_timing: prefs.reminder_timing,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error("Kaydedilemedi: " + error.message);
    else toast.success("Bildirim tercihleriniz güncellendi");
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-40 bg-gray-200 rounded-2xl" />
        <div className="h-40 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bildirim Ayarları</h1>
        <p className="text-sm text-gray-500 mt-1">
          Hangi kanallardan ve ne zaman bildirim almak istediğinizi seçin
        </p>
      </div>

      {/* Notification channels */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#166534]" />
            Bildirim Kanalları
          </CardTitle>
          <CardDescription>Bildirimlerin gönderileceği kanalları açın veya kapatın</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          {/* Email toggle */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">E-posta</p>
                <p className="text-xs text-gray-400">Duyurular, fatura ve önemli bilgiler</p>
              </div>
            </div>
            <button
              onClick={() => setPrefs((p) => ({ ...p, email_notifications: !p.email_notifications }))}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                prefs.email_notifications ? "bg-[#166534]" : "bg-gray-200"
              }`}
              aria-label="E-posta bildirimleri"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  prefs.email_notifications ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Reminder timing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#166534]" />
            Hatırlatma Zamanı
          </CardTitle>
          <CardDescription>Randevudan ne kadar önce hatırlatma almak istiyorsunuz?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {REMINDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPrefs((p) => ({ ...p, reminder_timing: opt.value }))}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors text-left ${
                prefs.reminder_timing === opt.value
                  ? "border-[#166534] bg-[#F0FDF4]"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div>
                <p className="font-medium text-gray-900 text-sm">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </div>
              {prefs.reminder_timing === opt.value && (
                <div className="w-5 h-5 bg-[#166534] rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      <Button
        className="w-full h-12 text-base"
        loading={saving}
        onClick={save}
      >
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </Button>

      {/* Account Deletion */}
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-red-600">
            <Trash2 className="w-4 h-4" />
            Hesabımı Sil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Bu işlem geri alınamaz. Tüm verileriniz silinecek.
          </p>
          <ul className="text-sm text-gray-500 space-y-1 list-none">
            <li className="flex items-start gap-2">
              <span className="text-red-400 shrink-0 mt-0.5">✕</span>
              Profil bilgileriniz anonimleştirilecek
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 shrink-0 mt-0.5">✕</span>
              Gelecekteki tüm randevularınız iptal edilecek
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 shrink-0 mt-0.5">!</span>
              Randevu geçmişi yasal zorunluluk gereği saklanır
            </li>
          </ul>
          <a
            href="/api/owner/data-export"
            download
            className="inline-flex items-center gap-2 text-sm text-[#166534] hover:underline"
          >
            <Download className="w-4 h-4" />
            Verilerimi İndir (KVKK)
          </a>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Hesabımı Sil
          </Button>
        </CardContent>
      </Card>

      {/* Deletion Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!deleteLoading) {
            setShowDeleteDialog(open);
            if (!open) setDeletePassword("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Hesabı Kalıcı Olarak Sil
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">Bu işlem geri alınamaz.</p>
              <p className="text-sm text-red-700">
                Tüm verileriniz silinecek. Gelecekteki tüm randevularınız iptal edilecek.
                Randevu geçmişi yasal zorunluluk gereği saklanmaya devam eder.
              </p>
            </div>

            {!isGoogleOnly && (
              <div className="space-y-2">
                <Label htmlFor="owner-delete-password" className="text-sm font-medium text-gray-700">
                  Devam etmek için şifrenizi girin
                </Label>
                <div className="relative">
                  <Input
                    id="owner-delete-password"
                    type={showDeletePassword ? "text" : "password"}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !deleteLoading && confirmDeletion()}
                    placeholder="Şifreniz"
                    className="pr-10 border-red-200 focus:ring-red-400"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => { setShowDeleteDialog(false); setDeletePassword(""); }}
              disabled={deleteLoading}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletion}
              disabled={(!isGoogleOnly && !deletePassword) || deleteLoading}
              loading={deleteLoading}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Hesabımı Kalıcı Olarak Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
