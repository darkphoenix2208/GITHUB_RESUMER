"use client"

import { useState, useEffect } from "react";
import { processJobDescription } from "@/app/actions";

export default function JDForm({ repos }: { repos: any[] }) {
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ matchedRepos: any[], latex: string } | null>(null);
  const [editedLatex, setEditedLatex] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jd.trim()) return;
    
    setLoading(true);
    try {
      const res = await processJobDescription(jd, repos);
      setResult(res);
      setEditedLatex(res.latex);
    } catch(err: any) {
      console.error(err);
      alert(err.message || "Error generating LaTeX.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (editedLatex) {
      navigator.clipboard.writeText(editedLatex);
      alert("Final Edited LaTeX copied to clipboard!");
    }
  }

  const highlightPlaceholders = (text: string) => {
    // Splits text into parts separating bracketed placeholders
    const parts = text.split(/(\[[A-Za-z0-9%\s]+\])/g);
    return parts.map((part, i) => {
      if (part.match(/\[[A-Za-z0-9%\s]+\]/)) {
        return <span key={i} className="bg-emerald-500/20 text-emerald-300 font-bold px-1 rounded animate-pulse">{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg shadow-sm space-y-4">
        <h2 className="text-xl font-semibold mb-2">Target Job Description</h2>
        <p className="text-sm text-neutral-400">
          Paste the Job Description below. Our RAG engine will convert your code architecture and the JD into embeddings, mathematically select the top matching repositories, and generate tailored LaTeX bullets.
        </p>
        <textarea 
          className="w-full h-40 p-4 bg-neutral-950 border border-neutral-800 rounded-md focus:ring-2 focus:ring-emerald-500 text-neutral-200"
          placeholder="Paste Job Description..."
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          required
        ></textarea>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-md disabled:opacity-50 transition-colors"
        >
          {loading ? "Analyzing Repos & Generating LaTeX..." : "Match & Generate Resume Bullets"}
        </button>
      </form>

      {result && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div>
            <h2 className="text-xl font-semibold mb-4 text-cyan-400">Top Matches (Semantic Search)</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.matchedRepos.map(repo => (
                <div key={repo.name} className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
                  <div className="text-sm font-bold text-white mb-1">{repo.name}</div>
                  <div className="text-xs text-neutral-400">Match Score: {repo.score ? repo.score.toFixed(3) : 0}</div>
                  <div className="text-xs text-neutral-500 mt-2 truncate">{repo.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg space-y-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-xl font-semibold text-emerald-400">Metric Editor (Interstitial UI)</h2>
                <p className="text-sm text-neutral-400">Edit your true metrics below. Placeholders are highlighted.</p>
              </div>
              <button 
                onClick={handleCopy}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-md transition-colors"
              >
                Export to LaTeX
              </button>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-neutral-500">Live Preview & Highlighting</label>
                <div className="w-full h-80 p-4 bg-neutral-950 border border-neutral-800 rounded-md overflow-y-auto text-sm text-neutral-300 font-mono whitespace-pre-wrap">
                  {highlightPlaceholders(editedLatex)}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-neutral-500">Raw LaTeX Editor</label>
                <textarea 
                  className="w-full h-80 p-4 bg-neutral-950 border border-neutral-800 rounded-md focus:ring-2 focus:ring-emerald-500 text-sm text-neutral-300 font-mono"
                  value={editedLatex}
                  onChange={(e) => setEditedLatex(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
