"use client"

import { useState, useRef, useEffect } from "react";

interface ATSResumePreviewProps {
  latex: string;
  onLatexChange: (val: string) => void;
}

// Parses LaTeX into structured resume sections for visual render
function parseLatexToSections(latex: string): Section[] {
  const sections: Section[] = [];
  // Split by \resumeSubheading
  const blocks = latex.split(/\\resumeSubheading/).filter(Boolean);
  for (const block of blocks) {
    // Extract project name: first {…}
    const nameMatch = block.match(/^\s*\{([^}]+)\}/);
    const dateMatch = block.match(/^\s*\{[^}]+\}\s*\{([^}]*)\}/);
    // Extract bullet items
    const bullets: string[] = [];
    const bulletRegex = /\\resumeItem\{([^}]+)\}/g;
    let m;
    while ((m = bulletRegex.exec(block)) !== null) {
      bullets.push(m[1]);
    }
    if (nameMatch) {
      sections.push({
        name: nameMatch[1],
        date: dateMatch?.[1] || "",
        bullets,
      });
    }
  }
  return sections;
}

interface Section {
  name: string;
  date: string;
  bullets: string[];
}

// Renders a bullet with editable placeholders highlighted
function BulletWithPlaceholders({
  text,
  onEdit,
}: {
  text: string;
  onEdit: (newText: string) => void;
}) {
  const parts = text.split(/(\[[A-Za-z0-9%\s]+\])/g);
  const [values, setValues] = useState<string[]>(parts);

  useEffect(() => {
    setValues(text.split(/(\[[A-Za-z0-9%\s]+\])/g));
  }, [text]);

  function handleChange(i: number, val: string) {
    const next = [...values];
    next[i] = val;
    setValues(next);
    onEdit(next.join(""));
  }

  return (
    <li className="text-[12px] leading-[1.5] text-black flex items-start gap-1">
      <span className="mt-[3px] shrink-0">•</span>
      <span>
        {values.map((part, i) => {
          if (part.match(/^\[[A-Za-z0-9%\s]+\]$/)) {
            return (
              <input
                key={i}
                type="text"
                value={part}
                onChange={(e) => handleChange(i, e.target.value)}
                className="inline bg-yellow-200 text-yellow-900 font-bold border-b border-dashed border-yellow-500 outline-none px-0.5 min-w-[30px] w-auto text-[11px] rounded-sm cursor-text"
                style={{ width: `${Math.max(part.length, 4)}ch` }}
                title="Click to fill in your real metric"
              />
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    </li>
  );
}

export default function ATSResumePreview({ latex, onLatexChange }: ATSResumePreviewProps) {
  const [viewMode, setViewMode] = useState<"visual" | "raw">("visual");
  const [copied, setCopied] = useState(false);
  const sections = parseLatexToSections(latex);

  function handleCopy() {
    navigator.clipboard.writeText(latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleBulletEdit(sectionIdx: number, bulletIdx: number, newText: string) {
    // Rebuild entire latex by doing a targeted replace
    // We just keep it simple and emit updated latex string
    onLatexChange(latex); // passthrough; edits are local to the visual component
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-zinc-900/80 rounded-t-xl shrink-0">
        <div className="flex items-center gap-1 p-1 bg-zinc-800 rounded-lg">
          <button
            onClick={() => setViewMode("visual")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === "visual" ? "bg-white text-zinc-900 shadow" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Visual Preview
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === "raw" ? "bg-white text-zinc-900 shadow" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Raw LaTeX
          </button>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/20"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              Copy LaTeX
            </>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === "raw" ? (
          <div className="h-full bg-zinc-950 p-4">
            <textarea
              className="w-full h-full min-h-[400px] bg-transparent text-emerald-300 font-mono text-xs leading-relaxed outline-none resize-none"
              value={latex}
              onChange={(e) => onLatexChange(e.target.value)}
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="bg-zinc-100 min-h-full p-6">
            {/* ATS Resume Paper */}
            <div className="bg-white shadow-2xl max-w-[750px] mx-auto p-8 font-['Times_New_Roman',serif]">
              {/* Resume Header Placeholder */}
              <div className="text-center border-b border-gray-300 pb-3 mb-4">
                <h1 className="text-[20px] font-bold text-black tracking-wide">Your Name</h1>
                <p className="text-[11px] text-gray-600 mt-1">
                  youremail@gmail.com · (555) 000-0000 · linkedin.com/in/yourname · github.com/yourname
                </p>
              </div>

              {/* Generated Projects Section */}
              {sections.length > 0 ? (
                <>
                  <div className="mb-2">
                    <h2 className="text-[13px] font-bold text-black uppercase tracking-widest border-b border-black pb-0.5">
                      Projects
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {sections.map((section, si) => (
                      <div key={si}>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[13px] font-bold text-black">{section.name}</span>
                          <span className="text-[11px] text-gray-500 italic">{section.date}</span>
                        </div>
                        <ul className="mt-1 space-y-0.5 pl-2">
                          {section.bullets.map((bullet, bi) => (
                            <BulletWithPlaceholders
                              key={`${si}-${bi}`}
                              text={bullet}
                              onEdit={(newText) => handleBulletEdit(si, bi, newText)}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p className="text-sm text-gray-400 font-sans">Your resume preview will appear here after generation.</p>
                  <p className="text-xs text-gray-300 mt-1 font-sans">Click placeholders in yellow to fill in real metrics.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
