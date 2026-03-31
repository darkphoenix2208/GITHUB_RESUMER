"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AskMyCodeModal({ repos, onClose }: { repos: any[], onClose: () => void }) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const isBloomberg = theme === "bloomberg";
  const isTerminal = theme === "terminal";
  const bgMain = "bg-zinc-950";
  const borderClass = isBloomberg ? "border-amber-500/20" : isTerminal ? "border-green-500/30" : "border-emerald-500/20";
  const textTitle = isBloomberg ? "text-amber-400" : isTerminal ? "text-green-400" : "text-white";
  const accentBg = isBloomberg ? "bg-amber-500/10" : isTerminal ? "bg-green-500/10" : "bg-emerald-500/10";
  const accentBtn = isBloomberg ? "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20" : isTerminal ? "bg-green-500 hover:bg-green-400 text-black shadow-green-500/20" : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ask-my-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: messages,
          repos
        })
      });
      const data = await res.json();
      if (data.answer) {
        setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Error: Could not retrieve an answer." }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Runtime exception connecting to AI." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center bg-black/40 backdrop-blur-sm sm:p-6 transition-all">
      <div className={`w-full sm:w-[450px] sm:max-w-full h-[80vh] sm:h-[600px] flex flex-col ${bgMain} border ${borderClass} sm:rounded-2xl shadow-2xl overflow-hidden shadow-black/50`}>
        
        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between border-b ${borderClass} ${accentBg} shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isBloomberg ? "bg-amber-400" : isTerminal ? "bg-green-400" : "bg-emerald-400"}`} />
            <div>
              <h3 className={`text-sm font-bold uppercase tracking-widest ${textTitle}`}>Ask My Code</h3>
              <p className={`text-[10px] ${isBloomberg ? "text-amber-600" : isTerminal ? "text-green-700" : "text-zinc-500"}`}>Engage Digital Avatar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <svg className={`w-5 h-5 ${textTitle} opacity-50`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className={`text-center py-10 opacity-60 text-xs uppercase tracking-widest ${textTitle}`}>
              <svg className="w-10 h-10 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Greetings. I am ready to dive into the technical depth of my repos.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col max-w-[85%] ${m.role === "user" ? "ml-auto items-end" : "items-start"}`}>
              <span className={`text-[9px] uppercase tracking-widest mb-1 opacity-50 ${textTitle}`}>{m.role === "user" ? "You" : "Avatar"}</span>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? borderClass + " border bg-white/5 text-white rounded-tr-sm" 
                : accentBg + " " + borderClass + " border " + textTitle + " rounded-tl-sm font-mono text-xs"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className={`flex flex-col items-start max-w-[85%]`}>
              <div className={`p-4 rounded-2xl border ${accentBg} ${borderClass} rounded-tl-sm`}>
                <svg className={`w-4 h-4 animate-spin ${textTitle}`} viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className={`p-4 border-t ${borderClass} shrink-0`}>
          <form onSubmit={handleSend} className="relative">
            <input 
              className={`w-full py-3 pl-4 pr-12 rounded-xl bg-black border ${borderClass} focus:outline-none focus:ring-1 text-sm ${textTitle} placeholder-white/20`}
              placeholder="Ask me how I built..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <button 
              type="submit" 
              disabled={!input.trim() || loading}
              className={`absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 ${accentBtn}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
