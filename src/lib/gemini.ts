import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export async function getEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Complexity bonus: boosts repos with heavy language stacks, penalizes trivial HTML/CSS-only sites
function complexityBonus(repo: any): number {
  const langs = Object.keys(repo.languages || {});
  // Heavyweight languages signal real engineering work
  const heavyLangs = ["C++", "Rust", "Go", "Python", "TypeScript", "Java", "C", "Scala", "Haskell"];
  const trivialLangs = ["HTML", "CSS", "SCSS", "Less"];

  const hasHeavy = langs.some((l) => heavyLangs.includes(l));
  const onlyTrivial = langs.length > 0 && langs.every((l) => trivialLangs.includes(l));
  const langCount = langs.length;

  // Penalize pure portfolio/HTML sites heavily
  if (onlyTrivial) return -0.15;
  // Penalize repos with no language data (likely empty repos)
  if (langCount === 0) return -0.10;
  // Reward multi-language or heavy-language repos
  let bonus = hasHeavy ? 0.06 : 0;
  bonus += Math.min(langCount * 0.01, 0.05); // up to +0.05 for many languages
  // Stars as a weak signal of real-world usage
  bonus += Math.min((repo.stars || 0) * 0.002, 0.04);
  return bonus;
}

// Phase 2: RAG Matching — returns ALL repos ranked by combined score
// (70% semantic similarity + 30% complexity signal)
export async function matchRepositories(jd: string, repos: any[]) {
  const jdEmbedding = await getEmbedding(jd);

  const reposWithScores = await Promise.all(
    repos.map(async (repo) => {
      // Build context — architecture may be empty at basic-fetch stage, that's fine
      const repoContext = [
        `Repository: ${repo.name}`,
        repo.description ? `Description: ${repo.description}` : "",
        `Languages: ${Object.keys(repo.languages || {}).join(", ")}`,
        repo.readme ? `README: ${repo.readme}` : "",
      ].filter(Boolean).join("\n");

      const repoEmbedding = await getEmbedding(repoContext);
      const semanticScore = cosineSimilarity(jdEmbedding, repoEmbedding);
      const bonus = complexityBonus(repo);
      // Combined score: semantic is primary signal, bonus adjusts ranking
      const combinedScore = semanticScore + bonus;

      return { ...repo, score: combinedScore, semanticScore, complexityBonus: bonus };
    })
  );

  // Sort by combined score descending — return ALL (UI lets user pick)
  reposWithScores.sort((a, b) => b.score - a.score);
  return reposWithScores;
}


// Phase 3: LaTeX Generation — Two-Pass (Technical Draft → Humanization)
export async function generateResumeBullets(jd: string, matchedRepos: any[]) {

  // Build repo context string
  const repoContext = matchedRepos.map(r => {
    const signals = (r.metrics?.powerSignals || []).map((s: string) => `    - ${s}`).join("\n") || "    - None detected";
    const snippets = (r.codeSnippets || []).join("\n");
    return [
      `  Repo: ${r.name}`,
      `  Description: ${r.description || "N/A"}`,
      `  Languages: ${Object.keys(r.languages || {}).join(", ")}`,
      `  Architecture: ${(r.architecture || []).slice(0, 10).join(", ")}`,
      "  Power Signals (advanced patterns found in code):",
      signals,
      "  Code Snippets:",
      snippets,
    ].join("\n");
  }).join("\n---\n");

  // ── PASS 1: Technical Draft ──────────────────────────────────────────────
  // NOTE: We use String.raw or array join to avoid JS interpreting \r \t \n \b \d \u
  // as escape sequences inside the LaTeX command names.
  const BS = "\\"; // single literal backslash

  const pass1Prompt = [
    "You are an expert Staff Engineer and resume writer.",
    "Below is a Job Description and matched GitHub repositories with detected technical patterns.",
    "",
    "Target Job Description:",
    jd,
    "",
    "Candidate's Matched Repositories:",
    repoContext,
    "",
    "Task:",
    "Write ATS-optimized resume bullets in RAW LaTeX. 3-4 bullets per repo.",
    'CRITICALLY: If Power Signals are listed, reference them directly in the bullets (e.g. "Engineered thread-safe buffers using std::mutex and std::condition_variable").',
    "Use [X]% or [N] placeholders for unknown metrics.",
    "",
    "IMPORTANT FORMATTING RULES:",
    "- Use SINGLE backslash for all LaTeX commands.",
    "- Do NOT use double backslashes before command names.",
    "- The ONLY allowed LaTeX commands are these custom resume macros (prefixed with a single backslash):",
    "  resumeSubheading, resumeItem, resumeItemListStart, resumeItemListEnd",
    "- Do NOT use any standard LaTeX formatting commands (no bold, italic, underline, href, url, etc.)",
    "- Each bullet must contain ONLY plain text inside the braces. No nested LaTeX commands.",
    "- Do NOT include any document preamble, package imports, or document environment wrappers.",
    "",
    "Output Format (follow this EXACTLY — single backslash before each command):",
    BS + "resumeSubheading",
    "  {Project Name}{Date}",
    "  {Personal Project | Role}{GitHub}",
    "  " + BS + "resumeItemListStart",
    "    " + BS + "resumeItem{Plain text bullet point here}",
    "  " + BS + "resumeItemListEnd",
    "",
    "Return ONLY raw LaTeX. No markdown fences, no explanations.",
  ].join("\n");

  const draft = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: pass1Prompt }],
    temperature: 0.35,
    max_tokens: 2048,
  });

  let draftText = draft.choices[0]?.message?.content || "";

  // ── PASS 2: Ownership-First Humanization ─────────────────────────────────
  const powerSignalContext = matchedRepos
    .flatMap((r: any) => r.metrics?.powerSignals || [])
    .filter(Boolean)
    .slice(0, 12)
    .map((s: string) => `  - ${s}`)
    .join("\n");

  const pass2Prompt = [
    "You are a Staff-level Engineering Resume Reviewer with 15 years of experience at FAANG and HFT firms.",
    "",
    "You have been handed a DRAFT LaTeX resume that was written by an AI. Your job is to make it sound like it was written by a senior engineer who personally built all of this.",
    "",
    "=== STRICT BAN LIST - remove every instance of these words ===",
    "leveraged, utilized, spearheaded, pioneered, facilitated, ensured, streamlined,",
    "synergized, maximized, enabled, empowered, harnessed, employed, implemented (when describing your own code - replace with what you actually did)",
    "",
    "=== OWNERSHIP VERB REPLACEMENTS ===",
    "Instead of vague filler, use verbs that show personal ownership:",
    '- "built", "wrote", "engineered", "architected", "designed", "shipped"',
    '- "eliminated", "reduced", "fixed", "optimized", "profiled", "debugged"',
    '- "scaled", "migrated", "refactored", "benchmarked", "integrated"',
    "",
    "=== ARCHITECTURAL CONTEXT TO INJECT ===",
    "The code scanner found these specific technical patterns in the actual source code.",
    "Where relevant, REFERENCE THEM BY NAME in the bullets - this proves technical authenticity:",
    powerSignalContext || "  - No advanced patterns detected",
    "",
    "=== YOUR REWRITE RULES ===",
    "1. Every bullet MUST start with a past-tense ownership verb (never a noun or article).",
    "2. At least one bullet per project MUST reference a specific technical mechanism (algorithm, protocol, data structure, or pattern).",
    "3. Numbers and metrics in [brackets] must be preserved exactly - do not remove them.",
    '4. Remove any bullet that starts with "Utilized", "Leveraged", or "Spearheaded" and rewrite it entirely.',
    "5. Keep ALL custom LaTeX macros intact (resumeItem, resumeSubheading, resumeItemListStart, resumeItemListEnd).",
    "6. Do NOT add new bullet entries. Do NOT delete existing ones.",
    "7. Do NOT use any standard LaTeX commands (no bold, italic, underline, href, etc.) inside bullet text. Only plain text.",
    "8. Return ONLY the corrected LaTeX - no explanations, no markdown fences, no commentary.",
    "",
    "DRAFT TO REVIEW:",
    draftText,
  ].join("\n");

  const humanized = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: pass2Prompt }],
    temperature: 0.2,
    max_tokens: 2048,
  });

  let finalText = humanized.choices[0]?.message?.content || draftText;

  // ── Post-processing: normalize LaTeX output ──────────────────────────────
  // Regex note: In JS regex, a single \\ matches one literal backslash in the string.
  finalText = finalText
    // Strip markdown fences
    .replace(/^```(?:latex)?\n?/gm, "")
    .replace(/\n?```$/gm, "")
    // Normalize double/triple backslashes to single for custom macros
    .replace(/\\{2,}(resumeSubheading|resumeItem|resumeItemListStart|resumeItemListEnd|resumeSubHeadingListStart|resumeSubHeadingListEnd|resumeProjectHeading)/g, "\\$1")
    // Unwrap stray LaTeX formatting commands, keeping their inner text
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\textit\{([^}]*)\}/g, "$1")
    .replace(/\\emph\{([^}]*)\}/g, "$1")
    .replace(/\\underline\{([^}]*)\}/g, "$1")
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\url\{([^}]*)\}/g, "$1")
    // Remove standalone formatting commands
    .replace(/\\(noindent|smallskip|medskip|bigskip|newline|linebreak|pagebreak|clearpage|newpage)\b[^\n]*/g, "")
    // Remove vspace/hspace with their arguments
    .replace(/\\[vh]space\{[^}]*\}/g, "")
    // Remove document structure commands
    .replace(/\\(begin|end)\{[^}]*\}/g, "")
    .replace(/\\(documentclass|usepackage|input|include|newcommand|renewcommand|def)\b[^\n]*/g, "")
    // Clean up multiple blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return finalText;
}
