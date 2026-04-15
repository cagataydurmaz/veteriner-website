"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle, User, Stethoscope } from "lucide-react";
import type { ComplaintRow } from "./page";

type Tab = "open" | "under_review" | "resolved";

interface Props {
  complaints: ComplaintRow[];
}

const RESOLUTION_LABELS: Record<string, string> = {
  owner_wins: "Kullanıcı Haklı",
  vet_wins: "Veteriner Haklı",
  split: "Ortak Karar",
  dismissed: "Reddedildi",
};

const RESOLUTION_COLORS: Record<string, string> = {
  owner_wins: "bg-blue-100 text-blue-700",
  vet_wins: "bg-green-100 text-green-700",
  split: "bg-purple-100 text-purple-700",
  dismissed: "bg-gray-100 text-gray-600",
};

function getName(
  obj: { full_name: string } | { full_name: string }[] | null | undefined
): string {
  if (!obj) return "—";
  return Array.isArray(obj) ? (obj[0]?.full_name || "—") : obj.full_name;
}

export default function ComplaintsClient({ complaints }: Props) {
  const [tab, setTab] = useState<Tab>("open");
  const [localComplaints, setLocalComplaints] = useState<ComplaintRow[]>(complaints);
  const [loading, setLoading] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [selectedResolution, setSelectedResolution] = useState<Record<string, string>>({});

  const tabs: { key: Tab; label: string }[] = [
    { key: "open", label: "Açık" },
    { key: "under_review", label: "İnceleniyor" },
    { key: "resolved", label: "Çözüldü" },
  ];

  const visible = localComplaints.filter(c => c.status === tab);

  const handleAction = async (complaintId: string, action: string, resolution?: string) => {
    setLoading(complaintId + action);
    try {
      const res = await fetch("/api/admin/complaint-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaintId,
          action,
          resolution: resolution || selectedResolution[complaintId],
          admin_note: adminNotes[complaintId] || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");

      if (action === "set_reviewing") {
        setLocalComplaints(prev =>
          prev.map(c => c.id === complaintId ? { ...c, status: "under_review" } : c)
        );
        toast.success("İncelemeye alındı");
      } else if (action === "resolve") {
        const res = resolution || selectedResolution[complaintId];
        setLocalComplaints(prev =>
          prev.map(c =>
            c.id === complaintId
              ? {
                  ...c,
                  status: "resolved",
                  resolution: res,
                  admin_note: adminNotes[complaintId] || null,
                  resolved_at: new Date().toISOString(),
                }
              : c
          )
        );
        toast.success(`Şikayet çözüldü: ${RESOLUTION_LABELS[res] || res}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map(t => {
          const count = localComplaints.filter(c => c.status === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                tab === t.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  tab === t.key ? "bg-yellow-100 text-yellow-700" : "bg-gray-200 text-gray-600"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Complaint cards */}
      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Bu kategoride şikayet yok</p>
          </div>
        ) : (
          visible.map(complaint => {
            const apt = complaint.appointment;
            const ownerName = getName(apt?.owner as { full_name: string } | null);
            const vetName = getName(
              apt?.vet?.user as { full_name: string } | null
            );
            const isActionable = complaint.status === "open" || complaint.status === "under_review";
            const borderClass =
              complaint.status === "open"
                ? "border-yellow-200"
                : complaint.status === "under_review"
                ? "border-blue-200"
                : "border-green-200";

            return (
              <div
                key={complaint.id}
                className={`bg-white rounded-2xl border p-4 ${borderClass}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    {/* Reporter badge + reason */}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        complaint.reporter_type === "owner"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {complaint.reporter_type === "owner" ? (
                          <><User className="w-3 h-3" /> Sahip Şikayeti</>
                        ) : (
                          <><Stethoscope className="w-3 h-3" /> Veteriner Bildirimi</>
                        )}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        complaint.status === "open"
                          ? "bg-yellow-100 text-yellow-700"
                          : complaint.status === "under_review"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {complaint.status === "open" ? "Açık" : complaint.status === "under_review" ? "İnceleniyor" : "Çözüldü"}
                      </span>
                      {complaint.resolution && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RESOLUTION_COLORS[complaint.resolution] || "bg-gray-100 text-gray-600"}`}>
                          {RESOLUTION_LABELS[complaint.resolution] || complaint.resolution}
                        </span>
                      )}
                    </div>

                    {/* Şikayet Eden */}
                    <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                      <p className="text-xs font-semibold text-blue-700 mb-1">
                        {complaint.reporter_type === "owner" ? "Sahip (Şikayet Eden)" : "Veteriner (Şikayet Eden)"}
                      </p>
                      <p className="text-sm font-medium text-gray-900">{complaint.reason}</p>
                      {complaint.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-3">{complaint.description}</p>
                      )}
                    </div>

                    {/* Karşı Taraf */}
                    <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-1">
                        {complaint.reporter_type === "owner" ? "Veteriner (Karşı Taraf)" : "Sahip (Karşı Taraf)"}
                      </p>
                      <p className="text-sm text-gray-400 italic">Henüz yanıt verilmedi</p>
                    </div>

                    {/* Appointment details */}
                    {apt && (
                      <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-1">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            <span className="text-gray-400">Tarih:</span>{" "}
                            {new Date(apt.datetime).toLocaleDateString("tr-TR", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>
                            <span className="text-gray-400">Tür:</span>{" "}
                            {apt.type === "video" ? "Video" : "Yüz Yüze"}
                          </span>
                          {apt.payment_amount && (
                            <span>
                              <span className="text-gray-400">Ödeme:</span>{" "}
                              ₺{apt.payment_amount}
                              {apt.payment_status && ` (${apt.payment_status})`}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            <span className="text-gray-400">Sahip:</span> {ownerName}
                          </span>
                          <span>
                            <span className="text-gray-400">Veteriner:</span> Vet. Hek. {vetName}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Admin note display (resolved) */}
                    {complaint.admin_note && complaint.status === "resolved" && (
                      <p className="text-xs text-gray-600 bg-blue-50 px-3 py-2 rounded-lg mt-2">
                        <span className="font-medium">Admin Notu:</span> {complaint.admin_note}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(complaint.created_at).toLocaleDateString("tr-TR")}
                      {complaint.resolved_at && ` · Çözüldü: ${new Date(complaint.resolved_at).toLocaleDateString("tr-TR")}`}
                    </p>
                  </div>
                </div>

                {isActionable && (
                  <div className="space-y-3 mt-3 border-t border-gray-100 pt-3">
                    <textarea
                      placeholder="Admin notu (isteğe bağlı)..."
                      value={adminNotes[complaint.id] || ""}
                      onChange={e => setAdminNotes(prev => ({ ...prev, [complaint.id]: e.target.value }))}
                      rows={2}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#166534]/20 resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      {complaint.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 border-blue-300 text-xs h-8"
                          onClick={() => handleAction(complaint.id, "set_reviewing")}
                          disabled={loading === complaint.id + "set_reviewing"}
                        >
                          {loading === complaint.id + "set_reviewing" ? "..." : "İncelemeye Al"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                        onClick={() => handleAction(complaint.id, "resolve", "owner_wins")}
                        disabled={!!loading}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {loading === complaint.id + "resolve" ? "..." : "Kullanıcı Haklı"}
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#166534] hover:bg-[#14532D] text-white text-xs h-8"
                        onClick={() => handleAction(complaint.id, "resolve", "vet_wins")}
                        disabled={!!loading}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {loading === complaint.id + "resolve" ? "..." : "Veteriner Haklı"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-purple-600 border-purple-300 text-xs h-8"
                        onClick={() => handleAction(complaint.id, "resolve", "split")}
                        disabled={!!loading}
                      >
                        Ortak Karar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-gray-600 text-xs h-8"
                        onClick={() => handleAction(complaint.id, "resolve", "dismissed")}
                        disabled={!!loading}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Reddet
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
