"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Send, MessageCircle, Bot, User, ArrowLeft, AlertTriangle, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  "Köpeğim yemiyor, ne yapmalıyım?",
  "Kedim sürekli kusuyour",
  "Köpeğim topallıyor",
  "Kedimin gözleri akıntılı",
  "Köpeğim çok uyuyor",
  "Kedi aşı takvimi nedir?",
];

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: "Merhaba! 👋 Ben Veterineri Bul Yapay Zeka Asistan. Evcil hayvanınızla ilgili sorularınızı yanıtlamak için buradayım.\n\nSemptomlarını anlatın, hangi uzmanın yardımcı olabileceğini birlikte belirleyelim. Unutmayın: verdiğim bilgiler ön değerlendirme niteliğindedir, kesin tanı için mutlaka bir veterinere başvurun.",
};

export default function AIAsistanPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.filter((m) => m !== WELCOME_MESSAGE),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const isEmergency = (text: string) =>
    text.toLowerCase().includes("acil durum") || text.toLowerCase().includes("derhal veteriner");

  return (
    <div className="min-h-screen bg-[#F0FDF4] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-8 h-8 bg-[#166534] rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Veterineri Bul Yapay Zeka Asistan</p>
            <p className="text-xs text-green-500">Çevrimiçi</p>
          </div>
          <div className="ml-auto">
            <Link href="/auth/register">
              <Button size="sm" className="bg-[#F97316] hover:bg-[#EA6A0A] text-white text-xs">
                <Stethoscope className="w-3.5 h-3.5 mr-1" />
                Randevu Al
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Disclaimer */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-3">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Bu asistan ön değerlendirme amaçlıdır. Kesin tanı için lütfen bir veterinere başvurun.
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 space-y-4 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === "assistant" ? "bg-[#166534]" : "bg-gray-200"
            }`}>
              {msg.role === "assistant" ? (
                <Bot className="w-4 h-4 text-white" />
              ) : (
                <User className="w-4 h-4 text-gray-600" />
              )}
            </div>
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#166534] text-white rounded-tr-sm"
                  : isEmergency(msg.content)
                  ? "bg-red-50 border border-red-200 text-red-800 rounded-tl-sm"
                  : "bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100"
              }`}
            >
              {isEmergency(msg.content) && (
                <div className="flex items-center gap-1.5 text-red-600 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4" /> ACİL DURUM
                </div>
              )}
              {msg.content}
              {msg.role === "assistant" && i === messages.length - 1 && !loading && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Link href="/auth/register">
                    <button className="text-xs text-[#166534] font-medium hover:underline">
                      → Veterineri Bul&apos;da veteriner bul ve randevu al
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#166534] flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 bg-[#166534] rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions (only at start) */}
      {messages.length <= 1 && (
        <div className="max-w-3xl mx-auto w-full px-4 pb-2">
          <p className="text-xs text-gray-500 mb-2">Hızlı sorular:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs bg-white border border-[#DCFCE7] text-[#166534] px-3 py-1.5 rounded-full hover:bg-[#F0FDF4] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Hayvanınızın semptomlarını anlatın..."
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-[#166534] hover:bg-[#14532D] disabled:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
