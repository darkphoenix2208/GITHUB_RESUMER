"use client";

import { useState, useRef, useEffect } from "react";

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

// ── Web Speech API hook ────────────────────────────────────────────────────────
function useSpeechRecognition(onTranscript: (text: string) => void) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);

  const supported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  function start() {
    if (!supported || listening) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    let finalTranscript = "";
    let silenceTimer: ReturnType<typeof setTimeout>;

    rec.onresult = (e: any) => {
      clearTimeout(silenceTimer);
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript + " ";
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      onTranscript(finalTranscript + interim);
      // Auto-stop after 3s of silence
      silenceTimer = setTimeout(() => rec.stop(), 3000);
    };

    rec.onend = () => {
      setListening(false);
      clearTimeout(silenceTimer);
    };

    rec.onerror = () => setListening(false);

    rec.start();
    recRef.current = rec;
    setListening(true);
  }

  function stop() {
    recRef.current?.stop();
    setListening(false);
  }

  useEffect(() => () => recRef.current?.stop(), []);

  return { start, stop, listening, supported };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function InterviewMode({ repo, powerSignals, onClose }: InterviewModeProps) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loadingF, setLoadingF] = useState(false);
  const [phase, setPhase] = useState<"intro" | "grilling" | "feedback">("intro");

  const { start, stop, listening, supported } = useSpeechRecognition((text) => setAnswer(text));

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
    if (listening) stop();
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
              <h2 className="text-base font-bold text-white">Architecture Defense</h2>
              <p className="text-xs text-zinc-500">{repo.name} — {questions.length > 0 ? `Q${currentQ + 1}/${questions.length}` : "HFT Architect Persona"}</p>
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
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Architecture Defense</h3>
                <p className="text-zinc-500 text-xs mb-3">Interviewer Persona: Senior HFT Systems Architect</p>
                <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">
                  5 deep-dive questions targeting the exact technical patterns found in <span className="text-emerald-400 font-semibold">{repo.name}</span>.
                  Answer by voice 🎙 or type — then get STAR-K feedback.
                </p>
              </div>

              {powerSignals.length > 0 && (
                <div className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-left">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Interrogation Targets:</p>
                  <div className="flex flex-wrap gap-2">
                    {powerSignals.slice(0, 6).map((s, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-300 rounded-full">{s.split("(")[0].trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              {!supported && (
                <p className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
                  🎙 Voice mode requires Chrome or Edge. Text input is still available.
                </p>
              )}

              <button
                onClick={startGrill}
                disabled={loadingQ}
                className="flex items-center gap-2 px-8 py-3.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 text-sm"
              >
                {loadingQ ? (
                  <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Generating questions...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Begin Defense</>
                )}
              </button>
            </div>
          )}

          {/* QUESTION + VOICE ANSWER */}
          {phase === "grilling" && questions.length > 0 && (
            <div className="space-y-5">
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= currentQ ? "bg-red-500" : "bg-zinc-800"}`} />
                ))}
              </div>

              <div className="bg-zinc-900 border border-red-500/10 rounded-2xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3">Architect: Question {currentQ + 1}</p>
                <p className="text-base text-white leading-relaxed">{questions[currentQ]}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Your Answer</label>
                  {/* Voice control */}
                  {supported && (
                    <button
                      onClick={listening ? stop : start}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                        listening
                          ? "bg-red-500/20 border-red-500/40 text-red-300 animate-pulse"
                          : "bg-zinc-800 border-white/10 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      {listening ? "Recording... (tap to stop)" : "Speak"}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    className={`w-full h-36 px-4 py-3 bg-zinc-950 border rounded-xl focus:outline-none text-sm text-zinc-200 placeholder-zinc-600 font-mono resize-none transition-all ${
                      listening
                        ? "border-red-500/40 focus:ring-2 focus:ring-red-500/30"
                        : "border-white/5 focus:ring-2 focus:ring-red-500/30"
                    }`}
                    placeholder="Speak or type your answer... (voice auto-stops after 3s of silence)"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  {listening && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                      <span className="text-[10px] text-red-400 font-mono">REC</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={submitAnswer}
                disabled={loadingF || !answer.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-bold rounded-xl text-sm disabled:opacity-40 transition-all hover:bg-neutral-200"
              >
                {loadingF ? (
                  <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Evaluating STAR-K...</>
                ) : "Submit for STAR-K Review →"}
              </button>
            </div>
          )}

          {/* FEEDBACK */}
          {phase === "feedback" && feedback && (
            <div className="space-y-5">
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${overallBg(feedback.overall)}`}>
                <div>
                  <p className="text-sm font-bold">{feedback.overall}</p>
                  <p className="text-xs opacity-70 mt-0.5">STAR-K Evaluation</p>
                </div>
                <div className={`text-3xl font-black ${scoreColor(feedback.score)}`}>{feedback.score}<span className="text-base font-normal text-zinc-500">/10</span></div>
              </div>

              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">STAR-K Breakdown</p>
                {feedback.starK && Object.entries(feedback.starK).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs font-semibold text-zinc-400 uppercase mb-0.5">{key}</p>
                    <p className="text-sm text-zinc-300">{val as string}</p>
                  </div>
                ))}
              </div>

              {feedback.betterAnswer && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-2">Ideal Answer Structure</p>
                  <p className="text-sm text-emerald-200 leading-relaxed">{feedback.betterAnswer}</p>
                </div>
              )}

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
                    Defense Complete ✓
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
