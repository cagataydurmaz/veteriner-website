"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Send, Trash2, Bell, FileText, Users } from "lucide-react";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  target_role: "all" | "owner" | "vet";
  sent_at: string | null;
  created_at: string;
};

interface Props {
  announcements: AnnouncementRow[];
}

const TARGET_LABELS: Record<string, string> = {
  all: "Herkes",
  owner: "Hayvan Sahipleri",
  vet: "Veterinerler",
};

const TARGET_COLORS: Record<string, string> = {
  all: "bg-blue-100 text-blue-700",
  owner: "bg-orange-100 text-orange-700",
  vet: "bg-purple-100 text-purple-700",
};

export default function AnnouncementsClient({ announcements }: Props) {
  const [list, setList] = useState<AnnouncementRow[]>(announcements);
  const [loading, setLoading] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    target_role: "all" as "all" | "owner" | "vet",
  });
  const [showForm, setShowForm] = useState(false);

  const callApi = async (payload: Record<string, unknown>, successMsg: string) => {
    const res = await fetch("/api/admin/announcement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "İşlem başarısız");
    toast.success(successMsg);
    return data;
  };

  const handleSave = async (sendNow: boolean) => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Başlık ve içerik zorunludur");
      return;
    }
    setLoading("create");
    try {
      const data = await callApi(
        { action: "create", title: form.title, body: form.body, target_role: form.target_role, send_now: sendNow },
        sendNow ? "Duyuru gönderildi" : "Taslak kaydedildi"
      );
      if (data.announcement) {
        setList(prev => [data.announcement, ...prev]);
      }
      setForm({ title: "", body: "", target_role: "all" });
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setLoading(null);
    }
  };

  const handleSend = async (id: string) => {
    setLoading("send_" + id);
    try {
      await callApi({ action: "send", id }, "Duyuru gönderildi");
      setList(prev =>
        prev.map(a => a.id === id ? { ...a, sent_at: new Date().toISOString() } : a)
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading("delete_" + id);
    try {
      await callApi({ action: "delete", id }, "Duyuru silindi");
      setList(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Yeni Duyuru</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(v => !v)}
              className="text-xs h-8"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1" />
              {showForm ? "Kapat" : "Oluştur"}
            </Button>
          </div>
        </CardHeader>
        {showForm && (
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Başlık</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Duyuru başlığı..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">İçerik</label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Duyuru içeriği..."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Hedef Kitle</label>
              <select
                value={form.target_role}
                onChange={e => setForm(f => ({ ...f, target_role: e.target.value as "all" | "owner" | "vet" }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 bg-white"
              >
                <option value="all">Herkes</option>
                <option value="owner">Hayvan Sahipleri</option>
                <option value="vet">Veterinerler</option>
              </select>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 text-sm"
                onClick={() => handleSave(false)}
                disabled={!!loading}
              >
                <FileText className="w-4 h-4 mr-2" />
                Taslak Kaydet
              </Button>
              <Button
                className="flex-1 bg-[#166534] hover:bg-[#14532D] text-white text-sm"
                onClick={() => handleSave(true)}
                disabled={!!loading}
              >
                <Send className="w-4 h-4 mr-2" />
                Hemen Gönder
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Announcements list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tüm Duyurular ({list.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              Henüz duyuru yok
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {list.map(ann => (
                <div key={ann.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    ann.sent_at ? "bg-[#F0FDF4] text-[#166534]" : "bg-yellow-50 text-yellow-600"
                  }`}>
                    {ann.sent_at ? <Send className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900 truncate">{ann.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TARGET_COLORS[ann.target_role] || "bg-gray-100 text-gray-600"}`}>
                        <Users className="w-3 h-3 inline mr-1" />
                        {TARGET_LABELS[ann.target_role] || ann.target_role}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        ann.sent_at ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {ann.sent_at ? "Gönderildi" : "Taslak"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">{ann.body}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(ann.created_at).toLocaleDateString("tr-TR")}
                      {ann.sent_at && ` · Gönderildi: ${new Date(ann.sent_at).toLocaleDateString("tr-TR")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!ann.sent_at && (
                      <Button
                        size="sm"
                        className="bg-[#166534] hover:bg-[#14532D] text-white text-xs h-7 px-2.5"
                        onClick={() => handleSend(ann.id)}
                        disabled={loading === "send_" + ann.id}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Gönder
                      </Button>
                    )}
                    <button
                      onClick={() => handleDelete(ann.id)}
                      disabled={loading === "delete_" + ann.id}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
