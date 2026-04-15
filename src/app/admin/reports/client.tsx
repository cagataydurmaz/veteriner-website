"use client";

import { useState } from "react";
import { Flag, AlertTriangle, Shield, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const REASON_LABELS: Record<string, string> = {
  platform_disina_yonlendirdi: "Platform dışına yönlendirdi",
  iletisim_bilgisi_paylasti: "İletişim bilgisi paylaştı",
  uygunsuz_davranis: "Uygunsuz davranış",
  diger: "Diğer",
};

const FLAG_LABELS: Record<string, string> = {
  repeated_cancellations_pair: "Tekrarlı İptal (Aynı Çift)",
  high_cancellation_rate: "Yüksek İptal Oranı >%30",
  no_completions_30days: "30 Günde Tamamlama Yok",
};

const BLOCK_LABELS: Record<string, string> = {
  phone_number: "Telefon Numarası",
  email_address: "E-posta Adresi",
  social_media: "Sosyal Medya",
  circumvention_keyword: "Platform Dışı Anahtar Kelime",
};

export type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter: { full_name: string } | { full_name: string }[] | null;
  vet: { id: string; specialty: string; user: { full_name: string } | { full_name: string }[] | null } | null;
};

export type FraudFlag = {
  id: string;
  flag_type: string;
  details: Record<string, unknown>;
  is_resolved: boolean;
  created_at: string;
  vet: { id: string; specialty: string; user: { full_name: string } | { full_name: string }[] | null } | null;
};

type BlockedMessage = {
  id: string;
  block_reason: string;
  created_at: string;
  sender: { full_name: string } | { full_name: string }[] | null;
};

interface Props {
  reports: Report[];
  flags: FraudFlag[];
  blockedMessages: BlockedMessage[];
}

function getName(obj: { full_name: string } | { full_name: string }[] | null): string {
  if (!obj) return "—";
  return Array.isArray(obj) ? obj[0]?.full_name || "—" : obj.full_name;
}

export default function AdminReportsClient({ reports, flags, blockedMessages }: Props) {
  const [tab, setTab] = useState<"reports" | "flags" | "blocked">("reports");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (reportId: string, action: "warn_suspend" | "ban" | "dismiss") => {
    setActionLoading(reportId + action);
    try {
      const res = await fetch("/api/admin/report-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      // Refresh
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setActionLoading(null);
    }
  };

  const TABS = [
    { key: "reports" as const, label: "İhlal Raporları", count: reports.filter(r => r.status === "pending").length },
    { key: "flags" as const, label: "Şüpheli Davranış", count: flags.filter(f => !f.is_resolved).length },
    { key: "blocked" as const, label: "Engellenen Mesajlar", count: blockedMessages.length },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              tab === t.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === t.key ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-600"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reports tab */}
      {tab === "reports" && (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <Flag className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Henüz rapor yok</p>
            </div>
          ) : reports.map(report => (
            <div key={report.id} className={`bg-white rounded-2xl border p-4 ${report.status === "pending" ? "border-red-200" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Flag className="w-4 h-4 text-red-500" />
                    <span className="font-semibold text-gray-900 text-sm">{REASON_LABELS[report.reason] || report.reason}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      report.status === "pending" ? "bg-red-100 text-red-700" :
                      report.status === "actioned" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {report.status === "pending" ? "Bekliyor" : report.status === "actioned" ? "İşlendi" : report.status === "dismissed" ? "Reddedildi" : report.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Şikayet eden: <strong>{getName(report.reporter)}</strong>
                    {" · "}Veteriner: <strong>Vet. Hek. {getName(report.vet?.user || null)}</strong>
                    {" · "}{new Date(report.created_at).toLocaleDateString("tr-TR")}
                  </p>
                  {report.details && (
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 px-3 py-2 rounded-lg">"{report.details}"</p>
                  )}
                </div>
              </div>

              {report.status === "pending" && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8"
                    onClick={() => handleAction(report.id, "warn_suspend")}
                    disabled={!!actionLoading}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" /> Uyar + Askıya Al (7 gün)
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white text-xs h-8"
                    onClick={() => handleAction(report.id, "ban")}
                    disabled={!!actionLoading}
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Kalıcı Kapat
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 text-gray-500"
                    onClick={() => handleAction(report.id, "dismiss")}
                    disabled={!!actionLoading}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Reddet
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Flags tab */}
      {tab === "flags" && (
        <div className="space-y-3">
          {flags.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <AlertTriangle className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Şüpheli davranış bayrağı yok</p>
            </div>
          ) : flags.map(flag => (
            <div key={flag.id} className={`bg-white rounded-2xl border p-4 ${flag.is_resolved ? "border-gray-200 opacity-60" : "border-amber-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-4 h-4 ${flag.is_resolved ? "text-gray-400" : "text-amber-500"}`} />
                <span className="font-semibold text-gray-900 text-sm">{FLAG_LABELS[flag.flag_type] || flag.flag_type}</span>
                {flag.is_resolved && <Badge variant="secondary" className="text-xs">Çözüldü</Badge>}
              </div>
              <p className="text-xs text-gray-500 mb-1">
                Veteriner: <strong>Vet. Hek. {getName(flag.vet?.user || null)}</strong>
                {" · "}{new Date(flag.created_at).toLocaleDateString("tr-TR")}
              </p>
              {Object.keys(flag.details || {}).length > 0 && (
                <p className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                  {Object.entries(flag.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Blocked messages tab */}
      {tab === "blocked" && (
        <div className="space-y-3">
          {blockedMessages.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <Shield className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Engellenen mesaj yok</p>
            </div>
          ) : blockedMessages.map(msg => (
            <div key={msg.id} className="bg-white rounded-2xl border border-blue-100 p-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-900">
                  {BLOCK_LABELS[msg.block_reason] || msg.block_reason}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(msg.created_at).toLocaleDateString("tr-TR")}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Gönderen: {getName(msg.sender)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
