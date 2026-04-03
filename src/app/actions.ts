"use server"

import { matchRepositories, generateResumeBullets, summarizeCodebase } from "@/lib/gemini";
import { fetchAllRepoReadmes, fetchRepoDeepData } from "@/lib/github";
import { analyzeRepo } from "@/lib/codeAnalyzer";

// Phase 1: Score all repos — fast, no deep fetch
// Returns ALL repos ranked by combined score for the user to review/select
export async function scoreRepositories(jd: string, repos: any[]) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const accessToken = repos[0]?._accessToken;

  // Fetch READMEs for all repos (lightweight — adds real content to scoring)
  const readmeMap = await fetchAllRepoReadmes(
    accessToken,
    repos.map((r: any) => ({ name: r.name, owner: r.owner }))
  );

  const reposWithReadme = repos.map((r: any) => ({
    ...r,
    readme: readmeMap[r.name] || "",
  }));

  // Return ALL repos ranked — slice done by the UI
  return await matchRepositories(jd, reposWithReadme);
}

// Phase 2: Generate resume for user-selected repos (user picks, not AI)
// Pipeline: Deep Fetch → Code Analysis → Codebase Summarization → Resume Generation
export async function generateForSelected(
  jd: string,
  allScoredRepos: any[],
  selectedRepoNames: string[]
) {
  const accessToken = allScoredRepos[0]?._accessToken;

  // Only deep-fetch the user's chosen repos
  const selectedRepos = allScoredRepos.filter((r) => selectedRepoNames.includes(r.name));

  // Step 1: Deep fetch all files (15-20 prioritized files per repo)
  const enrichedRepos = await Promise.all(
    selectedRepos.map(async (repo: any) => {
      try {
        const deep = await fetchRepoDeepData(accessToken, repo.owner, repo.name);

        // Step 2: Static code analysis (power signals, complexity metrics)
        const metrics = analyzeRepo({
          codeSnippets: deep.codeSnippets,
          architecture: deep.architecture,
        });

        // Step 3: LLM-powered codebase summarization (compresses all files into a technical profile)
        const technicalProfile = await summarizeCodebase(
          repo.name,
          deep.codeSnippets,
          deep.architecture,
          deep.languages,
          deep.readme
        );

        return {
          ...repo,
          languages: deep.languages,
          readme: deep.readme ?? repo.readme,
          architecture: deep.architecture,
          codeSnippets: deep.codeSnippets,
          metrics,
          technicalProfile,
        };
      } catch (err) {
        console.error(`[generateForSelected] Error processing ${repo.name}:`, err);
        return repo;
      }
    })
  );

  // Step 4: Three-pass resume generation (Draft → Humanize → Clean)
  const latex = await generateResumeBullets(jd, enrichedRepos);
  return { enrichedRepos, latex };
}

