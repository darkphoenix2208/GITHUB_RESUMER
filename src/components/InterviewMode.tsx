"use client";

import { useState } from "react";

interface InterviewModeProps {
  repo: any;
  powerSignals: string[];
  onClose: () => void;
}

const scoreColor = (score: number) => {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-yellow-400";
  if (score >= 4) return "text-orange-400";
  return "text-red-400";
};

const overallBg = (overall: string) => {
  if (overall === "Strong") return "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
  if (overall === "Good") return "bg-blue-500/10 border-blue-500/30 text-blue-300";
  if (overall === "Needs Work") return "bg-yellow-500/10 border-yellow-500/30 text-yellow-300";
  return "bg-red-500/10 border-red-500/30 text-red-300";
};

export default function InterviewMode({ repo, powerSignals, onClose }: InterviewModeProps) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loadingF, setLoadingF] = useState(false);
  const [phase, setPhase] = useState<"intro" | "grilling" | "feedback">("intro");

  async function startGrill() {
    setLoadingQ(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, powerSignals }),
      });
      const data = await res.json();
      setQuestions(data.questions || []);
      setCurrentQ(0);
      setPhase("grilling");
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQ(false);
    }
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    setLoadingF(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/interview", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: questions[currentQ], answer, repo }),
      });
      const data = await res.json();
      setFeedback(data.feedback);
      setPhase("feedback");
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingF(false);
    }
  }

  function nextQuestion() {
    if (currentQ < questions.length - 1) {
      setCurrentQ((c) => c + 1);
      setAnswer("");
      setFeedback(null);
      setPhase("grilling");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="relative w-full max-w-3xl bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Resume Grill</h2>
              <p className="text-xs text-zinc-500">{repo.name} — {questions.length > 0 ? `Question ${currentQ + 1} of ${questions.length}` : "AI Mock Interviewer"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* INTRO */}
          {phase === "intro" && (
            <div className="flex flex-col items-center text-center space-y-6 py-8">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Ready to Get Grilled?</h3>
                <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">
                  The AI will generate 5 tough questions specifically targeting the complex logic in <span className="text-emerald-400 font-semibold">{repo.name}</span>.
                  Answer them, and get STAR-K scored feedback.
                </p>
              </div>
              {powerSignals.length > 0 && (
                <div className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-left">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Detected Power Signals:</p>
                  <div className="flex flex-wrap gap-2">
                    {powerSignals.slice(0, 5).map((s, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">{s.split("(")[0].trim()}</span>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={startGrill}
                disabled={loadingQ}
                className="flex items-center gap-2 px-8 py-3.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 text-sm"
              >
                {loadingQ ? (
                  <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Generating Questions...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Start Grill Session</>
                )}
              </button>
            </div>
          )}

          {/* QUESTION */}
          {phase === "grilling" && questions.length > 0 && (
            <div className="space-y-5">
              {/* Progress */}
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= currentQ ? "bg-red-500" : "bg-zinc-800"}`} />
                ))}
              </div>
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3">Question {currentQ + 1}</p>
                <p className="text-base text-white leading-relaxed">{questions[currentQ]}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Your Answer</label>
                <textarea
                  className="w-full h-36 px-4 py-3 bg-zinc-950 border border-white/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 text-sm text-zinc-200 placeholder-zinc-600 font-mono resize-none"
                  placeholder="Explain your approach, the decisions you made, and the outcomes..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>
              <button
                onClick={submitAnswer}
                disabled={loadingF || !answer.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-bold rounded-xl text-sm disabled:opacity-40 transition-all hover:bg-neutral-200"
              >
                {loadingF ? (
                  <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Evaluating...</>
                ) : "Submit Answer →"}
              </button>
            </div>
          )}

          {/* FEEDBACK */}
          {phase === "feedback" && feedback && (
            <div className="space-y-5">
              {/* Score Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${overallBg(feedback.overall)}`}>
                <div>
                  <p className="text-sm font-bold">{feedback.overall}</p>
                  <p className="text-xs opacity-70 mt-0.5">STAR-K Evaluation</p>
                </div>
                <div className={`text-3xl font-black ${scoreColor(feedback.score)}`}>{feedback.score}<span className="text-base font-normal text-zinc-500">/10</span></div>
              </div>

              {/* STAR-K breakdown */}
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">STAR-K Breakdown</p>
                {feedback.starK && Object.entries(feedback.starK).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs font-semibold text-zinc-400 uppercase mb-0.5">{key}</p>
                    <p className="text-sm text-zinc-300">{val as string}</p>
                  </div>
                ))}
              </div>

              {/* Better Answer */}
              {feedback.betterAnswer && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-2">Ideal Answer Structure</p>
                  <p className="text-sm text-emerald-200 leading-relaxed">{feedback.betterAnswer}</p>
                </div>
              )}

              {/* Missing Keywords */}
              {feedback.missingKeywords?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Missing Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {feedback.missingKeywords.map((kw: string, i: number) => (
                      <span key={i} className="text-xs px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-full">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {currentQ < questions.length - 1 ? (
                  <button onClick={nextQuestion} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm rounded-xl transition-all">
                    Next Question ({currentQ + 2}/{questions.length}) →
                  </button>
                ) : (
                  <button onClick={onClose} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl transition-all">
                    Grill Complete ✓
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
