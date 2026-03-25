"use server"

import { matchRepositories, generateResumeBullets } from "@/lib/gemini";

export async function processJobDescription(jd: string, repos: any[]) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  
  // 1. RAG Matching
  const matchedRepos = await matchRepositories(jd, repos);
  
  // 2. LLM LaTeX Generation
  const latex = await generateResumeBullets(jd, matchedRepos);
  
  return {
    matchedRepos,
    latex
  };
}
