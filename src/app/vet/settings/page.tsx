"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Bell, Lock, Trash2, Save, Eye, EyeOff, AlertTriangle, Loader2, CalendarCheck } from "lucide-react";

interface ApprovalSettings {
  autoApprove: boolean;
  vetId: string | null;
}

interface NotifPrefs {
  email_appointment: boolean;
  email_reminder: boolean;
  email_marketing: boolean;
}

export default function VetSettingsPage() {
  const router = useRouter();

  const [approvalSettings, setApprovalSettings] = useState<ApprovalSettings>({
    autoApprove: false,
    vetId: null,
  });
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalFetching, setApprovalFetching] = useState(true);

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    email_appointment: true,
    email_reminder: true,
    email_marketing: false,
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifFetching, setNotifFetching] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Self-deletion dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isGoogleOnly, setIsGoogleOnly] = useState(false);

  // Load notification preferences + approval settings
  useEffect(() => {
    const load = async () => {
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
        .select("notification_preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.notification_preferences) {
        setNotifPrefs({ ...notifPrefs, ...data.notification_preferences });
      }
      setNotifFetching(false);

      // Load auto-approve setting from veterinarians table
      const { data: vetData } = await supabase
        .from("veterinarians")
        .select("id, auto_approve_appointments")
        .eq("user_id", user.id)
        .maybeSingle();
      if (vetData) {
        setApprovalSettings({
          autoApprove: vetData.auto_approve_appointments ?? false,
          vetId: vetData.id,
        });
      }
      setApprovalFetching(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveApprovalSettings = async (newVal: boolean) => {
    if (!approvalSettings.vetId) return;
    // Optimistic update
    setApprovalSettings((prev) => ({ ...prev, autoApprove: newVal }));
    setApprovalLoading(true);
    try {
      const res = await fetch("/api/vet/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_approve_appointments: newVal }),
      });
      const data = await res.json() as { error?: string; message?: string };
      if (!res.ok) {
        // Rollback optimistic update
        setApprovalSettings((prev) => ({ ...prev, autoApprove: !newVal }));
        toast.error(data.error ?? "Kaydedilemedi. Tekrar deneyin.");
      } else {
        toast.success(data.message ?? (newVal ? "Otomatik onay açıldı" : "Otomatik onay kapatıldı"));
      }
    } catch {
      setApprovalSettings((prev) => ({ ...prev, autoApprove: !newVal }));
      toast.error("Bağlantı hatası — işlem geri alındı.");
    } finally {
      setApprovalLoading(false);
    }
  };

  const saveNotifPrefs = async () => {
    setNotifLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum yok");
      const { error } = await supabase
        .from("users")
        .update({ notification_preferences: notifPrefs })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Bildirim tercihleri kaydedildi");
    } catch {
      toast.error("Kaydedilemedi. Tekrar deneyin.");
    } finally {
      setNotifLoading(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Şifreler eşleşmiyor");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Şifre en az 8 karakter olmalı");
      return;
    }
    setPwLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Şifreniz güncellendi");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre güncellenemedi");
    } finally {
      setPwLoading(false);
    }
  };

  const confirmDeletion = async () => {
    if (!isGoogleOnly && !deletePassword) {
      toast.error("Şifrenizi girin");
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/vet/self-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Surface specific errors (e.g. "Şifre yanlış")
        throw new Error(data.error || "İşlem başarısız");
      }
      // Account deleted — sign out and redirect
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Hesabınız silindi. İyi günler.", { duration: 4000 });
      router.replace("/auth/vet-login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız. Tekrar deneyin.");
      setDeletePassword("");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ayarlar</h1>
        <p className="text-sm text-gray-500 mt-1">Hesap ve bildirim tercihlerinizi yönetin</p>
      </div>

      {/* Appointment Approval Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#166534]" />
            Randevu Onay Ayarları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {approvalFetching ? (
            <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Otomatik Onay</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Açıkken gelen randevu talepleri anında onaylanır. Kapalıyken her talebi manuel olarak onaylamanız gerekir.
                </p>
              </div>
              <button
                type="button"
                disabled={approvalLoading || !approvalSettings.vetId}
                onClick={() => saveApprovalSettings(!approvalSettings.autoApprove)}
                className="relative shrink-0 mt-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Otomatik onayı aç/kapat"
              >
                <div
                  className={`w-12 h-7 rounded-full transition-colors duration-200 ${
                    approvalSettings.autoApprove ? "bg-[#166534]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      approvalSettings.autoApprove ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </button>
            </div>
          )}
          {!approvalFetching && (
            <div className={`rounded-lg px-3 py-2 text-xs ${
              approvalSettings.autoApprove
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}>
              {approvalSettings.autoApprove
                ? "✓ Talepler otomatik onaylanıyor — takviminizdeki slota göre anında kesinleşir."
                : "⏳ Manuel onay modu — her randevu talebini kendiniz onaylamanız gerekiyor."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#166534]" />
            Bildirim Tercihleri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notifFetching ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {[
                { key: "email_appointment" as const, label: "Randevu onay/iptal bildirimleri", desc: "Yeni randevu, onay ve iptal e-postaları" },
                { key: "email_reminder" as const, label: "Randevu hatırlatmaları", desc: "Yaklaşan randevular için hatırlatma" },
                { key: "email_marketing" as const, label: "Haberler ve duyurular", desc: "Platform güncellemeleri ve kampanya bilgileri" },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={notifPrefs[key]}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, [key]: e.target.checked })}
                      className="sr-only"
                    />
                    <div
                      className={`w-10 h-6 rounded-full transition-colors ${
                        notifPrefs[key] ? "bg-[#166534]" : "bg-gray-200"
                      }`}
                      onClick={() => setNotifPrefs({ ...notifPrefs, [key]: !notifPrefs[key] })}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                          notifPrefs[key] ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
              <Button
                size="sm"
                onClick={saveNotifPrefs}
                loading={notifLoading}
                className="mt-2"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Kaydet
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#166534]" />
            Şifre Değiştir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Yeni Şifre</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 8 karakter"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Yeni Şifre (Tekrar)</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Şifreyi tekrar girin"
            />
          </div>
          <Button
            size="sm"
            onClick={changePassword}
            disabled={!newPassword || !confirmPassword}
            loading={pwLoading}
          >
            {pwLoading && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Şifreyi Güncelle
          </Button>
        </CardContent>
      </Card>

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
            {/* Warning box */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">
                Bu işlem geri alınamaz.
              </p>
              <p className="text-sm text-red-700">
                Tüm verileriniz silinecek. Gelecekteki tüm randevularınız iptal edilecek.
                Randevu geçmişi yasal zorunluluk gereği saklanmaya devam eder.
              </p>
            </div>

            {/* Password confirmation — only for email+password users */}
            {!isGoogleOnly && (
              <div className="space-y-2">
                <Label htmlFor="delete-password" className="text-sm font-medium text-gray-700">
                  Devam etmek için şifrenizi girin
                </Label>
                <div className="relative">
                  <Input
                    id="delete-password"
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
                    {showDeletePassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeletePassword("");
              }}
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
