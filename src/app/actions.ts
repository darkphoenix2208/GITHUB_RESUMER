"use server"

import { matchRepositories, generateResumeBullets } from "@/lib/gemini";
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
// selectedRepoNames: the repos the user checked in the UI
export async function generateForSelected(
  jd: string,
  allScoredRepos: any[],
  selectedRepoNames: string[]
) {
  const accessToken = allScoredRepos[0]?._accessToken;

  // Only deep-fetch the user's chosen repos
  const selectedRepos = allScoredRepos.filter((r) => selectedRepoNames.includes(r.name));

  const enrichedRepos = await Promise.all(
    selectedRepos.map(async (repo: any) => {
      try {
        const deep = await fetchRepoDeepData(accessToken, repo.owner, repo.name);
        const metrics = analyzeRepo({
          codeSnippets: deep.codeSnippets,
          architecture: deep.architecture,
        });
        return {
          ...repo,
          languages: deep.languages,
          readme: deep.readme ?? repo.readme,
          architecture: deep.architecture,
          codeSnippets: deep.codeSnippets,
          metrics,
        };
      } catch {
        return repo;
      }
    })
  );

  const latex = await generateResumeBullets(jd, enrichedRepos);
  return { enrichedRepos, latex };
}
