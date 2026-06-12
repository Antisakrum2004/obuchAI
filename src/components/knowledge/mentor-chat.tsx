"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "mentor";
  content: string;
  timestamp: Date;
}

// ── Mentor Chat Modal ──────────────────────────────────────────

export function MentorChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "mentor",
      content:
        "Привет! Я ментор. Если у тебя есть вопросы по материалу — спрашивай, я помогу разобраться.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      // Send to mentor API (currently stub — will be connected to Bitrix24 webhook)
      const res = await fetch("/api/knowledge/mentor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      const mentorMsg: ChatMessage = {
        id: `mentor-${Date.now()}`,
        role: "mentor",
        content: data.reply || "Спасибо за вопрос! Я подготовлю ответ и вернусь к тебе.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, mentorMsg]);
    } catch {
      // Offline / fallback — still show a message
      const fallbackMsg: ChatMessage = {
        id: `mentor-${Date.now()}`,
        role: "mentor",
        content:
          "Спасибо за вопрос! Сейчас я не могу ответить, но ваш вопрос сохранён. Ментор ответит в ближайшее время.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-40 flex flex-col items-center gap-1">
        <button
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full glass glass-hover shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 group"
          aria-label="Чат с ментором"
          title="Чат с ментором"
        >
          <MessageCircle className="h-5 w-5 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
        </button>
        <span className="text-[8px] text-muted-foreground/40 font-mono leading-none">
          Ментор
        </span>
      </div>

      {/* Chat Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Chat Window */}
          <div className="relative w-full sm:max-w-md h-[70vh] sm:h-[500px] flex flex-col bg-[#111118] border border-white/10 rounded-t-xl sm:rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                  <Bot className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Ментор</p>
                  <p className="text-[10px] text-muted-foreground">
                    Помощь по материалам курса
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "mentor" && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 shrink-0 mt-1">
                      <Bot className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-emerald-500/20 text-foreground border border-emerald-500/20"
                        : "bg-white/5 text-foreground border border-white/5"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 shrink-0 mt-1">
                      <User className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex gap-2 justify-start">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 shrink-0 mt-1">
                    <Bot className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="bg-white/5 rounded-xl px-3 py-2 text-sm text-muted-foreground border border-white/5 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Печатает...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-white/5 px-3 py-2 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Задайте вопрос ментору..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
