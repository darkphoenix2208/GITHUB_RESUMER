"use client"

import { useState } from "react";
import { scoreRepositories, generateForSelected } from "@/app/actions";
import ATSResumePreview from "@/components/ATSResumePreview";
import InterviewMode from "@/components/InterviewMode";
import SocialPanel from "@/components/SocialPanel";
import { useTheme, ThemeSwitcher } from "@/components/ThemeProvider";

const gradeColor: Record<string, string> = {
  A: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  B: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  C: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  D: "text-red-400 bg-red-500/10 border-red-500/30",
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(Math.max((score - 0.2) / 0.65, 0), 1) * 100;
  const color = pct > 65 ? "bg-emerald-400" : pct > 40 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-zinc-400 w-10 text-right">{score.toFixed(3)}</span>
    </div>
  );
}

export default function DashboardWorkspace({ repos }: { repos: any[] }) {
  const { theme, autoDetect } = useTheme();
  const isTerminal = theme === "terminal";
  const isBloomberg = theme === "bloomberg";
  const isDark = isTerminal || isBloomberg;

  const [jd, setJd] = useState("");
  const [phase, setPhase] = useState<"idle" | "scoring" | "selecting" | "generating" | "done">("idle");
  const [scoredRepos, setScoredRepos] = useState<any[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [latex, setLatex] = useState("");
  const [enrichedRepos, setEnrichedRepos] = useState<any[]>([]);
  const [interviewRepo, setInterviewRepo] = useState<any | null>(null);
  const [socialLatex, setSocialLatex] = useState("");
  const [cfHandle, setCfHandle] = useState("");
  const [lcHandle, setLcHandle] = useState("");
  const [cpData, setCpData] = useState<any>(null);
  const [cpLoading, setCpLoading] = useState(false);

  async function fetchCPProfile() {
    if (!cfHandle && !lcHandle) return;
    setCpLoading(true);
    try {
      const res = await fetch("/api/cp-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cfHandle, lcHandle }),
      });
      const data = await res.json();
      setCpData(data);
    } catch (e) { console.error(e); }
    finally { setCpLoading(false); }
  }

  async function handleScore(e: React.FormEvent) {
    e.preventDefault();
    if (!jd.trim()) return;
    setPhase("scoring");
    setScoredRepos([]);
    setSelectedNames(new Set());
    setLatex("");
    try {
      const ranked = await scoreRepositories(jd, repos);
      setScoredRepos(ranked);
      const autoSelect = ranked
        .filter((r: any) => r.score > 0.4 && r.complexityBonus >= 0)
        .slice(0, 3)
        .map((r: any) => r.name);
      setSelectedNames(new Set(autoSelect));
      setPhase("selecting");
    } catch (err: any) {
      alert(err.message || "Scoring failed");
      setPhase("idle");
    }
  }

  async function handleGenerate() {
    if (selectedNames.size === 0) return;
    setPhase("generating");
    try {
      const res = await generateForSelected(jd, scoredRepos, Array.from(selectedNames));
      const cpSection = cpData?.cpLatex ? `\n\n${cpData.cpLatex}` : "";
      const socialSection = socialLatex ? `\n\n${socialLatex}` : "";
      setLatex(res.latex + cpSection + socialSection);
      setEnrichedRepos(res.enrichedRepos);
      const allSignals = res.enrichedRepos.flatMap((r: any) => r.metrics?.powerSignals || []);
      autoDetect(allSignals);
      setPhase("done");
    } catch (err: any) {
      alert(err.message || "Generation failed");
      setPhase("selecting");
    }
  }

  function toggleRepo(name: string) {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const isLoading = phase === "scoring" || phase === "generating";

  const cls = {
    border:   isBloomberg ? "border-amber-500/20"  : isTerminal ? "border-green-500/20" : "border-white/5",
    accent:   isBloomberg ? "text-amber-400"        : isTerminal ? "text-green-400"      : "text-emerald-400",
    accentBg: isBloomberg ? "bg-amber-500/10"       : isTerminal ? "bg-green-500/10"     : "bg-emerald-500/10",
    surface:  isDark      ? "bg-black"              : "bg-zinc-900/80",
    dot:      isBloomberg ? "bg-amber-400"          : isTerminal ? "bg-green-400"        : "bg-emerald-400 shadow-lg shadow-emerald-400/50",
  };

  return (
    <>
      {interviewRepo && (
        <InterviewMode
          repo={interviewRepo}
          powerSignals={interviewRepo.metrics?.powerSignals || []}
          onClose={() => setInterviewRepo(null)}
        />
      )}

      <div className={`flex flex-col lg:flex-row gap-0 h-[calc(100vh-140px)] min-h-[600px] rounded-2xl overflow-hidden border shadow-2xl transition-all duration-500 ${
        isBloomberg ? "border-amber-500/20 bg-black shadow-amber-500/5" :
        isTerminal  ? "border-green-500/30 bg-black shadow-green-500/10" :
                      "border-white/5 bg-zinc-900/60 backdrop-blur-xl"
      }`}>

        {/* ── LEFT PANE (42%) ── */}
        <div className={`lg:w-[42%] flex flex-col border-r overflow-y-auto ${cls.border}`}>

          {/* Header */}
          <div className={`px-5 py-3.5 border-b shrink-0 flex items-center justify-between ${cls.border} ${cls.surface}`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${cls.dot}`} />
              <span className={`text-xs font-bold tracking-widest uppercase font-mono ${cls.accent}`}>Controls</span>
            </div>
            <ThemeSwitcher />
          </div>

          {/* JD Input */}
          <div className={`px-5 py-4 border-b shrink-0 ${cls.border} ${isDark ? "bg-black" : ""}`}>
            <form onSubmit={handleScore} className="space-y-3">
              <label className={`text-xs font-bold tracking-widest uppercase block font-mono ${cls.accent}`}>
                {isBloomberg ? "ENTER: TARGET ROLE DESCRIPTION" : isTerminal ? "$ cat job_description.txt" : "Target Job Description"}
              </label>
              <textarea
                className={`w-full h-36 px-3.5 py-3 border rounded-xl focus:outline-none text-sm placeholder-zinc-600 resize-none transition-all font-mono ${
                  isBloomberg ? "bg-black border-amber-500/20 focus:border-amber-400 text-amber-300 focus:ring-1 focus:ring-amber-400/20"
                  : isTerminal ? "bg-black border-green-500/30 focus:border-green-400 text-green-300 focus:ring-1 focus:ring-green-400/30"
                  : "bg-zinc-950 border-white/5 focus:ring-2 focus:ring-emerald-500/50 text-zinc-200"
                }`}
                placeholder={isDark ? "> paste job description..." : "Paste the full job description here..."}
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={isLoading || !jd.trim()}
                className={`w-full flex items-center justify-center gap-2 py-3 font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  isBloomberg ? "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono"
                  : isTerminal ? "bg-green-500/10 hover:bg-green-500/20 border border-green-500/40 text-green-400 font-mono"
                  : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
                }`}
              >
                {phase === "scoring" ? (
                  <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Scoring {repos.length} repos...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>Score All Repos</>
                )}
              </button>
            </form>
          </div>

          {/* ALL REPOS SCORED */}
          {scoredRepos.length > 0 && (
            <div className={`px-5 py-4 border-b shrink-0 ${cls.border} ${isDark ? "bg-black" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold tracking-widest uppercase font-mono ${cls.accent}`}>
                  {isBloomberg ? `REPO RANK (${scoredRepos.length})` : "All Repos Ranked"}
                </span>
                <span className="text-[10px] text-zinc-600">{selectedNames.size} selected</span>
              </div>

              <button
                onClick={handleGenerate}
                disabled={selectedNames.size === 0 || phase === "generating"}
                className={`w-full flex items-center justify-center gap-2 py-2.5 mb-3 font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDark ? `border ${cls.border} ${cls.accent} ${cls.accentBg} hover:opacity-80 font-mono` : "bg-white text-zinc-900 hover:bg-zinc-100 shadow"
                }`}
              >
                {phase === "generating" ? (
                  <><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Generating for {selectedNames.size} repos...</>
                ) : (
                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Generate for {selectedNames.size} selected</>
                )}
              </button>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {scoredRepos.map((repo, i) => {
                  const isSelected = selectedNames.has(repo.name);
                  const isTrivia = repo.complexityBonus < -0.05;
                  const metrics = repo.metrics;
                  return (
                    <div
                      key={repo.name}
                      onClick={() => toggleRepo(repo.name)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? isBloomberg ? "border-amber-500/50 bg-amber-500/5"
                          : isTerminal  ? "border-green-500/50 bg-green-500/5"
                          :               "border-emerald-500/40 bg-emerald-500/5"
                          : isDark ? `${cls.border} hover:opacity-70` : "border-white/5 hover:border-white/10"
                      } ${isTrivia ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-all ${
                          isSelected
                            ? isBloomberg ? "bg-amber-500 border-amber-500" : isTerminal ? "bg-green-500 border-green-500" : "bg-emerald-500 border-emerald-500"
                            : "border-zinc-600 bg-transparent"
                        }`}>
                          {isSelected && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-mono w-5 text-center shrink-0 ${cls.accent} opacity-50`}>#{i+1}</span>
                            <span className={`text-sm font-semibold truncate ${isDark ? `${cls.accent} font-mono` : "text-white"}`}>{repo.name}</span>
                            {isTrivia && <span className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full shrink-0">basic</span>}
                          </div>
                          <div className="mt-1.5"><ScoreBar score={repo.score} /></div>
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {repo.primaryLanguage && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${isDark ? `${cls.border} ${cls.accent} opacity-60` : "bg-zinc-800 border-white/5 text-zinc-500"}`}>{repo.primaryLanguage}</span>
                            )}
                            {repo.score > 0 && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-mono ${repo.complexityBonus > 0 ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" : "text-red-400 border-red-500/20 bg-red-500/5"}`}>
                                {repo.complexityBonus > 0 ? `+${repo.complexityBonus.toFixed(3)}` : repo.complexityBonus.toFixed(3)} weight
                              </span>
                            )}
                            {metrics?.grade && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-mono ${gradeColor[metrics.grade]}`}>MI:{metrics.maintainabilityIndex} {metrics.grade}</span>
                            )}
                            {metrics?.estimatedValue != null && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full border font-mono text-purple-400 border-purple-500/20 bg-purple-500/5">
                                ~${(metrics.estimatedValue / 1000).toFixed(0)}k
                              </span>
                            )}
                            {metrics?.cocomoEffort != null && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full border font-mono text-sky-400 border-sky-500/20 bg-sky-500/5">
                                {metrics.cocomoEffort}pm
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Enriched repos — Grill Mode */}
          {enrichedRepos.length > 0 && (
            <div className={`px-5 py-4 ${isDark ? "bg-black" : ""}`}>
              <p className={`text-xs font-bold tracking-widest uppercase mb-3 font-mono ${cls.accent}`}>
                {isBloomberg ? "GENERATED — STRESS TEST" : "Generated Repos — Grill Mode"}
              </p>
              <div className="space-y-2">
                {enrichedRepos.map((repo) => (
                  <div key={repo.name} className={`p-3 rounded-xl border ${isDark ? cls.border : "border-white/5 bg-zinc-950"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className={`text-sm font-semibold font-mono ${isDark ? cls.accent : "text-white"}`}>{repo.name}</p>
                        {repo.metrics && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${gradeColor[repo.metrics.grade]}`}>MI:{repo.metrics.maintainabilityIndex} {repo.metrics.grade}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border text-zinc-400 bg-zinc-800 border-white/5">CC:{repo.metrics.cyclomaticComplexity}</span>
                            {repo.metrics.hasTests && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">✓ Tests</span>}
                            {repo.metrics.estimatedValue != null && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border text-purple-400 border-purple-500/20 bg-purple-500/5">
                                ~${(repo.metrics.estimatedValue / 1000).toFixed(0)}k eng. value
                              </span>
                            )}
                            {repo.metrics.cocomoEffort != null && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border text-sky-400 border-sky-500/20 bg-sky-500/5">
                                {repo.metrics.cocomoEffort} person-months
                              </span>
                            )}
                          </div>
                        )}
                        {repo.metrics?.powerSignals?.slice(0, 1).map((s: string, idx: number) => (
                          <p key={idx} className={`text-[10px] mt-1 truncate ${cls.accent} opacity-40`}>⚡ {s}</p>
                        ))}
                      </div>
                      <button
                        onClick={() => setInterviewRepo(repo)}
                        className={`shrink-0 flex items-center gap-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg border transition-all ${
                          isBloomberg ? "border-amber-500/30 text-amber-500 font-mono hover:bg-amber-500/10"
                          : isTerminal ? "border-green-500/30 text-green-500 font-mono hover:bg-green-500/10"
                          : "border-red-500/20 text-red-400 hover:bg-red-500/10"
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Grill
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => {
                    localStorage.setItem('portfolioData', JSON.stringify({ repos: enrichedRepos }));
                    window.open('/portfolio', '_blank');
                  }}
                  className={`w-full py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
                    isBloomberg ? "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 font-mono"
                    : isTerminal ? "bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/20 font-mono"
                    : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Launch Interactive Portfolio
                </button>
              </div>
            </div>
          )}

          {/* Idle repo list */}
          {phase === "idle" && (
            <div className={`px-5 py-4 flex-1 overflow-y-auto ${isDark ? "bg-black" : ""}`}>
              <p className={`text-xs font-bold tracking-widest uppercase mb-3 font-mono ${cls.accent}`}>
                {isBloomberg ? `SECURITIES (${repos.length})` : `Ingested Repos (${repos.length})`}
              </p>
              <div className="space-y-1">
                {repos.map((repo) => (
                  <div key={repo.name} className={`px-3 py-2 rounded-lg border ${isDark ? `${cls.border} hover:opacity-70` : "border-white/5 hover:border-white/10"} transition-all flex items-center justify-between gap-2`}>
                    <span className={`text-xs truncate font-mono ${isDark ? cls.accent : "text-zinc-400"}`}>{repo.name}</span>
                    {repo.primaryLanguage && <span className={`text-[10px] font-mono shrink-0 opacity-50 ${isDark ? cls.accent : "text-zinc-600"}`}>{repo.primaryLanguage}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CP Handles */}
          {(phase === "selecting" || phase === "done") && (
            <div className={`px-5 py-4 border-t shrink-0 ${cls.border} ${isDark ? "bg-black" : ""}`}>
              <p className={`text-xs font-bold tracking-widest uppercase mb-2 font-mono ${cls.accent}`}>Competitive Programming</p>
              <div className="flex gap-2 mb-2">
                <input type="text" placeholder="Codeforces handle" value={cfHandle} onChange={e => setCfHandle(e.target.value)}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg border font-mono focus:outline-none ${isDark ? `bg-black ${cls.border} ${cls.accent}` : "bg-zinc-950 border-white/5 text-zinc-200"}`}/>
                <input type="text" placeholder="LeetCode handle" value={lcHandle} onChange={e => setLcHandle(e.target.value)}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg border font-mono focus:outline-none ${isDark ? `bg-black ${cls.border} ${cls.accent}` : "bg-zinc-950 border-white/5 text-zinc-200"}`}/>
              </div>
              <button onClick={fetchCPProfile} disabled={cpLoading || (!cfHandle && !lcHandle)}
                className={`w-full py-1.5 text-xs font-bold rounded-lg border transition-all disabled:opacity-40 font-mono ${isDark ? `${cls.border} ${cls.accent} ${cls.accentBg}` : "border-white/5 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}>
                {cpLoading ? "Fetching…" : "Fetch CP Profile"}
              </button>
              {cpData?.cf && <p className={`text-[10px] mt-1.5 font-mono ${cls.accent}`}>CF: {cpData.cf.handle} · Rating: {cpData.cf.rating}</p>}
              {cpData?.lc && <p className={`text-[10px] mt-0.5 font-mono ${cls.accent}`}>LC: {cpData.lc.totalSolved} solved · {cpData.lc.hardSolved} Hard</p>}
              {cpData?.cpLatex && <p className="text-[10px] mt-1 font-mono text-purple-400">✓ CP section queued for injection</p>}
            </div>
          )}

          {/* Social Panel */}
          <SocialPanel onInject={(s) => setSocialLatex(s)} />
        </div>

        {/* ── RIGHT PANE (58%) ── */}
        <div className={`lg:w-[58%] flex flex-col overflow-hidden ${isDark ? "bg-black" : ""}`}>
          <div className={`px-5 py-3.5 border-b shrink-0 flex items-center gap-2 ${cls.border} ${cls.surface}`}>
            <div className={`w-2 h-2 rounded-full ${phase === "done" ? `${cls.dot} animate-pulse` : "bg-zinc-600"}`} />
            <span className={`text-xs font-bold tracking-widest uppercase font-mono ${cls.accent}`}>
              {isBloomberg ? "RESUME OUTPUT" : isTerminal ? "> resume.preview" : "Live ATS Preview"}
            </span>
            {phase === "done" && (
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold border font-mono ${cls.accent} ${cls.accentBg} ${cls.border}`}>
                {isDark ? "READY" : "Editable"}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            {latex ? (
              <ATSResumePreview latex={latex} jd={jd} onLatexChange={setLatex} />
            ) : (
              <div className={`flex flex-col items-center justify-center h-full text-center p-8 ${isDark ? "bg-black" : ""}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 border ${isDark ? cls.border : "bg-white/[0.02] border-white/5"}`}>
                  <svg className={`w-7 h-7 ${isDark ? cls.accent : "text-zinc-600"} opacity-40`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                {isDark ? (
                  <div className="font-mono text-left">
                    <p className={`text-sm ${cls.accent} opacity-60`}>{isBloomberg ? "SYSTEM> resume --status" : "$ resume --status"}</p>
                    {phase === "idle"       && <p className={`text-sm mt-1 ${cls.accent}`}>{"> "} Waiting... score --all first</p>}
                    {phase === "selecting"  && <p className={`text-sm mt-1 ${cls.accent}`}>{"> "} Select repos, then generate</p>}
                    {phase === "generating" && <p className={`text-sm mt-1 ${cls.accent} animate-pulse`}>{"> "} Generating LaTeX...</p>}
                    <p className={`text-xs animate-pulse mt-1 ${cls.accent} opacity-30`}>_</p>
                  </div>
                ) : (
                  <>
                    <h3 className="text-base font-bold text-zinc-300 mb-2">
                      {phase === "idle"      && "Score repos first →"}
                      {phase === "selecting" && "Select repos, then generate →"}
                      {phase === "generating" && "Generating your resume..."}
                    </h3>
                    <p className="text-sm text-zinc-600 max-w-[260px] leading-relaxed">
                      {phase === "idle"      && "Paste a JD and click Score All Repos to see every project ranked."}
                      {phase === "selecting" && "Check or uncheck repos in the list, then click Generate."}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
