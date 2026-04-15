"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import AccountStatusBadge from "@/components/ui/AccountStatusBadge";
import {
  CheckCircle,
  XCircle,
  Eye,
  Search,
  Star,
  FileText,
  ExternalLink,
  ShieldCheck,
  Shield,
  Clock,
} from "lucide-react";

export interface Vet {
  id: string;
  user: {
    full_name: string;
    email: string;
    phone: string | null;
    city: string | null;
    created_at: string;
  };
  chamber_number: string | null;
  sicil_no: string | null;
  oda_verified: boolean;
  oda_verified_at: string | null;
  license_number: string;
  specialty: string;
  bio: string | null;
  education: string | null;
  city: string;
  district: string | null;
  subscription_tier: string;
  is_verified: boolean;
  average_rating: number;
  total_reviews: number;
  consultation_fee: number;
  video_consultation_fee: number | null;
  offers_video: boolean;
  offers_in_person: boolean;
  license_document_url: string | null;
  rejection_reason: string | null;
  is_banned?: boolean;
  suspension_until?: string | null;
  admin_note?: string | null;
  account_status?: string | null;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  banned_reason?: string | null;
  is_demo?: boolean;
}

// Predefined rejection reason templates
const REJECT_TEMPLATES = [
  { label: "Diploma okunamıyor", value: "Yüklediğiniz diploma belgesi net değil veya okunamıyor. Lütfen daha yüksek çözünürlüklü bir görsel yükleyin." },
  { label: "Lisans numarası hatalı", value: "Girdiğiniz lisans numarası TVHB kayıtlarıyla eşleşmiyor. Lütfen lisans numaranızı kontrol edip tekrar başvurun." },
  { label: "TVHB kaydı bulunamadı", value: "Türkiye Veteriner Hekimler Birliği kayıtlarında belirttiğiniz sicil numarasına ait kayıt bulunamadı. Sicil numaranızı kontrol edin." },
  { label: "Eksik belge", value: "Başvurunuz için gerekli belgeler eksik. Diploma ve lisans belgenizi eksiksiz yükleyerek tekrar başvurun." },
  { label: "Profil bilgileri yetersiz", value: "Profilinizde uzmanlık alanı, biyografi veya eğitim bilgileri eksik. Lütfen profilinizi tamamlayarak tekrar başvurun." },
  { label: "Sahte/geçersiz belge şüphesi", value: "Yüklediğiniz belgeler doğrulanamadı. Lütfen resmi kurumlardan onaylı belgelerinizi yükleyin veya destek ekibimizle iletişime geçin." },
];

type TabType = "pending" | "all" | "verified";

interface VetManagementTableProps {
  initialVets: Vet[];
  pendingCount?: number;
}

export default function VetManagementTable({ initialVets, pendingCount = 0 }: VetManagementTableProps) {
  const router = useRouter();
  const [vets, setVets] = useState<Vet[]>(initialVets);
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [search, setSearch] = useState("");
  const [selectedVet, setSelectedVet] = useState<Vet | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [diplomaUrl, setDiplomaUrl] = useState<string | null>(null);
  const [suspendDays, setSuspendDays] = useState("7");
  const [suspendReason, setSuspendReason] = useState("");
  const [banReason, setBanReason] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<Array<{
    id: string;
    created_at: string;
    old_status: string | null;
    new_status: string | null;
    reason: string | null;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const pendingVets = vets.filter((v) => !v.is_verified && v.account_status !== "deleted");
  const verifiedVets = vets.filter((v) => v.is_verified);
  const allActiveVets = vets.filter((v) => v.account_status !== "deleted");

  const sourceList =
    activeTab === "pending" ? pendingVets :
    activeTab === "verified" ? verifiedVets :
    allActiveVets;

  const filteredVets = sourceList.filter((vet) =>
    !search ||
    vet.user?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    vet.city?.toLowerCase().includes(search.toLowerCase()) ||
    vet.user?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleViewDetails = async (vet: Vet) => {
    setSelectedVet(vet);
    setShowDetails(true);
    setAdminNote(vet.admin_note || "");
    setSuspendReason(vet.suspension_reason || "");
    setBanReason(vet.banned_reason || "");
    setShowHistory(false);
    setHistoryLogs([]);
    setDiplomaUrl(null);
    if (vet.license_document_url) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.storage
          .from("license-documents")
          .createSignedUrl(vet.license_document_url, 3600);
        if (error) console.warn("Signed URL error:", error.message);
        setDiplomaUrl(data?.signedUrl || null);
      } catch (err) {
        console.warn("Could not load diploma URL:", err);
      }
    }
  };

  const handleShowHistory = async (vet: Vet) => {
    if (!vet.user) return;
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/status-logs?userId=${encodeURIComponent(vet.id)}&userType=vet`);
      if (res.ok) {
        const json = await res.json();
        setHistoryLogs(json.logs ?? []);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleVetAction = async (action: string, extraPayload?: Record<string, unknown>) => {
    if (!selectedVet) return;
    setActionLoading(action);
    try {
      let body: Record<string, unknown> = { vetId: selectedVet.id, action };
      if (action === "set_status") {
        body = { ...body, ...extraPayload };
      } else if (action === "set_admin_note") {
        body.admin_note = adminNote;
      }

      const res = await fetch("/api/admin/vet-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("İşlem başarısız");

      if (action === "set_status" && extraPayload) {
        const newStatus = extraPayload.account_status as string;
        let updatedVet = { ...selectedVet, account_status: newStatus };
        if (newStatus === "suspended") {
          const until = new Date();
          until.setDate(until.getDate() + Number(suspendDays));
          updatedVet = { ...updatedVet, suspended_until: until.toISOString(), suspension_reason: suspendReason || null, banned_reason: null };
        } else if (newStatus === "banned") {
          updatedVet = { ...updatedVet, suspended_until: null, suspension_reason: null, banned_reason: banReason || null };
        } else if (newStatus === "active") {
          updatedVet = { ...updatedVet, suspended_until: null, suspension_reason: null, banned_reason: null };
        }
        setSelectedVet(updatedVet);
        setVets((v) => v.map((vet) => (vet.id === selectedVet.id ? updatedVet : vet)));
        const labels: Record<string, string> = {
          active: "Hesap aktif edildi", under_review: "İncelemeye alındı",
          suspended: `${suspendDays} gün askıya alındı`, banned: "Kalıcı ban uygulandı", deleted: "Hesap silindi",
        };
        toast.success(labels[newStatus] || "İşlem tamamlandı");
      } else if (action === "set_admin_note") {
        toast.success("Not kaydedildi");
      } else if (action === "delete_account") {
        setVets((v) => v.map((vet) => vet.id === selectedVet.id ? { ...vet, account_status: "deleted" } : vet));
        toast.success("Hesap silindi (KVKK)");
        setShowDetails(false);
      }
    } catch {
      toast.error("İşlem başarısız");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (vetId: string) => {
    setLoading(vetId);
    try {
      const res = await fetch("/api/admin/vet-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vetId, action: "approve_vet" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Onaylama başarısız");
      setVets((v) => v.map((vet) => (vet.id === vetId ? { ...vet, is_verified: true } : vet)));
      toast.success("Veteriner onaylandı, bildirim emaili gönderildi");
      setShowDetails(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onaylama başarısız");
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedVet || !rejectReason) return;
    setLoading(selectedVet.id);
    try {
      const res = await fetch("/api/admin/vet-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vetId: selectedVet.id, action: "reject_vet", reject_reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Red işlemi başarısız");
      setVets((v) => v.map((vet) => (vet.id === selectedVet.id ? { ...vet, is_verified: false } : vet)));
      toast.success("Veteriner reddedildi, bildirim emaili gönderildi");
      setShowReject(false);
      setShowDetails(false);
      setRejectReason("");
      setSelectedTemplate("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setLoading(null);
    }
  };

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "pending", label: "Bekleyen Başvurular", count: pendingVets.length },
    { key: "verified", label: "Onaylı", count: verifiedVets.length },
    { key: "all", label: "Tümü", count: allActiveVets.length },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.key === "pending" && <Clock className="w-3.5 h-3.5" />}
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                tab.key === "pending" && tab.count > 0
                  ? "bg-amber-500 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="İsim, e-posta veya şehir ara..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Pending tab — application cards */}
      {activeTab === "pending" && (
        <div className="space-y-3">
          {filteredVets.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">Bekleyen başvuru yok</p>
              <p className="text-xs text-gray-400 mt-1">Tüm başvurular işlendi</p>
            </div>
          )}
          {filteredVets.map((vet) => (
            <div key={vet.id} className="bg-white rounded-xl border border-amber-200 p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">Vet. Hek. {vet.user?.full_name}</p>
                    <AccountStatusBadge status={vet.account_status} />
                    {vet.oda_verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                        <ShieldCheck className="w-2.5 h-2.5" /> Oda Kayıtlı
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{vet.user?.email} · {vet.user?.phone || "Telefon yok"}</p>
                  <p className="text-xs text-gray-400">Başvuru: {formatDate(vet.user?.created_at)}</p>
                </div>
                <button
                  onClick={() => handleViewDetails(vet)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                  title="Detayları Gör"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              {/* Application details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Uzmanlık</p>
                  <p className="text-gray-800 font-medium">{vet.specialty || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Şehir</p>
                  <p className="text-gray-800 font-medium">{vet.city}{vet.district ? ` / ${vet.district}` : ""}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">TVHB No</p>
                  <p className="text-gray-800 font-mono font-medium">{vet.chamber_number || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Sicil No</p>
                  <p className="text-gray-800 font-mono font-medium">{vet.sicil_no || "—"}</p>
                </div>
              </div>

              {/* Bio */}
              {vet.bio && (
                <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="font-medium text-gray-700 mb-1">Biyografi</p>
                  <p className="leading-relaxed line-clamp-3">{vet.bio}</p>
                </div>
              )}

              {/* Education */}
              {vet.education && (
                <div className="text-xs text-gray-600 bg-purple-50 border border-purple-100 rounded-lg p-3">
                  <p className="font-medium text-gray-700 mb-1">Eğitim</p>
                  <p className="leading-relaxed">{vet.education}</p>
                </div>
              )}

              {/* Services + Fees */}
              <div className="flex flex-wrap gap-2 text-xs">
                {vet.offers_in_person && (
                  <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg">
                    Yüz yüze — ₺{vet.consultation_fee ?? "—"}
                  </span>
                )}
                {vet.offers_video && (
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">
                    Video — ₺{vet.video_consultation_fee ?? vet.consultation_fee ?? "—"}
                  </span>
                )}
                {vet.license_document_url ? (
                  <span className="bg-gray-50 text-gray-600 border border-gray-200 px-2 py-1 rounded-lg flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Belge yüklendi
                  </span>
                ) : (
                  <span className="bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-lg flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Belge yok
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => { setSelectedVet(vet); setShowReject(true); }}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reddet
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(vet.id)}
                  disabled={loading === vet.id}
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  {loading === vet.id ? "..." : "Onayla"}
                </Button>
              </div>

              {/* Previous rejection reason */}
              {vet.rejection_reason && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                  <span className="font-medium">Önceki red:</span> {vet.rejection_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Verified / All tab — table */}
      {(activeTab === "verified" || activeTab === "all") && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Veteriner</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Şehir</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Durum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Puan</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVets.map((vet) => (
                  <tr key={vet.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-sm text-gray-900">Vet. Hek. {vet.user?.full_name}</p>
                          {vet.is_verified && <ShieldCheck className="w-3.5 h-3.5 text-[#166534]" />}
                          {vet.is_demo && (
                            <span className="inline-flex items-center text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Demo</span>
                          )}
                          <AccountStatusBadge status={vet.account_status} />
                        </div>
                        <p className="text-xs text-gray-500">{vet.specialty}</p>
                        <p className="text-xs text-gray-400">{vet.user?.email}</p>
                        {vet.chamber_number && <p className="text-xs text-gray-400">TVHB: {vet.chamber_number}</p>}
                        {vet.oda_verified && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                            <ShieldCheck className="w-2.5 h-2.5" /> Oda Kayıtlı
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-sm text-gray-700">{vet.city}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge
                        variant={vet.subscription_tier === "premium" ? "default" : vet.subscription_tier === "pro" ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {vet.subscription_tier?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={vet.is_verified ? "success" : "warning"} className="text-xs">
                        {vet.is_verified ? "Doğrulanmış" : "Beklemede"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {vet.average_rating > 0 ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm">{vet.average_rating?.toFixed(1)}</span>
                          <span className="text-xs text-gray-400">({vet.total_reviews})</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Yeni</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewDetails(vet)}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="Detaylar"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {!vet.is_verified && (
                          <>
                            <button
                              onClick={() => handleApprove(vet.id)}
                              disabled={loading === vet.id}
                              className="p-1.5 hover:bg-green-50 rounded transition-colors"
                              title="Onayla"
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              onClick={() => { setSelectedVet(vet); setShowReject(true); }}
                              className="p-1.5 hover:bg-red-50 rounded transition-colors"
                              title="Reddet"
                            >
                              <XCircle className="w-4 h-4 text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-sm text-gray-500">
                      Veteriner bulunamadı
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Veteriner Detayları</DialogTitle>
          </DialogHeader>
          {selectedVet && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Ad Soyad</p>
                  <p className="font-medium">Vet. Hek. {selectedVet.user?.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">E-posta</p>
                  <p className="font-medium">{selectedVet.user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">TVHB Üye No</p>
                  <p className="font-medium font-mono">{selectedVet.chamber_number || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Lisans No</p>
                  <p className="font-medium font-mono">{selectedVet.license_number}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Oda Sicil No</p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium font-mono">{selectedVet.sicil_no || "—"}</p>
                    {selectedVet.oda_verified && (
                      <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5" /> Doğrulandı
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Oda Doğrulama</p>
                  {selectedVet.oda_verified ? (
                    <p className="text-xs text-blue-600">{selectedVet.oda_verified_at ? formatDate(selectedVet.oda_verified_at) : "Doğrulandı"}</p>
                  ) : (
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/admin/vet-action", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ vetId: selectedVet.id, action: "verify_oda" }),
                        });
                        if (!res.ok) { toast.error("ODA doğrulaması başarısız"); return; }
                        const now = new Date().toISOString();
                        setVets(v => v.map(vet => vet.id === selectedVet.id ? { ...vet, oda_verified: true, oda_verified_at: now } : vet));
                        setSelectedVet({ ...selectedVet, oda_verified: true, oda_verified_at: now });
                        toast.success("Oda kaydı doğrulandı");
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Oda Kayıtlı Olarak İşaretle
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Uzmanlık</p>
                  <p className="font-medium">{selectedVet.specialty}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Şehir / İlçe</p>
                  <p className="font-medium">{selectedVet.city}{selectedVet.district ? ` / ${selectedVet.district}` : ""}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Muayene Ücreti</p>
                  <p className="font-medium">₺{selectedVet.consultation_fee}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Başvuru Tarihi</p>
                  <p className="font-medium">{formatDate(selectedVet.user?.created_at)}</p>
                </div>
              </div>

              {/* Bio */}
              {selectedVet.bio && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Biyografi</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{selectedVet.bio}</p>
                </div>
              )}

              {/* Education */}
              {selectedVet.education && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Eğitim</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{selectedVet.education}</p>
                </div>
              )}

              {/* Diploma Document */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <p className="text-sm font-medium">Diploma / Mezuniyet Belgesi</p>
                </div>
                {diplomaUrl ? (
                  <a href={diplomaUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-[#166534] hover:underline">
                    <ExternalLink className="w-4 h-4" />
                    Belgeyi Görüntüle / İndir
                  </a>
                ) : selectedVet.license_document_url ? (
                  <p className="text-xs text-gray-400">Belge yükleniyor...</p>
                ) : (
                  <p className="text-xs text-red-500">Diploma belgesi yüklenmemiş</p>
                )}
              </div>

              {!selectedVet.is_verified && (
                <div className="flex gap-3 pt-2">
                  <Button variant="destructive" className="flex-1" onClick={() => { setShowDetails(false); setShowReject(true); }}>
                    <XCircle className="w-4 h-4 mr-1.5" /> Reddet
                  </Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(selectedVet.id)}
                    disabled={loading === selectedVet.id}>
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    {loading === selectedVet.id ? "..." : "Onayla ve Yayınla"}
                  </Button>
                </div>
              )}
              {selectedVet.is_verified && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-700 font-medium">Doğrulanmış Veteriner</p>
                </div>
              )}

              {/* Yaptırımlar */}
              <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Yaptırımlar
                  </p>
                  <AccountStatusBadge status={selectedVet.account_status} />
                </div>
                {selectedVet.account_status === "suspended" && selectedVet.suspended_until && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                    Askıda — {new Date(selectedVet.suspended_until).toLocaleDateString("tr-TR")} tarihine kadar
                    {selectedVet.suspension_reason && <span className="block mt-0.5">Sebep: {selectedVet.suspension_reason}</span>}
                  </div>
                )}
                {selectedVet.account_status === "banned" && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800 font-semibold">
                    Kalıcı Olarak Yasaklandı
                    {selectedVet.banned_reason && <span className="font-normal block mt-0.5">Sebep: {selectedVet.banned_reason}</span>}
                  </div>
                )}
                <Button size="sm" variant="outline" className="text-green-600 border-green-300 text-xs h-8 w-full"
                  onClick={() => handleVetAction("set_status", { account_status: "active" })}
                  disabled={actionLoading === "set_status" || selectedVet.account_status === "active"}>
                  {actionLoading === "set_status" ? "..." : "Aktif Yap"}
                </Button>
                <Button size="sm" variant="outline" className="text-yellow-600 border-yellow-300 text-xs h-8 w-full"
                  onClick={() => handleVetAction("set_status", { account_status: "under_review" })}
                  disabled={actionLoading === "set_status" || selectedVet.account_status === "under_review"}>
                  {actionLoading === "set_status" ? "..." : "İncelemeye Al"}
                </Button>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-700">Geçici Askıya Al</p>
                  <div className="flex gap-2">
                    <select value={suspendDays} onChange={(e) => setSuspendDays(e.target.value)}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
                      <option value="1">1 Gün</option>
                      <option value="7">7 Gün</option>
                      <option value="30">30 Gün</option>
                    </select>
                    <Button size="sm" variant="outline" className="text-amber-600 border-amber-300 text-xs h-8 flex-1"
                      onClick={() => {
                        const until = new Date();
                        until.setDate(until.getDate() + Number(suspendDays));
                        handleVetAction("set_status", { account_status: "suspended", suspended_until: until.toISOString(), suspension_reason: suspendReason || null });
                      }}
                      disabled={actionLoading === "set_status"}>
                      {actionLoading === "set_status" ? "..." : "Askıya Al"}
                    </Button>
                  </div>
                  <textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} rows={2}
                    className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 resize-none focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    placeholder="Askı sebebi (isteğe bağlı)..." />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-700">Kalıcı Banla</p>
                  <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} rows={2}
                    className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 resize-none focus:ring-2 focus:ring-red-400 focus:outline-none"
                    placeholder="Ban sebebi (zorunlu)..." />
                  <Button size="sm" variant="destructive" className="text-xs h-8 w-full"
                    onClick={() => handleVetAction("set_status", { account_status: "banned", banned_reason: banReason || null })}
                    disabled={actionLoading === "set_status" || !banReason}>
                    {actionLoading === "set_status" ? "..." : "Kalıcı Banla"}
                  </Button>
                </div>
                <Button size="sm" variant="outline" className="text-red-600 border-red-300 text-xs h-8 w-full"
                  onClick={() => {
                    if (confirm("Bu hesabı KVKK kapsamında silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) {
                      handleVetAction("delete_account");
                    }
                  }}
                  disabled={actionLoading === "delete_account"}>
                  {actionLoading === "delete_account" ? "..." : "Hesabı Sil (KVKK)"}
                </Button>
              </div>

              {/* Admin Notes */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Admin Notu (gizli)</label>
                <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-[#166534] focus:outline-none"
                  placeholder="Sadece adminler görebilir..." />
                <Button size="sm" variant="outline" className="text-xs h-8"
                  onClick={() => handleVetAction("set_admin_note")}
                  disabled={actionLoading === "set_admin_note"}>
                  {actionLoading === "set_admin_note" ? "Kaydediliyor..." : "Notu Kaydet"}
                </Button>
              </div>

              {/* Status History */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">Durum Geçmişi</p>
                  {!showHistory && (
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2"
                      onClick={() => handleShowHistory(selectedVet)}>
                      Geçmişi Göster
                    </Button>
                  )}
                </div>
                {showHistory && (
                  historyLoading ? (
                    <p className="text-xs text-gray-500">Yükleniyor...</p>
                  ) : historyLogs.length === 0 ? (
                    <p className="text-xs text-gray-400">Kayıt yok</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {historyLogs.map((log) => (
                        <div key={log.id} className="text-xs border border-gray-100 rounded p-2 bg-gray-50">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-gray-500">{new Date(log.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}</span>
                            <span className="font-medium text-gray-700">{log.old_status ?? "—"} → {log.new_status ?? "—"}</span>
                          </div>
                          {log.reason && <p className="text-gray-500 mt-0.5">Sebep: {log.reason}</p>}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog — with templates */}
      <Dialog open={showReject} onOpenChange={(open) => { setShowReject(open); if (!open) { setRejectReason(""); setSelectedTemplate(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Başvuruyu Reddet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Vet. Hek. {selectedVet?.user?.full_name}</span> başvurusu reddedilecek.
              Red nedeni email ile bildirilecektir.
            </p>

            {/* Template selector */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Hazır Şablonlar
              </label>
              <div className="space-y-2">
                {REJECT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => {
                      setSelectedTemplate(tpl.label);
                      setRejectReason(tpl.value);
                    }}
                    className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                      selectedTemplate === tpl.label
                        ? "border-red-400 bg-red-50 text-red-700 font-medium"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {selectedTemplate === tpl.label ? "✓ " : ""}{tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom reason textarea */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Red Nedeni <span className="text-red-500">*</span>
                {selectedTemplate && (
                  <span className="text-xs text-gray-400 font-normal ml-2">(şablondan dolduruldu, düzenleyebilirsin)</span>
                )}
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 p-3 text-sm resize-none focus:ring-2 focus:ring-[#166534] focus:outline-none"
                rows={4}
                placeholder="Ör: Diploma belgesi okunamıyor, lütfen daha net bir görsel yükleyin..."
                value={rejectReason}
                onChange={(e) => { setRejectReason(e.target.value); setSelectedTemplate(""); }}
              />
              <p className="text-xs text-gray-400 mt-1">{rejectReason.length} karakter — bu metin veterinere email olarak gönderilecek</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReject(false); setRejectReason(""); setSelectedTemplate(""); }}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || loading === selectedVet?.id}>
              {loading === selectedVet?.id ? "Gönderiliyor..." : "Reddet ve Bildir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
