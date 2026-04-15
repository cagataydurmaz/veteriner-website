"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AccountStatusBadge from "@/components/ui/AccountStatusBadge";
import { Search, ArrowUpDown, User, PawPrint, Calendar, MapPin, Shield, Ban, Trash2 } from "lucide-react";

type OwnerRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  created_at: string;
  pet_count: number;
  appointment_count: number;
  account_status?: string | null;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  banned_reason?: string | null;
};

type SortKey = "created_at" | "appointment_count" | "pet_count";

interface Props {
  owners: OwnerRow[];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function OwnersTable({ owners }: Props) {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  // Detail dialog state
  const [selectedOwner, setSelectedOwner] = useState<OwnerRow | null>(null);
  const [showOwnerDetail, setShowOwnerDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [suspendDays, setSuspendDays] = useState("1");
  const [suspendReason, setSuspendReason] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [banReason, setBanReason] = useState("");

  // Local owners state for immediate UI updates
  const [localOwners, setLocalOwners] = useState<OwnerRow[]>(owners);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<Array<{
    id: string;
    created_at: string;
    old_status: string | null;
    new_status: string | null;
    reason: string | null;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleShowHistory = async (owner: OwnerRow) => {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/status-logs?userId=${encodeURIComponent(owner.id)}&userType=owner`);
      if (!res.ok) {
        toast.error("Geçmiş yüklenemedi");
      } else {
        const json = await res.json();
        setHistoryLogs(json.logs ?? []);
      }
    } catch {
      toast.error("Geçmiş yüklenemedi");
    } finally {
      setHistoryLoading(false);
    }
  };

  const cities = useMemo(() => {
    const set = new Set<string>();
    localOwners.forEach((o) => {
      if (o.city) set.add(o.city);
    });
    return Array.from(set).sort();
  }, [localOwners]);

  const filtered = useMemo(() => {
    let list = localOwners;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.full_name.toLowerCase().includes(q) ||
          (o.email || "").toLowerCase().includes(q)
      );
    }
    if (cityFilter !== "all") {
      list = list.filter((o) => o.city === cityFilter);
    }
    list = [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === "created_at") {
        diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortKey === "appointment_count") {
        diff = a.appointment_count - b.appointment_count;
      } else {
        diff = a.pet_count - b.pet_count;
      }
      return sortAsc ? diff : -diff;
    });
    return list;
  }, [localOwners, search, cityFilter, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleOwnerAction = async (action: string, extraPayload?: Record<string, unknown>) => {
    if (!selectedOwner) return;
    setActionLoading(action);
    try {
      let body: Record<string, unknown> = { ownerId: selectedOwner.id, action };

      if (action === "set_status") {
        body = { ...body, ...extraPayload };
      } else if (action === "set_admin_note") {
        body.admin_note = adminNote;
      } else if (action === "delete_account") {
        // no extra payload
      }

      const res = await fetch("/api/admin/owner-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("İşlem başarısız");

      if (action === "set_status" && extraPayload) {
        const newStatus = extraPayload.account_status as string;
        let updatedOwner = { ...selectedOwner, account_status: newStatus };
        if (newStatus === "suspended") {
          const until = new Date();
          until.setDate(until.getDate() + Number(suspendDays));
          updatedOwner = {
            ...updatedOwner,
            suspended_until: until.toISOString(),
            suspension_reason: suspendReason || null,
            banned_reason: null,
          };
        } else if (newStatus === "banned") {
          updatedOwner = {
            ...updatedOwner,
            suspended_until: null,
            suspension_reason: null,
            banned_reason: banReason || null,
          };
        } else if (newStatus === "active") {
          updatedOwner = {
            ...updatedOwner,
            suspended_until: null,
            suspension_reason: null,
            banned_reason: null,
          };
        }
        setSelectedOwner(updatedOwner);
        setLocalOwners((prev) =>
          prev.map((o) => (o.id === selectedOwner.id ? updatedOwner : o))
        );

        const statusLabels: Record<string, string> = {
          active: "Hesap aktif edildi",
          under_review: "Hesap incelemeye alındı",
          suspended: `Hesap ${suspendDays} gün askıya alındı`,
          banned: "Hesap kalıcı olarak yasaklandı",
          deleted: "Hesap silindi",
        };
        toast.success(statusLabels[newStatus] || "İşlem tamamlandı");
      } else if (action === "delete_account") {
        toast.success("Hesap silindi (KVKK)");
        setLocalOwners((prev) =>
          prev.map((o) =>
            o.id === selectedOwner.id ? { ...o, account_status: "deleted" } : o
          )
        );
        setShowOwnerDetail(false);
      } else if (action === "set_admin_note") {
        toast.success("Not kaydedildi");
      }
    } catch {
      toast.error("İşlem başarısız");
    } finally {
      setActionLoading(null);
    }
  };

  const SortBtn = ({ field, label }: { field: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
    >
      {label}
      <ArrowUpDown
        className={`w-3 h-3 ${sortKey === field ? "text-[#166534]" : "text-gray-400"}`}
      />
    </button>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-base">Sahip Listesi ({filtered.length})</CardTitle>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ad veya e-posta ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20"
                />
              </div>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#166534]/20 bg-white"
              >
                <option value="all">Tüm Şehirler</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Sahip
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Şehir
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <SortBtn field="pet_count" label="Hayvan" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <SortBtn field="appointment_count" label="Randevu" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">
                    <SortBtn field="created_at" label="Kayıt Tarihi" />
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-sm text-gray-500">
                      <User className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      Hayvan sahibi bulunamadı
                    </td>
                  </tr>
                ) : (
                  filtered.map((owner) => (
                    <tr key={owner.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(owner.full_name)}`}
                          >
                            {getInitials(owner.full_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {owner.full_name}
                              </p>
                              <AccountStatusBadge status={owner.account_status} />
                            </div>
                            <p className="text-xs text-gray-400 truncate">
                              {owner.email || owner.phone || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-600">{owner.city || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm">
                          <PawPrint className="w-3.5 h-3.5 text-orange-500" />
                          <span className="font-medium text-gray-900">{owner.pet_count}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-medium text-gray-900">{owner.appointment_count}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                        {new Date(owner.created_at).toLocaleDateString("tr-TR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 px-3"
                          onClick={() => {
                            setSelectedOwner(owner);
                            setShowOwnerDetail(true);
                            setAdminNote("");
                            setBanReason("");
                            setSuspendReason(owner.suspension_reason || "");
                            setShowHistory(false);
                            setHistoryLogs([]);
                          }}
                        >
                          Detay
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Owner Detail Dialog */}
      <Dialog open={showOwnerDetail} onOpenChange={setShowOwnerDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Sahip Detayı
            </DialogTitle>
          </DialogHeader>
          {selectedOwner && (
            <div className="space-y-4">
              {/* Owner info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Ad Soyad</p>
                  <p className="font-medium">{selectedOwner.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">E-posta</p>
                  <p className="font-medium">{selectedOwner.email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Telefon</p>
                  <p className="font-medium">{selectedOwner.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Şehir</p>
                  <p className="font-medium">{selectedOwner.city || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Kayıt Tarihi</p>
                  <p className="font-medium">
                    {new Date(selectedOwner.created_at).toLocaleDateString("tr-TR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Evcil Hayvan / Randevu</p>
                  <p className="font-medium">
                    {selectedOwner.pet_count} hayvan · {selectedOwner.appointment_count} randevu
                  </p>
                </div>
              </div>

              {/* Actions section */}
              <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Yaptırımlar
                  </p>
                  <AccountStatusBadge status={selectedOwner.account_status} />
                </div>

                {selectedOwner.account_status === "suspended" && selectedOwner.suspended_until && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                    Askıda — {new Date(selectedOwner.suspended_until).toLocaleDateString("tr-TR")} tarihine kadar
                    {selectedOwner.suspension_reason && (
                      <span className="block mt-0.5">Sebep: {selectedOwner.suspension_reason}</span>
                    )}
                  </div>
                )}
                {selectedOwner.account_status === "banned" && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800 font-semibold">
                    Kalıcı Olarak Yasaklandı
                    {selectedOwner.banned_reason && (
                      <span className="font-normal block mt-0.5">Sebep: {selectedOwner.banned_reason}</span>
                    )}
                  </div>
                )}

                {/* Aktif Yap */}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-300 text-xs h-8 w-full"
                  onClick={() =>
                    handleOwnerAction("set_status", { account_status: "active" })
                  }
                  disabled={actionLoading === "set_status" || selectedOwner.account_status === "active"}
                >
                  {actionLoading === "set_status" ? "..." : "Aktif Yap"}
                </Button>

                {/* İncele */}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-yellow-600 border-yellow-300 text-xs h-8 w-full"
                  onClick={() =>
                    handleOwnerAction("set_status", { account_status: "under_review" })
                  }
                  disabled={actionLoading === "set_status" || selectedOwner.account_status === "under_review"}
                >
                  {actionLoading === "set_status" ? "..." : "İncelemeye Al"}
                </Button>

                {/* Geçici Askıya Al */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-700">Geçici Askıya Al</p>
                  <div className="flex gap-2">
                    <select
                      value={suspendDays}
                      onChange={(e) => setSuspendDays(e.target.value)}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                    >
                      <option value="1">1 Gün</option>
                      <option value="7">7 Gün</option>
                      <option value="30">30 Gün</option>
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-600 border-amber-300 text-xs h-8 flex-1"
                      onClick={() => {
                        const until = new Date();
                        until.setDate(until.getDate() + Number(suspendDays));
                        handleOwnerAction("set_status", {
                          account_status: "suspended",
                          suspended_until: until.toISOString(),
                          suspension_reason: suspendReason || null,
                        });
                      }}
                      disabled={actionLoading === "set_status"}
                    >
                      {actionLoading === "set_status" ? "..." : "Askıya Al"}
                    </Button>
                  </div>
                  <textarea
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 resize-none focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    placeholder="Askı sebebi (isteğe bağlı)..."
                  />
                </div>

                {/* Kalıcı Banla */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-700">Kalıcı Banla</p>
                  <textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 resize-none focus:ring-2 focus:ring-red-400 focus:outline-none"
                    placeholder="Ban sebebi (zorunlu)..."
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs h-8 w-full"
                    onClick={() =>
                      handleOwnerAction("set_status", {
                        account_status: "banned",
                        banned_reason: banReason || null,
                      })
                    }
                    disabled={actionLoading === "set_status" || !banReason}
                  >
                    <Ban className="w-3 h-3 mr-1" />
                    {actionLoading === "set_status" ? "..." : "Kalıcı Banla"}
                  </Button>
                </div>

                {/* Hesabı Sil */}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 text-xs h-8 w-full"
                  onClick={() => {
                    if (
                      confirm(
                        "Bu hesabı KVKK kapsamında silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
                      )
                    ) {
                      handleOwnerAction("delete_account");
                    }
                  }}
                  disabled={actionLoading === "delete_account"}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  {actionLoading === "delete_account" ? "..." : "Hesabı Sil (KVKK)"}
                </Button>
              </div>

              {/* Admin note */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Admin Notu (gizli)</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-[#166534] focus:outline-none"
                  placeholder="Sadece adminler görebilir..."
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  onClick={() => handleOwnerAction("set_admin_note")}
                  disabled={actionLoading === "set_admin_note"}
                >
                  {actionLoading === "set_admin_note" ? "Kaydediliyor..." : "Notu Kaydet"}
                </Button>
              </div>

              {/* Status History section */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">Durum Geçmişi</p>
                  {!showHistory && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2"
                      onClick={() => handleShowHistory(selectedOwner)}
                    >
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
    </>
  );
}
