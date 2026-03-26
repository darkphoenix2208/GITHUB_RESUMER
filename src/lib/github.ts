import { Octokit } from "@octokit/rest";

// Concurrency limiter helper
async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  for (const task of tasks) {
    const p = task().then((r) => { results.push(r); });
    executing.push(p);
    if (executing.length >= limit) await Promise.race(executing);
    executing.splice(executing.findIndex((e) => e === p), 1);
  }
  await Promise.all(executing);
  return results;
}

// ── PHASE 1: FAST ─────────────────────────────────────────────
// Single API call. Returns basic metadata for all public repos.
// Used for the initial dashboard load — should finish in < 1s.
export async function fetchUserReposBasic(accessToken: string) {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.rest.users.getAuthenticated();
  const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
    visibility: "public",
  });

  return {
    user,
    repos: repos.map((repo) => ({
      name: repo.name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      primaryLanguage: repo.language,
      updatedAt: repo.updated_at,
      owner: repo.owner.login,
      // Empty — filled in by deep fetch
      languages: {} as Record<string, number>,
      architecture: [] as string[],
      codeSnippets: [] as string[],
      readme: null as string | null,
    })),
  };
}

// ── PHASE 2A: README BATCH FETCH (for all repos, used for matching) ────────
// Fetches only READMEs in parallel (max 10 concurrent). Much cheaper than
// full tree traversal. Used to enrich the semantic matching step.
export async function fetchAllRepoReadmes(
  accessToken: string,
  repos: { name: string; owner: string }[]
): Promise<Record<string, string>> {
  const octokit = new Octokit({ auth: accessToken });
  const readmeMap: Record<string, string> = {};

  await pLimit(
    repos.map((repo) => async () => {
      try {
        const { data } = await octokit.rest.repos.getReadme({
          owner: repo.owner,
          repo: repo.name,
        });
        readmeMap[repo.name] = Buffer.from(data.content, "base64")
          .toString("utf8")
          .substring(0, 800); // 800 chars is plenty for semantic matching
      } catch {
        readmeMap[repo.name] = ""; // No README
      }
    }),
    10 // max 10 concurrent GitHub requests
  );

  return readmeMap;
}

// ── PHASE 2B: DEEP FETCH (only for top 3, used for LaTeX generation) ────────
// Does the expensive tree traversal + blob fetch for a single repo.
// Only called AFTER matching has selected the top repos.
export async function fetchRepoDeepData(
  accessToken: string,
  owner: string,
  repoName: string
) {
  const octokit = new Octokit({ auth: accessToken });

  // 1. Languages
  const { data: languages } = await octokit.rest.repos.listLanguages({
    owner,
    repo: repoName,
  });

  // 2. README
  let readme: string | null = null;
  try {
    const { data: readmeData } = await octokit.rest.repos.getReadme({
      owner,
      repo: repoName,
    });
    readme = Buffer.from(readmeData.content, "base64").toString("utf8").substring(0, 1500);
  } catch {
    // No README — fine
  }

  // 3. Architecture tree + code snippets
  let architecture: string[] = [];
  let codeSnippets: string[] = [];
  try {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo: repoName });
    const branch = repoData.default_branch;

    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo: repoName,
      tree_sha: branch,
      recursive: "1",
    });

    const ignorePattern =
      /node_modules|\.git|package-lock\.json|yarn\.lock|dist|build|\.jpg|\.png|\.svg|\.ico|\.mp4/i;
    const sourceFiles = treeData.tree.filter(
      (t) => t.type === "blob" && t.path && !ignorePattern.test(t.path)
    );

    architecture = sourceFiles.map((t) => t.path as string).slice(0, 50);

    const highValuePattern = /\.(ts|tsx|py|rs|cpp|go|js|jsx)$/i;
    const highValueFiles = sourceFiles
      .filter((t) => highValuePattern.test(t.path as string))
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 3);

    for (const file of highValueFiles) {
      if (!file.sha) continue;
      try {
        const { data: blobData } = await octokit.rest.git.getBlob({
          owner,
          repo: repoName,
          file_sha: file.sha,
        });
        if (blobData.encoding === "base64") {
          const decoded = Buffer.from(blobData.content, "base64").toString("utf8");
          codeSnippets.push(`--- File: ${file.path} ---\n${decoded.substring(0, 1000)}...`);
        }
      } catch {
        // Skip unreadable blobs
      }
    }
  } catch {
    // Tree fetch failed — skip silently
  }

  return { languages, readme, architecture, codeSnippets };
}
