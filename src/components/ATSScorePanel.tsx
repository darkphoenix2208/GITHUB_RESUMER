"use client";

import { useMemo } from "react";

interface ATSScorePanelProps {
  latex: string;
  jd: string;
}

// ── LaTeX → plain text ────────────────────────────────────────────────────────
// Strips LaTeX commands while preserving the text content inside braces.
function latexToPlainText(latex: string): string {
  return latex
    // Remove \begin{} / \end{} blocks that are pure structure
    .replace(/\\(begin|end)\{[^}]+\}/g, " ")
    // Replace \resumeItem{text} → text
    .replace(/\\resumeItem\{([^}]*)\}/g, "$1 ")
    // Replace \resumeSubheading{a}{b}{c}{d} → a b c d
    .replace(/\\resumeSubheading\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g, "$1 $2 $3 $4 ")
    // Replace \textbf{text} → text
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\textit\{([^}]*)\}/g, "$1")
    .replace(/\\emph\{([^}]*)\}/g, "$1")
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
    // Remove remaining LaTeX commands (with or without args)
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+[*]?\s*/g, " ")
    // Remove special chars
    .replace(/[{}\\%$&~^_]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

// ── Stopwords ──────────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by",
  "from","up","out","if","about","into","through","during","is","are","was",
  "were","be","been","being","have","has","had","do","does","did","will","would",
  "could","should","may","might","shall","can","i","you","he","she","it","we",
  "they","this","that","these","those","not","as","we","its","our","your","their",
  "also","more","other","than","then","so","such","all","any","both","each","few",
  "most","some","such","no","only","own","same","very","just","how","when","where",
  "which","who","whom","what","whether","here","there","how","all","after","before",
  "above","below","between","experience","ability","work","working","role","position",
  "team","using","use","used","well","strong","good","years","year","within","across",
  "ensure","including","help","ability","understand","must","need","required","etc",
]);

// ── Keyword extraction ─────────────────────────────────────────────────────────
function extractKeywords(text: string): Map<string, number> {
  const words = text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9#+.\-_]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  // Bigrams for compound keywords (e.g. "machine learning", "lock free")
  const terms: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (!STOPWORDS.has(words[i]) && !STOPWORDS.has(words[i + 1])) {
      terms.push(bigram);
    }
  }

  const freq = new Map<string, number>();
  for (const t of terms) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}

// ── Score calculation ─────────────────────────────────────────────────────────
interface ATSResult {
  score: number;          // 0–100
  found: string[];
  missing: string[];
  critical: string[];     // high-value missing keywords
}

function calculateATSScore(jd: string, resumeText: string): ATSResult {
  const jdWords = extractKeywords(jd.toLowerCase());
  const resumeWords = extractKeywords(resumeText.toLowerCase());

  // Get top-N JD keywords by frequency (these matter most)
  const ranked = Array.from(jdWords.entries())
    .filter(([k]) => k.length > 2) // skip tiny words
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([k]) => k);

  const found: string[] = [];
  const missing: string[] = [];

  for (const kw of ranked) {
    if (resumeWords.has(kw) || resumeText.includes(kw)) {
      found.push(kw);
    } else {
      missing.push(kw);
    }
  }

  // "Critical" missing keywords = top-15 JD terms not found
  const critical = missing.slice(0, 15);

  const score = ranked.length > 0
    ? Math.round((found.length / ranked.length) * 100)
    : 0;

  return { score, found, missing: missing.slice(0, 20), critical };
}

// ── Score gauge colours ────────────────────────────────────────────────────────
function scoreGrade(score: number) {
  if (score >= 75) return { label: "Strong Match", color: "text-emerald-400", bar: "bg-emerald-400", ring: "border-emerald-500/40" };
  if (score >= 55) return { label: "Good Match", color: "text-blue-400", bar: "bg-blue-400", ring: "border-blue-500/40" };
  if (score >= 35) return { label: "Partial Match", color: "text-yellow-400", bar: "bg-yellow-400", ring: "border-yellow-500/40" };
  return { label: "Low Match", color: "text-red-400", bar: "bg-red-400", ring: "border-red-500/40" };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ATSScorePanel({ latex, jd }: ATSScorePanelProps) {
  const result = useMemo<ATSResult | null>(() => {
    if (!latex || !jd) return null;
    const resumeText = latexToPlainText(latex);
    return calculateATSScore(jd, resumeText);
  }, [latex, jd]);

  if (!result) return null;

  const grade = scoreGrade(result.score);

  return (
    <div className="border-t border-white/5 bg-zinc-950/80 px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">ATS Readability Simulator</span>
          <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full">Taleo / Workday model</span>
        </div>
        <span className={`text-2xl font-black ${grade.color}`}>{result.score}<span className="text-sm font-normal text-zinc-500">/100</span></span>
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
          <span>Machine Readability</span>
          <span className={grade.color}>{grade.label}</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${grade.bar}`}
            style={{ width: `${result.score}%` }}
          />
        </div>
      </div>

      {/* Keywords two-column */}
      <div className="grid grid-cols-2 gap-3">
        {/* Found */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">
            ✓ Found ({result.found.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {result.found.slice(0, 12).map((kw) => (
              <span key={kw} className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-mono">
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* Missing */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-2">
            ✗ Missing ({result.missing.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {result.critical.slice(0, 12).map((kw) => (
              <span key={kw} className="text-[10px] px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full font-mono">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      {result.missing.length > 0 && (
        <p className="mt-3 text-[10px] text-zinc-600 leading-relaxed">
          💡 Add the missing keywords naturally into your bullets to increase your ATS match score.
        </p>
      )}
    </div>
  );
}
