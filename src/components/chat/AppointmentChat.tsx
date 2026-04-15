"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, Shield, AlertTriangle, Lock, MessageSquareOff, Timer } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  appointmentId: string;
  currentUserId: string;
  otherPartyName: string;
  appointmentStatus: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  appointmentDatetime?: string;
  messagingExpiresAt?: string | null; // ISO — 48h post-completion window
  isVet?: boolean;
}

const QUICK_REPLIES = [
  "✅ Randevunuz onaylandı, sizi bekliyoruz",
  "⏰ Lütfen randevu saatinden 5 dk önce gelin",
  "🐾 Hayvanınızı aç getirmeniz önerilir",
  "📍 Adres ve yol tarifi için haritaya bakın",
  "📞 Acil durum için bizi arayabilirsiniz",
];

function getMsRemaining(messagingExpiresAt?: string | null): number {
  if (!messagingExpiresAt) return 0;
  return Math.max(0, new Date(messagingExpiresAt).getTime() - Date.now());
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}s ${m.toString().padStart(2, "0")}d ${s.toString().padStart(2, "0")}sn`;
  return `${m}d ${s.toString().padStart(2, "0")}sn`;
}

export default function AppointmentChat({
  appointmentId,
  currentUserId,
  otherPartyName,
  appointmentStatus,
  messagingExpiresAt,
  isVet = false,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(() => getMsRemaining(messagingExpiresAt));
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Derived access state
  const isLocked = appointmentStatus === "pending";
  const isCancelled = appointmentStatus === "cancelled" || appointmentStatus === "no_show";
  // completed: only allow messages while within the 48h window
  const isCompletedExpired = appointmentStatus === "completed" && getMsRemaining(messagingExpiresAt) === 0;
  const isReadOnly = isCancelled || isCompletedExpired;
  const canSend = !isLocked && !isReadOnly;

  // Countdown tick
  useEffect(() => {
    if (appointmentStatus !== "completed" || !messagingExpiresAt) return;
    if (getMsRemaining(messagingExpiresAt) <= 0) return;

    const interval = setInterval(() => {
      const remaining = getMsRemaining(messagingExpiresAt);
      setCountdown(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [appointmentStatus, messagingExpiresAt]);

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/messages/${appointmentId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
    }
    setLoading(false);
  }, [appointmentId]);

  useEffect(() => {
    fetchMessages();

    // Real-time subscription — only subscribe if chat is accessible
    if (isLocked) return;

    const channel = supabase
      .channel(`messages:${appointmentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `appointment_id=eq.${appointmentId}`,
        },
        (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [appointmentId, fetchMessages, supabase, isLocked]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !canSend) return;

    setSending(true);
    setInput("");

    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, content: text }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.blocked) {
        toast.warning(
          "Güvenliğiniz için iletişim bilgileri paylaşılamaz. Tüm görüşmeleriniz platform güvencesi kapsamındadır.",
          { duration: 6000, icon: "💛" }
        );
        setInput(text);
      } else {
        toast.error(data.error || "Mesaj gönderilemedi");
        setInput(text);
      }
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Bugün";
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Dün";
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  };

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  messages.forEach(msg => {
    const date = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      grouped.push({ date, messages: [msg] });
    }
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{otherPartyName}</p>
            <p className="text-xs text-gray-500">Randevu mesajlaşması</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#166534] bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
            <Shield className="w-3 h-3" />
            Şifreli Platform İletişimi
          </div>
        </div>
        {/* 48h countdown banner — only when completed and window is open */}
        {appointmentStatus === "completed" && countdown > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
            <Timer className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700 font-medium">
              Randevu sonrası mesajlaşma penceresi —{" "}
              <span className="font-bold">{formatCountdown(countdown)} kaldı</span>
            </p>
          </div>
        )}
      </div>

      {/* Locked state — pending appointment */}
      {isLocked ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">Mesajlaşma henüz aktif değil</p>
          <p className="text-xs text-gray-500 max-w-xs">
            Randevu onaylandıktan sonra mesajlaşma aktif olacak.
          </p>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Shield className="w-10 h-10 text-gray-200 mb-3" />
                <p className="text-sm text-gray-500">Henüz mesaj yok</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                  Randevunuzla ilgili tüm iletişimi buradan yapabilirsiniz.
                </p>
              </div>
            ) : (
              grouped.map(group => (
                <div key={group.date}>
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[10px] text-gray-400 font-medium px-2">{group.date}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  {group.messages.map(msg => {
                    const isMine = msg.sender_id === currentUserId;
                    return (
                      <div key={msg.id} className={`flex mb-2 ${isMine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMine
                              ? "bg-[#166534] text-white rounded-br-sm"
                              : "bg-gray-100 text-gray-900 rounded-bl-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? "text-white/60 text-right" : "text-gray-400"}`}>
                            {formatTime(msg.created_at)}
                            {isMine && msg.is_read && <span className="ml-1">✓✓</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Warning banner */}
          {!isReadOnly && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-700">
                Telefon, e-posta veya sosyal medya bilgisi paylaşılamaz. İhlaller otomatik engellenir ve raporlanır.
              </p>
            </div>
          )}

          {/* Cancelled / expired banner */}
          {isReadOnly && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
              <MessageSquareOff className="w-4 h-4 text-gray-400 shrink-0" />
              <p className="text-xs text-gray-500">
                {isCancelled
                  ? "Bu randevu iptal edildi. Mesajlaşma devre dışı."
                  : "48 saatlik mesajlaşma penceresi doldu. İletişim arşivlendi."}
              </p>
            </div>
          )}

          {/* Quick replies — vet only, not read-only */}
          {isVet && canSend && (
            <div className="px-3 pt-2 pb-1 border-t border-gray-100 flex gap-1.5 overflow-x-auto scrollbar-none">
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply}
                  onClick={() => setInput(reply)}
                  className="shrink-0 text-[11px] px-2.5 py-1.5 bg-gray-100 hover:bg-[#DCFCE7] hover:text-[#166534] text-gray-600 rounded-full border border-gray-200 hover:border-[#166534]/30 transition-colors whitespace-nowrap"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          {canSend && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Mesajınızı yazın…"
                rows={1}
                className="flex-1 resize-none px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 max-h-24"
                style={{ minHeight: "40px" }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="w-9 h-9 bg-[#166534] hover:bg-[#14532D] disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
