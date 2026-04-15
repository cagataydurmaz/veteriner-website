"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  sender_type: "user" | "ai" | "admin";
  content: string;
  created_at: string;
  metadata?: { system?: boolean; type?: string };
}

interface Thread {
  id: string;
  status: "ai_handling" | "human_required" | "resolved";
  subject: string | null;
}

const GREETING =
  "Merhaba Hocam, Veterineri Bul Teknik Destek ekibine hoş geldiniz! 👋\n\nSize nasıl yardımcı olabilirim? Teknik bir sorun, randevu sistemi veya platform ile ilgili her konuda buradayım.";

/** Web Audio API ding (no audio file needed) */
function playDing() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch { /* ignore — audio not critical */ }
}

export default function VetSupportWidget({ vetName }: { vetName: string }) {
  const searchParams               = useSearchParams();
  const [isOpen, setIsOpen]        = useState(false);
  const [thread, setThread]        = useState<Thread | null>(null);
  const [messages, setMessages]    = useState<Message[]>([]);
  const [input, setInput]          = useState("");
  const [loading, setLoading]      = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [unread, setUnread]        = useState(0);
  const [notifPerm, setNotifPerm]  = useState<NotificationPermission>("default");
  const bottomRef                  = useRef<HTMLDivElement>(null);
  const channelRef                 = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const supabaseRef                = useRef<ReturnType<typeof createClient> | null>(null);
  // Track isOpen in a ref so subscription callbacks can read it without
  // being listed as a dependency (avoids re-creating subscriptions on toggle).
  const isOpenRef                  = useRef(isOpen);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // Lazily init Supabase client — avoids render-time throw that would block React hydration
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then(p => setNotifPerm(p));
    } else if (typeof Notification !== "undefined") {
      setNotifPerm(Notification.permission);
    }
  }, []);

  // Auto-open if ?support=open is in URL
  useEffect(() => {
    if (searchParams.get("support") === "open") {
      setIsOpen(true);
    }
  }, [searchParams]);

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, []);

  const showBrowserNotif = useCallback((title: string, body: string) => {
    if (notifPerm === "granted" && document.hidden) {
      new Notification(title, { body, icon: "/favicon.ico", tag: "vet-support" });
    }
  }, [notifPerm]);

  const subscribeToThread = useCallback((threadId: string) => {
    const sb = getSupabase();
    if (channelRef.current) sb.removeChannel(channelRef.current);

    channelRef.current = sb
      .channel(`vet-support:${threadId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.sender_type === "admin") {
          playDing();
          setUnread(u => (isOpenRef.current ? 0 : u + 1));
          showBrowserNotif("Veterineri Bul Teknik Destek 💬", msg.content.substring(0, 80));
          fetch(`/api/support/threads/${threadId}/seen`, { method: "POST" }).catch(() => null);
        }
        scrollBottom();
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "support_threads",
        filter: `id=eq.${threadId}`,
      }, (payload) => {
        setThread(prev => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();
  // isOpen intentionally excluded: read via isOpenRef to keep this callback
  // stable and prevent the mount effect from re-running on every open/close.
  }, [getSupabase, showBrowserNotif, scrollBottom]);

  const loadThread = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/support/threads/${threadId}`);
    if (!res.ok) return;
    const { thread: t } = await res.json();
    if (t?.messages) {
      setMessages([...t.messages].sort(
        (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ));
    }
  }, []);

  // Load existing open thread on mount
  useEffect(() => {
    let alive = true;
    fetch("/api/support/threads")
      .then(r => r.json())
      .then(({ threads }) => {
        if (!alive) return;
        const existing = (threads ?? []).find((t: Thread) => t.status !== "resolved");
        if (existing) {
          setThread(existing);
          loadThread(existing.id);
          subscribeToThread(existing.id);
          if (existing.admin_notification_pending) setUnread(1);
        }
      })
      .catch(() => null);
    return () => { alive = false; };
  }, [loadThread, subscribeToThread]);

  const openWidget = () => {
    setIsOpen(true);
    setUnread(0);
    if (thread?.id) {
      fetch(`/api/support/threads/${thread.id}/seen`, { method: "POST" }).catch(() => null);
    }
    scrollBottom();
  };

  const closeWidget = () => setIsOpen(false);

  const createThread = async (): Promise<Thread> => {
    const res = await fetch("/api/support/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Teknik Destek" }),
    });
    const { thread: newThread } = await res.json();

    // If brand new thread (not reused), insert AI greeting
    if (newThread && messages.length === 0) {
      await fetch(`/api/support/threads/${newThread.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: GREETING, sender_type_override: "ai_greeting" }),
      }).catch(() => null);
    }

    setThread(newThread);
    subscribeToThread(newThread.id);
    await loadThread(newThread.id);
    return newThread;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    try {
      const activeThread: Thread = thread ?? (await createThread());

      // Optimistic message
      const optimistic: Message = {
        id:          `opt-${Date.now()}`,
        sender_type: "user",
        content:     text,
        created_at:  new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimistic]);
      scrollBottom();

      if (activeThread.status === "ai_handling") {
        const aiRes = await fetch("/api/support/chat", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ threadId: activeThread.id, message: text }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.human_required) {
            setThread(prev => prev ? { ...prev, status: "human_required" } : prev);
          }
        }
      } else {
        await fetch(`/api/support/threads/${activeThread.id}/messages`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ content: text }),
        });
      }

      await loadThread(activeThread.id);
    } catch { /* ignore */ }
    finally {
      setLoading(false);
      scrollBottom();
    }
  };

  const escalateToHuman = async () => {
    if (!thread || escalating) return;
    setEscalating(true);
    try {
      await fetch(`/api/support/threads/${thread.id}/escalate`, { method: "POST" });
      setThread(prev => prev ? { ...prev, status: "human_required" } : prev);
      await loadThread(thread.id);
    } catch { /* ignore */ }
    finally { setEscalating(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const isHuman   = thread?.status === "human_required";
  const isResolved = thread?.status === "resolved";

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={isOpen ? closeWidget : openWidget}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl
                   flex items-center justify-center transition-all duration-200
                   focus:outline-none focus:ring-4 focus:ring-emerald-300
                   bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600"
        aria-label="Teknik Destek"
      >
        {isOpen ? (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
        {!isOpen && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px]
                           font-bold text-white flex items-center justify-center animate-bounce">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col bg-white rounded-2xl shadow-2xl
                     border border-gray-200 overflow-hidden"
          style={{ width: "380px", maxWidth: "calc(100vw - 24px)", height: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white flex-shrink-0">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-lg select-none">
              🛠️
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Veterineri Bul Teknik Destek</p>
              <p className="text-[11px] text-emerald-100 mt-0.5">
                {isResolved  ? "✅ Çözüme Kavuşturuldu" :
                 isHuman     ? "🟢 Canlı Destek — Yanıt Bekleniyor" :
                               "🤖 AI Destek Aktif"}
              </p>
            </div>
            <button onClick={closeWidget} className="text-white/70 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5 min-h-0">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-start gap-1 mt-1">
                <span className="text-[10px] text-gray-400 px-1">Veterineri Bul Teknik Destek</span>
                <div className="bg-gray-100 text-gray-800 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[88%] whitespace-pre-wrap">
                  {GREETING}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col max-w-[88%] ${
                msg.sender_type === "user" ? "self-end items-end" : "self-start items-start"
              }`}>
                {msg.sender_type !== "user" && (
                  <span className="text-[10px] text-gray-400 mb-0.5 px-1">
                    {msg.sender_type === "admin" ? "👤 Destek Ekibi" : "🤖 AI Destek"}
                  </span>
                )}
                <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.sender_type === "user"
                    ? "bg-emerald-600 text-white rounded-br-sm"
                    : msg.sender_type === "admin"
                    ? "bg-blue-50 text-blue-900 border border-blue-100 rounded-bl-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                  {new Date(msg.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
            {loading && (
              <div className="self-start flex gap-1.5 px-4 py-3 bg-gray-100 rounded-2xl rounded-bl-sm">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Escalate button (visible when AI is handling and not resolved) */}
          {!isHuman && !isResolved && (
            <div className="px-4 py-2 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={escalateToHuman}
                disabled={escalating}
                className="w-full text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200
                           rounded-xl py-2 hover:bg-amber-100 transition-colors disabled:opacity-60
                           flex items-center justify-center gap-1.5"
              >
                {escalating ? (
                  <>
                    <span className="animate-spin">⏳</span> Bağlanıyor…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Canlı Desteğe Bağlan
                  </>
                )}
              </button>
            </div>
          )}

          {isHuman && !isResolved && (
            <div className="px-4 py-2 border-t border-gray-100 bg-blue-50 flex-shrink-0">
              <p className="text-[11px] text-blue-700 text-center font-medium">
                🟢 Canlı destek ekibine bağlandınız — mesajlarınız iletildi
              </p>
            </div>
          )}

          {/* Input */}
          {!isResolved && (
            <div className="border-t border-gray-100 p-3 flex gap-2 flex-shrink-0">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Mesajınızı yazın… (Enter = gönder)"
                rows={1}
                disabled={loading}
                className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50
                           overflow-y-auto"
                style={{ minHeight: "40px", maxHeight: "80px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center
                           hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                           flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          )}

          {isResolved && (
            <div className="border-t border-gray-100 p-4 text-center flex-shrink-0">
              <p className="text-sm text-gray-500">✅ Bu talep çözüme kavuşturuldu.</p>
              <button
                onClick={async () => {
                  setThread(null);
                  setMessages([]);
                  const t = await createThread();
                  setThread(t);
                }}
                className="mt-2 text-xs text-emerald-600 font-medium hover:underline"
              >
                Yeni talep oluştur →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
