"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  sender_type: "user" | "ai" | "admin";
  content: string;
  created_at: string;
  metadata?: { system?: boolean };
}

interface Thread {
  id: string;
  status: "ai_handling" | "human_required" | "resolved";
  subject: string | null;
  admin_notification_pending?: boolean;
}

const SENDER_LABEL: Record<string, string> = {
  user: "Siz",
  ai:   "AI Destek",
  admin: "Destek Ekibi",
};

const SENDER_COLORS: Record<string, string> = {
  user:  "bg-emerald-600 text-white self-end",
  ai:    "bg-gray-100 text-gray-800 self-start",
  admin: "bg-blue-50 text-blue-900 border border-blue-200 self-start",
};

export default function SupportWidget() {
  const [open, setOpen]               = useState(false);
  const [thread, setThread]           = useState<Thread | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [unread, setUnread]           = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const supabase                      = createClient();
  const channelRef                    = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then(p => setNotifPermission(p));
      }
    }
  }, []);

  const showBrowserNotif = useCallback((title: string, body: string) => {
    if (notifPermission === "granted" && document.hidden) {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag:  "support-reply",
      });
    }
  }, [notifPermission]);

  // Subscribe to realtime messages for the current thread
  const subscribeToThread = useCallback((threadId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`support:${threadId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "support_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.sender_type === "admin" || msg.sender_type === "ai") {
            if (!open) setUnread(u => u + 1);
            showBrowserNotif(
              "Veterineri Bul Destek 💬",
              msg.content.substring(0, 80)
            );
          }
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      )
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "support_threads",
          filter: `id=eq.${threadId}`,
        },
        (payload) => {
          setThread(prev => prev ? { ...prev, ...payload.new } : prev);
        }
      )
      .subscribe();
  }, [supabase, open, showBrowserNotif]);

  // Load existing open thread on mount
  useEffect(() => {
    let mounted = true;
    fetch("/api/support/threads")
      .then(r => r.json())
      .then(({ threads }) => {
        if (!mounted) return;
        const open = (threads ?? []).find((t: Thread) => t.status !== "resolved");
        if (open) {
          setThread(open);
          loadMessages(open.id);
          subscribeToThread(open.id);
          if (open.admin_notification_pending) setUnread(1);
        }
      })
      .catch(() => null);
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = async (threadId: string) => {
    const res = await fetch(`/api/support/threads/${threadId}`);
    const { thread: t } = await res.json();
    if (t?.messages) setMessages(t.messages);
  };

  const openWidget = async () => {
    setOpen(true);
    setUnread(0);

    // Mark messages as seen
    if (thread?.id) {
      fetch(`/api/support/threads/${thread.id}/seen`, { method: "POST" }).catch(() => null);
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const closeWidget = () => setOpen(false);

  const startThread = async (firstMessage: string) => {
    // Create thread
    const res = await fetch("/api/support/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: firstMessage.substring(0, 80) }),
    });
    const { thread: newThread } = await res.json();
    setThread(newThread);
    subscribeToThread(newThread.id);
    return newThread;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    try {
      // Resolve active thread — guaranteed non-null after this block
      const activeThread: Thread = thread ?? (await startThread(text));

      // Optimistic insert
      const optimistic: Message = {
        id:          `opt-${Date.now()}`,
        sender_type: "user",
        content:     text,
        created_at:  new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimistic]);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });

      if (activeThread.status === "ai_handling" || activeThread.status === undefined) {
        // AI route
        const aiRes = await fetch("/api/support/chat", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ threadId: activeThread.id, message: text }),
        });
        const aiData = await aiRes.json();

        if (aiData.human_required) {
          setThread(prev => prev ? { ...prev, status: "human_required" } : prev);
        }
      } else {
        // Human thread — just post the message
        await fetch(`/api/support/threads/${activeThread.id}/messages`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ content: text }),
        });
      }

      // Reload to get server-confirmed messages
      await loadMessages(activeThread.id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={open ? closeWidget : openWidget}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg
                   flex items-center justify-center hover:bg-emerald-700 transition-all duration-200
                   focus:outline-none focus:ring-4 focus:ring-emerald-300"
        aria-label="Destek"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs
                           flex items-center justify-center font-bold animate-bounce">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)]
                        bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col"
             style={{ height: "480px" }}>

          {/* Header */}
          <div className="bg-emerald-600 text-white rounded-t-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-lg">🐾</div>
            <div className="flex-1 min-w-0">
              <p className="font-700 text-sm font-semibold">Veterineri Bul Destek</p>
              <p className="text-xs text-emerald-100">
                {thread?.status === "human_required"
                  ? "🟢 Canlı Destek Ekibi"
                  : thread?.status === "resolved"
                  ? "✅ Çözüldü"
                  : "🤖 AI Destek"}
              </p>
            </div>
            <button onClick={closeWidget} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8 px-4">
                <div className="text-3xl mb-2">💬</div>
                <p className="font-medium text-gray-600">Nasıl yardımcı olabiliriz?</p>
                <p className="text-xs mt-1 text-gray-400">
                  Randevu alma, ödeme, veteriner bulma veya teknik konularda yardım için yazın.
                </p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col max-w-[85%] ${
                msg.sender_type === "user" ? "self-end items-end" : "self-start items-start"
              }`}>
                <span className="text-[10px] text-gray-400 mb-1 px-1">
                  {SENDER_LABEL[msg.sender_type]}
                </span>
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${SENDER_COLORS[msg.sender_type] ?? "bg-gray-100 text-gray-800"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="self-start flex gap-1 px-3 py-2 bg-gray-100 rounded-2xl">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
            {thread?.status === "resolved" && (
              <div className="text-center text-xs text-gray-400 mt-2">
                ✅ Bu talep çözüme kavuşturuldu. Yeni bir soru için tekrar yazabilirsiniz.
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={thread?.status === "resolved" ? "Yeni talep başlatmak için yazın…" : "Mesajınızı yazın… (Enter = gönder)"}
              rows={1}
              disabled={loading}
              className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50
                         max-h-24 overflow-y-auto"
              style={{ minHeight: "40px" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center
                         hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
