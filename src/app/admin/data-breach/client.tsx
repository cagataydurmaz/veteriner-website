"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, Plus, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface Breach {
  id: string;
  description: string;
  severity: string;
  status: string;
  affected_users_count: number | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  investigating: "İnceleniyor",
  resolved: "Çözüldü",
  notified: "İlgililer Bilgilendirildi",
};

export default function DataBreachClient({ initialBreaches }: { initialBreaches: Breach[] }) {
  const [breaches, setBreaches] = useState<Breach[]>(initialBreaches);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: "",
    severity: "medium",
    affected_users_count: "",
  });
  const [resolutionModal, setResolutionModal] = useState<{ id: string; notes: string } | null>(null);

  const createBreach = async () => {
    if (!form.description) return toast.error("Açıklama zorunludur");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/data-breach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          severity: form.severity,
          affected_users_count: form.affected_users_count ? parseInt(form.affected_users_count) : null,
        }),
      });
      const data = await res.json();
      if (data.breach) {
        setBreaches([data.breach, ...breaches]);
        setShowForm(false);
        setForm({ description: "", severity: "medium", affected_users_count: "" });
        toast.success("İhlal bildirimi oluşturuldu. KVKK m.12/5 uyarınca 72 saat içinde KVK Kurulu'na bildirim yapılmalıdır.");
      }
    } catch {
      toast.error("Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string, notes?: string) => {
    const res = await fetch("/api/admin/data-breach", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, resolution_notes: notes }),
    });
    if (res.ok) {
      setBreaches(breaches.map(b => b.id === id ? { ...b, status, resolution_notes: notes || b.resolution_notes } : b));
      setResolutionModal(null);
      toast.success("Durum güncellendi");
    }
  };

  const openCount = breaches.filter(b => b.status === "open" || b.status === "investigating").length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" /> Veri İhlali Bildirimleri
          </h1>
          <p className="text-sm text-gray-500 mt-1">KVKK m.12/5 — İhlal tespitinden itibaren 72 saat içinde KVK Kurulu&apos;na bildirim yapılmalıdır.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-red-600 hover:bg-red-700">
          <Plus className="w-4 h-4 mr-2" /> Yeni İhlal Bildir
        </Button>
      </div>

      {openCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800">{openCount} açık ihlal bildirimi bulunmaktadır</p>
            <p className="text-sm text-red-700 mt-1">
              KVKK m.12/5 gereği 72 saat içinde Kişisel Verileri Koruma Kurulu&apos;na bildirim yapılmalıdır.
              Etkilenen kişilere de gecikmeksizin bildirimde bulunulmalıdır.
            </p>
          </div>
        </div>
      )}

      {/* New breach form */}
      {showForm && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-800">Yeni Veri İhlali Bildirimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">İhlal Açıklaması <span className="text-red-500">*</span></label>
              <textarea
                className="w-full rounded-lg border border-gray-300 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                placeholder="İhlalin niteliği, hangi verilerin etkilendiği, nasıl tespit edildiği..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Önem Derecesi</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.severity}
                  onChange={e => setForm({ ...form, severity: e.target.value })}
                >
                  <option value="low">Düşük</option>
                  <option value="medium">Orta</option>
                  <option value="high">Yüksek</option>
                  <option value="critical">Kritik</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Etkilenen Kullanıcı Sayısı (tahmini)</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Bilinmiyorsa boş bırakın"
                  value={form.affected_users_count}
                  onChange={e => setForm({ ...form, affected_users_count: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={createBreach} loading={loading} className="bg-red-600 hover:bg-red-700">Bildir</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>İptal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breach list */}
      <div className="space-y-3">
        {breaches.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Kayıtlı veri ihlali bildirimi bulunmamaktadır.</p>
          </div>
        ) : (
          breaches.map((breach) => (
            <Card key={breach.id} className={breach.status === "open" ? "border-red-200" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[breach.severity]}`}>
                        {breach.severity === "low" ? "Düşük" : breach.severity === "medium" ? "Orta" : breach.severity === "high" ? "Yüksek" : "Kritik"}
                      </span>
                      <Badge variant={breach.status === "open" ? "destructive" : "secondary"} className="text-xs">
                        {STATUS_LABELS[breach.status] || breach.status}
                      </Badge>
                      <span className="text-xs text-gray-400">{formatDate(breach.created_at)}</span>
                      {breach.affected_users_count && (
                        <span className="text-xs text-gray-500">{breach.affected_users_count} kullanıcı etkilendi</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{breach.description}</p>
                    {breach.resolution_notes && (
                      <p className="text-xs text-gray-500 mt-2 italic">Çözüm notu: {breach.resolution_notes}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col gap-1">
                    {breach.status === "open" && (
                      <button
                        onClick={() => updateStatus(breach.id, "investigating")}
                        className="text-xs px-3 py-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg hover:bg-yellow-100 flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" /> İncelemeye Al
                      </button>
                    )}
                    {(breach.status === "open" || breach.status === "investigating") && (
                      <button
                        onClick={() => setResolutionModal({ id: breach.id, notes: "" })}
                        className="text-xs px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" /> Çözüldü
                      </button>
                    )}
                    {breach.status !== "notified" && (
                      <button
                        onClick={() => updateStatus(breach.id, "notified", breach.resolution_notes || undefined)}
                        className="text-xs px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100"
                      >
                        KVK Kurulu&apos;na Bildirildi
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Resolution modal */}
      {resolutionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-bold text-gray-900 mb-3">Çözüm Notu Ekle</h3>
            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 text-sm resize-none mb-4"
              rows={3}
              placeholder="Nasıl çözüldü, alınan önlemler..."
              value={resolutionModal.notes}
              onChange={e => setResolutionModal({ ...resolutionModal, notes: e.target.value })}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => updateStatus(resolutionModal.id, "resolved", resolutionModal.notes)}
                className="bg-green-600 hover:bg-green-700"
              >
                Çözüldü Olarak İşaretle
              </Button>
              <Button variant="outline" onClick={() => setResolutionModal(null)}>İptal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
