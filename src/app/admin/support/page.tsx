"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ThreadUser {
  id: string;
  full_name?: string;
  email?: string;
}

interface Message {
  id: string;
  sender_type: "user" | "ai" | "admin";
  content: string;
  created_at: string;
  metadata?: { system?: boolean; type?: string };
}

interface Thread {
  id: string;
  subject: string | null;
  status: "ai_handling" | "human_required" | "resolved";
  last_message_at: string;
  admin_notification_pending: boolean;
  user: ThreadUser;
}

// ── Status config ───────────────────────────────────────────────────────────
const S_BADGE: Record<string, string> = {
  ai_handling:    "bg-blue-100 text-blue-700",
  human_required: "bg-red-100 text-red-700 animate-pulse",
  resolved:       "bg-green-100 text-green-700",
};
const S_LABEL: Record<string, string> = {
  ai_handling:    "AI Yanıtlıyor",
  human_required: "⚠️ Canlı Destek",
  resolved:       "✅ Çözüldü",
};

/** Web Audio ding */
function playDing() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  } catch { /* ignore */ }
}

export default function AdminSupportPage() {
  const router                        = useRouter();
  const [authed, setAuthed]           = useState<boolean | null>(null);
  const [threads, setThreads]         = useState<Thread[]>([]);
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [reply, setReply]             = useState("");
  const [sending, setSending]         = useState(false);
  const [resolving, setResolving]     = useState(false);
  const [filter, setFilter]           = useState<"all" | "human_required" | "ai_handling" | "resolved">("all");
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const msgChannelRef                 = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const supabaseRef                   = useRef<ReturnType<typeof createClient> | null>(null);

  const sb = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }, []);

  // Admin role guard
  useEffect(() => {
    fetch("/api/support/threads")
      .then(r => {
        if (r.status === 403 || r.status === 401) {
          router.replace("/admin/dashboard");
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        setAuthed(true);
        setThreads(data.threads ?? []);
      })
      .catch(() => setAuthed(false));
  }, [router]);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/support/threads");
    const { threads: list } = await res.json();
    setThreads(list ?? []);
  }, []);

  // Realtime: all thread changes → reload list + ding on new human_required
  useEffect(() => {
    if (!authed) return;
    const ch = sb()
      .channel("admin:support:all-threads")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_threads" },
        (payload) => {
          loadThreads();
          // Ding when a thread transitions to human_required
          if (
            payload.eventType === "UPDATE" &&
            (payload.new as Thread).status === "human_required" &&
            (payload.old as Thread).status !== "human_required"
          ) {
            playDing();
          }
        }
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" },
        () => {
          // Ding on every new user message (admin is "online" on this page)
          loadThreads();
        }
      )
      .subscribe();
    return () => { sb().removeChannel(ch); };
  }, [authed, sb, loadThreads]);

  const openThread = useCallback(async (id: string) => {
    setActiveId(id);
    const res = await fetch(`/api/support/threads/${id}`);
    const { thread } = await res.json();
    const sorted = (thread?.messages ?? []).sort(
      (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setMessages(sorted);

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);

    // Subscribe to new messages in this thread
    if (msgChannelRef.current) sb().removeChannel(msgChannelRef.current);
    msgChannelRef.current = sb()
      .channel(`admin:support:msg:${id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `thread_id=eq.${id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.sender_type === "user") playDing();
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      })
      .subscribe();
  }, [sb]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setReply("");
    try {
      await fetch(`/api/support/threads/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      await openThread(activeId);
    } finally {
      setSending(false);
    }
  };

  const resolveThread = async () => {
    if (!activeId || resolving) return;
    if (!confirm("Bu talebi çözüldü olarak kapatmak istiyor musunuz? Veterinere bildirim e-postası gönderilecek.")) return;
    setResolving(true);
    try {
      await fetch(`/api/support/threads/${activeId}/resolve`, { method: "POST" });
      setThreads(prev => prev.map(t => t.id === activeId ? { ...t, status: "resolved" } : t));
      await openThread(activeId);
    } finally {
      setResolving(false);
    }
  };

  if (authed === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const filteredThreads = threads.filter(t => filter === "all" || t.status === filter);
  const activeThread    = threads.find(t => t.id === activeId);
  const urgentCount     = threads.filter(t => t.status === "human_required").length;

  return (
    <div className="flex h-[calc(100vh-120px)] rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">

      {/* ── Left panel: thread list ─────────────────────────────────────────── */}
      <aside className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-bold text-gray-900 text-base">Veteriner Destek</h1>
              <p className="text-xs text-gray-400 mt-0.5">Admin — Canlı Yönetim Paneli</p>
            </div>
            {urgentCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1">
                ⚠️ {urgentCount}
              </span>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["all", "human_required", "ai_handling", "resolved"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  filter === f ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f === "all" ? `Tümü (${threads.length})` :
                 f === "human_required" ? `Canlı (${threads.filter(t=>t.status==="human_required").length})` :
                 f === "ai_handling" ? `AI (${threads.filter(t=>t.status==="ai_handling").length})` :
                 `Çözüldü (${threads.filter(t=>t.status==="resolved").length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filteredThreads.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-12">Talep bulunamadı</p>
          )}
          {filteredThreads.map(t => (
            <button key={t.id} onClick={() => openThread(t.id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors relative ${
                activeId === t.id ? "bg-emerald-50 border-l-[3px] border-l-emerald-600" : ""
              }`}
            >
              {t.status === "human_required" && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center
                                text-sm font-bold text-emerald-700 flex-shrink-0 mt-0.5">
                  {(t.user?.full_name ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate flex items-center gap-1">
                    Dr. {t.user?.full_name ?? "Bilinmiyor"}
                    {t.admin_notification_pending && (
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block" />
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{t.subject ?? "Teknik Destek"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${S_BADGE[t.status]}`}>
                      {S_LABEL[t.status]}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(t.last_message_at).toLocaleDateString("tr-TR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right panel: conversation ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-5xl mb-3">🛠️</div>
              <p className="font-medium text-gray-500 text-lg">Veteriner Destek Merkezi</p>
              <p className="text-sm mt-1 text-gray-400">
                Sol listeden bir veterinerin destek talebini seçin
              </p>
              {urgentCount > 0 && (
                <p className="mt-4 text-sm font-semibold text-red-600 animate-pulse">
                  ⚠️ {urgentCount} acil talep yanıt bekliyor
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="font-semibold text-gray-900">
                  Dr. {activeThread?.user?.full_name ?? "Veteriner"}
                  <span className="text-gray-400 text-sm font-normal ml-2">
                    {activeThread?.user?.email}
                  </span>
                </p>
                <p className="text-xs text-gray-500">{activeThread?.subject ?? "Teknik Destek"}</p>
              </div>
              <div className="flex items-center gap-2">
                {activeThread && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${S_BADGE[activeThread.status]}`}>
                    {S_LABEL[activeThread.status]}
                  </span>
                )}
                {activeThread?.status !== "resolved" && (
                  <button onClick={resolveThread} disabled={resolving}
                    className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700
                               disabled:opacity-50 font-medium transition-colors">
                    {resolving ? "Kapatılıyor…" : "✅ Çözüldü İşaretle"}
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3 min-h-0">
              {messages.map(msg => (
                <div key={msg.id} className={`flex flex-col max-w-[72%] ${
                  msg.sender_type === "user" ? "self-start items-start" : "self-end items-end"
                }`}>
                  <span className="text-[10px] text-gray-400 mb-1 px-1">
                    {msg.sender_type === "user"
                      ? `🩺 Dr. ${activeThread?.user?.full_name ?? ""}`
                      : msg.sender_type === "ai"
                      ? "🤖 AI Destek"
                      : "👤 Siz"}
                  </span>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.sender_type === "user"
                      ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                      : msg.sender_type === "ai"
                      ? "bg-blue-50 text-blue-900 border border-blue-100 rounded-tr-sm"
                      : "bg-emerald-600 text-white rounded-tr-sm"
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 px-1">
                    {new Date(msg.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            {activeThread?.status !== "resolved" && (
              <div className="border-t border-gray-100 p-4 flex gap-3 items-end flex-shrink-0">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  placeholder="Dr. adına yanıtınızı yazın… (Enter = gönder)"
                  rows={2}
                  disabled={sending}
                  className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-4 py-2.5
                             focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                />
                <button onClick={sendReply} disabled={!reply.trim() || sending}
                  className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm flex-shrink-0
                             hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {sending ? "Gönderiliyor…" : "Gönder"}
                </button>
              </div>
            )}
            {activeThread?.status === "resolved" && (
              <div className="border-t border-gray-100 p-4 text-center text-sm text-gray-400 flex-shrink-0">
                ✅ Bu talep çözüme kavuşturuldu. Veterinere bildirim gönderildi.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
