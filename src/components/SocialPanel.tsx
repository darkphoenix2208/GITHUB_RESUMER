"use client";

import { useState } from "react";

interface SocialData {
  wakatime: {
    totalHours: number;
    dailyAvgHours: number;
    topLanguages: string[];
  } | null;
  kaggle: {
    tier: string;
    gold: number;
    silver: number;
    bronze: number;
    qualifies: boolean;
  } | null;
  so: {
    displayName: string;
    reputation: number;
    goldBadges: number;
    silverBadges: number;
    bronzeBadges: number;
    qualifies: boolean;
  } | null;
  socialLatex: string | null;
}

interface SocialPanelProps {
  onInject: (latex: string) => void;
}

export default function SocialPanel({ onInject }: SocialPanelProps) {
  const [wakatimeKey, setWakatimeKey] = useState("");
  const [kaggleUser, setKaggleUser] = useState("");
  const [soUser, setSoUser] = useState("");
  const [data, setData] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [injected, setInjected] = useState(false);

  async function handleFetch() {
    if (!wakatimeKey && !kaggleUser && !soUser) return;
    setLoading(true);
    setInjected(false);
    try {
      const res = await fetch("/api/social-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wakatimeKey, kaggleUser, soUser }),
      });
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  function handleInject() {
    if (data?.socialLatex) {
      onInject(data.socialLatex);
      setInjected(true);
    }
  }

  const KAGGLE_TIER_COLORS: Record<string, string> = {
    Grandmaster: "text-red-400 border-red-500/30 bg-red-500/5",
    Master: "text-purple-400 border-purple-500/30 bg-purple-500/5",
    Expert: "text-blue-400 border-blue-500/30 bg-blue-500/5",
    Contributor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
    Novice: "text-zinc-400 border-zinc-500/30 bg-zinc-500/5",
  };

  return (
    <div className="px-5 py-4 border-t border-white/5">
      <p className="text-xs font-bold tracking-widest uppercase text-zinc-500 mb-3">
        Social Proof Ingestion
      </p>

      {/* Input grid */}
      <div className="space-y-2 mb-3">
        <input
          type="password"
          placeholder="WakaTime API Key (optional)"
          value={wakatimeKey}
          onChange={(e) => setWakatimeKey(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-950 border border-white/5 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 font-mono"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Kaggle username"
            value={kaggleUser}
            onChange={(e) => setKaggleUser(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-950 border border-white/5 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 font-mono"
          />
          <input
            type="text"
            placeholder="SO username"
            value={soUser}
            onChange={(e) => setSoUser(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-950 border border-white/5 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 font-mono"
          />
        </div>
      </div>

      <button
        onClick={handleFetch}
        disabled={loading || (!wakatimeKey && !kaggleUser && !soUser)}
        className="w-full py-2 text-xs font-bold rounded-lg border border-white/5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Fetching…
          </>
        ) : "Fetch Social Proof"}
      </button>

      {/* Results */}
      {data && (
        <div className="mt-3 space-y-2">
          {/* WakaTime */}
          {data.wakatime && (
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <div>
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">WakaTime</p>
                <p className="text-sm font-bold text-emerald-400 mt-0.5">{data.wakatime.totalHours}h coded</p>
                <p className="text-[10px] text-zinc-500">{data.wakatime.topLanguages.slice(0, 3).join(" · ")}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">{data.wakatime.dailyAvgHours} hrs/day</p>
                <p className="text-[9px] text-emerald-600 mt-1">✓ Verified</p>
              </div>
            </div>
          )}

          {/* Kaggle */}
          {data.kaggle && (
            <div className={`flex items-center justify-between p-2.5 rounded-lg border ${KAGGLE_TIER_COLORS[data.kaggle.tier] || KAGGLE_TIER_COLORS.Contributor}`}>
              <div>
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Kaggle</p>
                <p className="text-sm font-bold mt-0.5">{data.kaggle.tier}</p>
                <p className="text-[10px] text-zinc-500">
                  🥇{data.kaggle.gold} 🥈{data.kaggle.silver} 🥉{data.kaggle.bronze}
                </p>
              </div>
              {data.kaggle.qualifies && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-blue-500/30 text-blue-400 bg-blue-500/10">
                  Qualifies for LaTeX
                </span>
              )}
            </div>
          )}

          {/* Stack Overflow */}
          {data.so && (
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5">
              <div>
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Stack Overflow</p>
                <p className="text-sm font-bold text-orange-400 mt-0.5">{data.so.reputation.toLocaleString()} rep</p>
                <p className="text-[10px] text-zinc-500">
                  🟡{data.so.goldBadges} ⚪{data.so.silverBadges} 🟤{data.so.bronzeBadges}
                </p>
              </div>
              {data.so.qualifies && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-orange-500/30 text-orange-400 bg-orange-500/10">
                  Top 10%
                </span>
              )}
            </div>
          )}

          {/* No qualifying data */}
          {!data.wakatime && !data.kaggle && !data.so && (
            <p className="text-xs text-zinc-500 text-center py-2">No data returned — check handles/key.</p>
          )}

          {/* Inject button */}
          {data.socialLatex && (
            <button
              onClick={handleInject}
              disabled={injected}
              className={`w-full py-2 text-xs font-bold rounded-lg border transition-all ${
                injected
                  ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 opacity-70 cursor-default"
                  : "border-purple-500/30 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20"
              }`}
            >
              {injected ? "✓ Section Injected into Résumé" : "⊕ Inject Community Section into Résumé"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
