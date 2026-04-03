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
// 80% semantic similarity + 20% complexity signal (weighted blend)
export async function matchRepositories(jd: string, repos: any[]) {
  const jdEmbedding = await getEmbedding(jd);

  const reposWithScores = await Promise.all(
    repos.map(async (repo) => {
      // Build richer context for embedding — more text = better semantic matching
      const descPart = repo.description ? `Description: ${repo.description}` : "";
      const langPart = Object.keys(repo.languages || {}).length > 0
        ? `Technologies: ${Object.keys(repo.languages || {}).join(", ")}`
        : "";
      // Truncate README to avoid embedding overload but keep enough for topic detection
      const readmePart = repo.readme
        ? `README highlights: ${repo.readme.slice(0, 1500)}`
        : "";

      const repoContext = [
        `Project: ${repo.name}`,
        descPart,
        langPart,
        readmePart,
      ].filter(Boolean).join("\n");

      const repoEmbedding = await getEmbedding(repoContext);
      const semanticScore = cosineSimilarity(jdEmbedding, repoEmbedding);
      const bonus = complexityBonus(repo);

      // Weighted blend: semantic is primary, complexity adjusts
      // Clamp to [0, 1] range for cleaner display
      const combinedScore = Math.min(
        Math.max(semanticScore * 0.80 + (0.5 + bonus) * 0.20, 0),
        1
      );

      return {
        ...repo,
        score: combinedScore,
        semanticScore,
        complexityBonus: bonus,
      };
    })
  );

  // Sort by combined score descending — return ALL (UI lets user pick)
  reposWithScores.sort((a, b) => b.score - a.score);
  return reposWithScores;
}


// ── Phase 2.5: Deep Codebase Summarization ──────────────────────────────────
// Takes all fetched file contents and produces a structured technical profile.
// This compresses ~40KB of source code into ~500 tokens of high-signal context.
export async function summarizeCodebase(
  repoName: string,
  codeSnippets: string[],
  architecture: string[],
  languages: Record<string, number>,
  readme: string | null
): Promise<string> {
  if (codeSnippets.length === 0) return "";

  // Separate files by type for the prompt
  const depFiles = codeSnippets.filter(s => s.includes("[DEPENDENCY]"));
  const configFiles = codeSnippets.filter(s => s.includes("[CONFIG]"));
  const entryFiles = codeSnippets.filter(s => s.includes("[ENTRY_POINT]"));
  const sourceFiles = codeSnippets.filter(s => s.includes("[SOURCE]"));

  const fileTree = architecture.slice(0, 60).join("\n");
  const langBreakdown = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, bytes]) => `${lang}: ${Math.round(bytes / 1024)}KB`)
    .join(", ");

  const prompt = [
    `Analyze this GitHub repository "${repoName}" and produce a structured technical profile.`,
    "",
    "=== LANGUAGE BREAKDOWN ===",
    langBreakdown || "No language data",
    "",
    "=== FILE TREE (partial) ===",
    fileTree,
    "",
    "=== DEPENDENCY/MANIFEST FILES ===",
    depFiles.length > 0 ? depFiles.join("\n\n") : "None found",
    "",
    "=== CONFIGURATION FILES ===",
    configFiles.length > 0 ? configFiles.join("\n\n") : "None found",
    "",
    "=== ENTRY POINTS / CORE FILES ===",
    entryFiles.length > 0 ? entryFiles.join("\n\n") : "None found",
    "",
    "=== SOURCE CODE SAMPLES ===",
    sourceFiles.length > 0 ? sourceFiles.join("\n\n") : "None found",
    "",
    readme ? `=== README (excerpt) ===\n${readme.substring(0, 1000)}` : "",
    "",
    "=== YOUR TASK ===",
    "Based on ALL the above files, produce a TECHNICAL PROFILE of this project.",
    "Be specific - name exact libraries, frameworks, algorithms, and patterns you see in the actual code.",
    "",
    "Format your response EXACTLY like this (no markdown, just plain text):",
    "",
    "TECH STACK: [list every framework, library, and tool found in dependencies and code]",
    "ARCHITECTURE: [describe the app's architecture: monolith/microservices, API style, data flow]",
    "KEY PATTERNS: [list specific design patterns, algorithms, and engineering techniques found in source code]",
    "DATABASE/STORAGE: [databases, caches, file storage, message queues found]",
    "INFRASTRUCTURE: [CI/CD, containers, cloud services, deployment patterns]",
    "TESTING: [testing frameworks, test types found]",
    "COMPLEXITY LEVEL: [toy project / learning project / production-grade / enterprise-grade]",
    "RESUME ANGLE: [one sentence describing the strongest angle for a resume bullet]",
    "",
    "Be concise but specific. Reference actual library names and patterns you see in the code.",
  ].join("\n");

  try {
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 800,
    });
    return result.choices[0]?.message?.content || "";
  } catch (err) {
    console.error("[summarizeCodebase] Error:", err);
    return "";
  }
}


// Phase 3: LaTeX Generation — Three-Pass (Summarize → Draft → Humanize)
export async function generateResumeBullets(jd: string, matchedRepos: any[]) {

  // Build repo context string — now includes the technical profile
  const repoContext = matchedRepos.map(r => {
    const signals = (r.metrics?.powerSignals || []).map((s: string) => `    - ${s}`).join("\n") || "    - None detected";
    const profile = r.technicalProfile || "";

    // Include key code snippets (entry points + source only, skip dep/config — those are in the profile)
    const keySnippets = (r.codeSnippets || [])
      .filter((s: string) => s.includes("[ENTRY_POINT]") || s.includes("[SOURCE]"))
      .slice(0, 4) // max 4 source excerpts per repo
      .join("\n");

    return [
      `  Repo: ${r.name}`,
      `  Description: ${r.description || "N/A"}`,
      `  Languages: ${Object.keys(r.languages || {}).join(", ")}`,
      `  File Structure: ${(r.architecture || []).slice(0, 15).join(", ")}`,
      "",
      "  === DEEP TECHNICAL PROFILE (from full codebase analysis) ===",
      profile ? "  " + profile.split("\n").join("\n  ") : "  No profile available",
      "",
      "  === POWER SIGNALS (patterns detected in source code) ===",
      signals,
      "",
      "  === KEY SOURCE CODE ===",
      keySnippets || "  No source code available",
    ].join("\n");
  }).join("\n\n===== NEXT REPOSITORY =====\n\n");

  // ── PASS 1: Technical Draft ──────────────────────────────────────────────
  const BS = "\\"; // single literal backslash

  const pass1Prompt = [
    "You are an expert Staff Engineer and resume writer.",
    "Below is a Job Description and matched GitHub repositories with DEEP technical analysis.",
    "The technical profile was generated from analyzing the ENTIRE CODEBASE - dependencies, configs, entry points, and all source files.",
    "",
    "Target Job Description:",
    jd,
    "",
    "Candidate's Matched Repositories (with full codebase analysis):",
    repoContext,
    "",
    "Task:",
    "Write ATS-optimized resume bullets in RAW LaTeX. 3-4 bullets per repo.",
    "",
    "CRITICAL INSTRUCTIONS:",
    "- Use the DEEP TECHNICAL PROFILE to write bullets that reference SPECIFIC technologies, patterns, and architecture decisions found in the actual code.",
    "- If the profile mentions specific frameworks (e.g., Next.js, FastAPI, Prisma), NAME THEM in bullets.",
    "- If the profile mentions architecture patterns (e.g., event-driven, microservices, pub/sub), DESCRIBE THEM.",
    "- If Power Signals list specific low-level patterns (e.g., lock-free atomics, CUDA kernels), reference those exact patterns.",
    "- Use [X]% or [N] placeholders for unknown metrics.",
    "- Every bullet must demonstrate OWNERSHIP - start with action verbs.",
    "",
    "FORMATTING RULES:",
    "- Use SINGLE backslash for all LaTeX commands.",
    "- The ONLY allowed commands: resumeSubheading, resumeItem, resumeItemListStart, resumeItemListEnd",
    "- Each bullet must contain ONLY plain text. No LaTeX formatting commands.",
    "- Do NOT include any document preamble or environment wrappers.",
    "",
    "Output Format:",
    BS + "resumeSubheading",
    "  {Project Name}{Date}",
    "  {Personal Project | Role}{GitHub}",
    "  " + BS + "resumeItemListStart",
    "    " + BS + "resumeItem{Plain text bullet point referencing actual tech from the codebase}",
    "  " + BS + "resumeItemListEnd",
    "",
    "Return ONLY raw LaTeX. No markdown fences, no explanations.",
  ].join("\n");

  const draft = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: pass1Prompt }],
    temperature: 0.35,
    max_tokens: 3000,
  });

  let draftText = draft.choices[0]?.message?.content || "";

  // ── PASS 2: Ownership-First Humanization ─────────────────────────────────
  const powerSignalContext = matchedRepos
    .flatMap((r: any) => r.metrics?.powerSignals || [])
    .filter(Boolean)
    .slice(0, 12)
    .map((s: string) => `  - ${s}`)
    .join("\n");

  const techProfileContext = matchedRepos
    .map((r: any) => r.technicalProfile || "")
    .filter(Boolean)
    .join("\n\n");

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
    "=== TECHNICAL CONTEXT FROM CODEBASE ANALYSIS ===",
    "This is the actual tech stack and architecture found by analyzing the source code.",
    "Ensure bullets reference these REAL technologies, not generic terms:",
    techProfileContext || "  No profile available",
    "",
    "=== POWER SIGNALS FROM CODE SCANNER ===",
    powerSignalContext || "  - No advanced patterns detected",
    "",
    "=== YOUR REWRITE RULES ===",
    "1. Every bullet MUST start with a past-tense ownership verb (never a noun or article).",
    "2. At least one bullet per project MUST reference a specific technical mechanism found in the actual codebase analysis above.",
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
    max_tokens: 3000,
  });

  let finalText = humanized.choices[0]?.message?.content || draftText;

  // ── Post-processing: normalize LaTeX output ──────────────────────────────
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

