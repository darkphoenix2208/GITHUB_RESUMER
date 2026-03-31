"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import AskMyCodeModal from "@/components/AskMyCodeModal";

export default function PortfolioPage() {
  const [data, setData] = useState<any>(null);
  const [askOpen, setAskOpen] = useState(false);
  const { theme, setTheme } = useTheme();


  useEffect(() => {
    // Read from localStorage on mount
    const saved = localStorage.getItem("portfolioData");
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to parse portfolio data", err);
      }
    }
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-zinc-500 font-mono text-sm">
        <p>Loading portfolio data...</p>
      </div>
    );
  }

  const { repos } = data;
  const isBloomberg = theme === "bloomberg";
  const isTerminal = theme === "terminal";
  const isDark = isTerminal || isBloomberg;

  const bgClass = isBloomberg ? "bg-black text-amber-500" : isTerminal ? "bg-black text-green-500" : "bg-zinc-950 text-white";
  const borderClass = isBloomberg ? "border-amber-500/20" : isTerminal ? "border-green-500/30" : "border-emerald-500/20";
  const cardBgClass = isBloomberg ? "bg-amber-500/5 hover:bg-amber-500/10" : isTerminal ? "bg-green-500/5 hover:bg-green-500/10" : "bg-zinc-900 border-white/5 hover:border-emerald-500/50";
  const textTitle = isBloomberg ? "text-amber-400" : isTerminal ? "text-green-400" : "text-white";
  const textMuted = isBloomberg ? "text-amber-600" : isTerminal ? "text-green-700" : "text-zinc-400";
  const badgeClass = isBloomberg ? "bg-amber-500/10 text-amber-300 border border-amber-500/30" : isTerminal ? "bg-green-500/10 text-green-300 border border-green-500/30" : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";

  return (
    <div className={`min-h-screen font-mono p-4 sm:p-8 lg:p-12 ${bgClass}`}>
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b pb-8 transition-colors" style={{ borderColor: isBloomberg ? "rgba(245, 158, 11, 0.2)" : isTerminal ? "rgba(34, 197, 94, 0.3)" : "rgba(255,255,255,0.1)" }}>
          <div>
            <h1 className={`text-4xl sm:text-5xl font-black uppercase tracking-tighter ${textTitle}`}>
              Engineering <span className="opacity-50">Portfolio</span>
            </h1>
            <p className={`mt-2 uppercase tracking-widest text-xs font-bold ${textMuted}`}>
              Proof of Work • Architecture • Execution
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-[10px] uppercase tracking-widest ${textMuted}`}>Theme:</span>
            <select 
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className={`text-xs px-3 py-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 ${borderClass} border bg-transparent ${textTitle}`}
            >
              <option value="glass">Glass (Modern)</option>
              <option value="terminal">Terminal (Hacker)</option>
              <option value="bloomberg">Bloomberg (Quant)</option>
            </select>
          </div>
        </header>

        {/* Repositories */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className={`h-px flex-1 ${borderClass} border-b`} />
            <h2 className={`text-sm font-bold uppercase tracking-widest ${textTitle}`}>Featured Systems ({repos.length})</h2>
            <div className={`h-px flex-1 border-b`} style={{ borderColor: isBloomberg ? "rgba(245, 158, 11, 0.2)" : isTerminal ? "rgba(34, 197, 94, 0.3)" : "rgba(255,255,255,0.1)" }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {repos.map((repo: any) => (
              <div key={repo.name} className={`p-6 rounded-2xl border transition-all duration-300 group flex flex-col ${cardBgClass} ${borderClass}`}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className={`text-xl font-bold ${textTitle}`}>{repo.name}</h3>
                  {repo.primaryLanguage && (
                    <span className={`text-[10px] px-2 py-1 rounded-full ${badgeClass}`}>
                      {repo.primaryLanguage}
                    </span>
                  )}
                </div>
                
                <p className={`text-sm leading-relaxed flex-1 ${isDark ? textMuted : "text-zinc-300"}`}>
                  {repo.description || "No description provided."}
                </p>

                <div className="mt-6 pt-6 border-t border-inherit flex flex-wrap gap-2">
                  {repo.metrics?.estimatedValue != null && (
                    <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 ${isBloomberg ? "text-amber-200" : isTerminal ? "text-green-200" : "text-purple-300"}`}>
                      Valuation: ${(repo.metrics.estimatedValue / 1000).toFixed(0)}k
                    </span>
                  )}
                  {repo.metrics?.cocomoEffort != null && (
                    <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 ${isBloomberg ? "text-amber-200" : isTerminal ? "text-green-200" : "text-sky-300"}`}>
                      Effort: {repo.metrics.cocomoEffort} PM
                    </span>
                  )}
                  {repo.metrics?.maintainabilityIndex != null && (
                    <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 ${isBloomberg ? "text-amber-200" : isTerminal ? "text-green-200" : "text-emerald-300"}`}>
                      MI: {repo.metrics.maintainabilityIndex} {repo.metrics.grade}
                    </span>
                  )}
                </div>

                {repo.metrics?.powerSignals && repo.metrics.powerSignals.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {repo.metrics.powerSignals.slice(0, 3).map((signal: string, i: number) => (
                      <span key={i} className={`text-[9px] px-2 py-0.5 rounded-full border ${isBloomberg ? "border-amber-500/30 text-amber-500" : isTerminal ? "border-green-500/30 text-green-500" : "border-zinc-700 text-zinc-400 bg-zinc-800"}`}>
                        ⚡ {signal}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Floating Chatbot Widget */}
      <div className="fixed bottom-6 right-6">
        <button 
          onClick={() => setAskOpen(true)}
          className={`flex items-center gap-2 px-5 py-3 rounded-full font-bold shadow-2xl transition-transform hover:scale-105 ${
            isBloomberg ? "bg-amber-500 text-black shadow-amber-500/20" : isTerminal ? "bg-green-500 text-black shadow-green-500/20" : "bg-emerald-500 text-black shadow-emerald-500/20"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          Ask My Code
        </button>
      </div>

      {askOpen && (
        <AskMyCodeModal repos={repos} onClose={() => setAskOpen(false)} />
      )}
    </div>
  );
}
