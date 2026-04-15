"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X, Send, Sparkles, Loader2, MessageCircle } from "lucide-react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string; isResult?: boolean }[]>([
    { role: "bot", text: "Merhaba! 🐾 Evcil hayvanınız hakkında bir şey sormak ister misiniz?" },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Show widget after 6 seconds, only once per session
    if (sessionStorage.getItem("chat_widget_dismissed")) return;
    const timer = setTimeout(() => setVisible(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const dismiss = () => {
    setVisible(false);
    setOpen(false);
    sessionStorage.setItem("chat_widget_dismissed", "1");
  };

  const send = async () => {
    const q = query.trim();
    if (!q || loading) return;
    setQuery("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);

    try {
      const res = await fetch("/api/hero-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();

      const { analysis } = data;
      const urgencyText =
        analysis.urgency === "acil"
          ? "Bugün bir veterinere gitmenizi öneririm."
          : analysis.urgency === "bugün"
          ? "Yakın zamanda kontrol ettirmenizi öneririm."
          : "Randevu alarak kontrol ettirmenizi öneririm.";

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: `${analysis.summary} ${urgencyText}`,
          isResult: true,
        },
        {
          role: "bot",
          text: `Uzman: **${analysis.specialty}**`,
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Üzgünüm, şu an yanıt veremiyorum. Lütfen tekrar deneyin." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {/* Chat panel */}
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-[#D4E0D8] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2C4A3E] to-[#3D6B5E] px-4 py-3 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-semibold leading-tight">Veterineri Bul Yapay Zeka Asistan</p>
              <p className="text-white/70 text-xs">Sorunuzu yanıtlıyorum</p>
            </div>
            <button
              onClick={dismiss}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-white/80" />
            </button>
          </div>

          {/* Messages */}
          <div className="h-56 overflow-y-auto p-3 space-y-2.5 bg-[#FAFCFA]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#3D6B5E] text-white rounded-br-sm"
                      : msg.isResult
                      ? "bg-amber-50 border border-amber-200 text-amber-800 rounded-bl-sm"
                      : "bg-white border border-[#D4E0D8] text-[#2C3A32] rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.text.split("**").map((part, j) =>
                    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#D4E0D8] rounded-xl rounded-bl-sm px-3 py-2 shadow-sm">
                  <Loader2 className="w-3.5 h-3.5 text-[#3D6B5E] animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#D4E0D8] bg-white">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Hayvanınızı anlatın…"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3D6B5E] focus:border-transparent placeholder-gray-400"
              />
              <button
                onClick={send}
                disabled={!query.trim() || loading}
                className="w-8 h-8 bg-[#3D6B5E] disabled:bg-gray-200 rounded-lg flex items-center justify-center transition-all hover:bg-[#2C4A3E] active:scale-95 shrink-0"
              >
                <Send className="w-3 h-3 text-white" />
              </button>
            </div>
            <Link href="/auth/register" className="block mt-2 text-center text-[10px] text-[#3D6B5E] hover:underline font-medium">
              Randevu Al →
            </Link>
          </div>
        </div>
      )}

      {/* Floating button */}
      <div className="relative">
        {!open && (
          <div className="absolute -top-10 right-0 bg-[#2C4A3E] text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg animate-bounce">
            Yardım lazım mı? 🐾
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="w-13 h-13 bg-[#3D6B5E] hover:bg-[#2C4A3E] active:scale-95 rounded-full shadow-xl flex items-center justify-center transition-all border-2 border-white"
          style={{ width: 52, height: 52 }}
        >
          {open ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <MessageCircle className="w-5 h-5 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
