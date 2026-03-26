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

  // ── PASS 1: Technical Draft ──────────────────────────────────────────────
  const pass1Prompt = `You are an expert Staff Engineer and resume writer.
Below is a Job Description and matched GitHub repositories with detected technical patterns.

Target Job Description:
${jd}

Candidate's Matched Repositories:
${matchedRepos.map(r => `
  Repo: ${r.name}
  Description: ${r.description || "N/A"}
  Languages: ${Object.keys(r.languages || {}).join(", ")}
  Architecture: ${(r.architecture || []).slice(0, 10).join(", ")}
  Power Signals (advanced patterns found in code):
${(r.metrics?.powerSignals || []).map((s: string) => `    • ${s}`).join("\n") || "    • None detected"}
  Code Snippets:
${(r.codeSnippets || []).join("\n")}
`).join("\n---\n")}

Task:
Write ATS-optimized resume bullets in RAW LaTeX. 3-4 bullets per repo.
CRITICALLY: If Power Signals are listed, reference them directly in the bullets (e.g. "Engineered thread-safe buffers using std::mutex and std::condition_variable").
Use [X]% or [N] placeholders for unknown metrics.

Output Format:
\\resumeSubheading
  {Project Name}{Date}
  {Personal Project | Role}{GitHub}
  \\resumeItemListStart
    \\resumeItem{Bullet}
  \\resumeItemListEnd

Return ONLY raw LaTeX. No markdown fences.`;

  const draft = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: pass1Prompt }],
    temperature: 0.35,
    max_tokens: 2048,
  });

  let draftText = draft.choices[0]?.message?.content || "";

  // ── PASS 2: Humanization ─────────────────────────────────────────────────
  // Replace AI filler with authentic ownership verbs
  const pass2Prompt = `You are a professional resume editor with 15 years of experience.

Below is a LaTeX resume draft that may contain AI-sounding filler words.

Your task:
1. Replace weak/AI filler verbs with strong ownership verbs from this list:
   - REPLACE: "leveraged", "utilized", "spearheaded", "pioneered", "facilitated", "ensured", "streamlined"
   - WITH: "architected", "built", "engineered", "optimized", "shipped", "eliminated", "reduced", "fixed", "wrote", "designed"
2. Ensure every bullet starts with a past-tense action verb.
3. Keep ALL LaTeX syntax exactly intact. Do NOT add or remove \\resumeItem, \\resumeSubheading, or any braces.
4. Return ONLY the corrected LaTeX. No explanations, no markdown.

Draft:
${draftText}`;

  const humanized = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: pass2Prompt }],
    temperature: 0.2,
    max_tokens: 2048,
  });

  let finalText = humanized.choices[0]?.message?.content || draftText;

  // Strip any accidental markdown fences
  finalText = finalText
    .replace(/^```latex\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  return finalText;
}
