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

// ── FILE PRIORITY SYSTEM ──────────────────────────────────────────────────────
// Assigns a priority tier (0 = critical, 1 = high, 2 = normal) to each file
// so we fetch the most architecturally significant files first.

const DEPENDENCY_FILES = new Set([
  "package.json", "requirements.txt", "pyproject.toml", "setup.py", "setup.cfg",
  "cargo.toml", "go.mod", "go.sum", "pom.xml", "build.gradle", "build.gradle.kts",
  "gemfile", "mix.exs", "composer.json", "pubspec.yaml",
]);

const CONFIG_FILES = new Set([
  "docker-compose.yml", "docker-compose.yaml", "dockerfile",
  "tsconfig.json", "webpack.config.js", "webpack.config.ts",
  "vite.config.js", "vite.config.ts", "next.config.js", "next.config.ts", "next.config.mjs",
  ".env.example", ".env.sample",
  "makefile", "cmakelists.txt",
  "jest.config.js", "jest.config.ts", "vitest.config.ts",
  "prisma/schema.prisma",
]);

const ENTRY_PATTERNS = [
  /^(src\/)?(main|index|app|server|worker)\.(ts|tsx|js|jsx|py|rs|go|cpp|c)$/i,
  /^(src\/)?lib\.(rs)$/i,
  /^(cmd|internal|pkg)\/.*\.(go)$/i,
  /^(src\/)?routes?\//i,
  /^(src\/)?api\//i,
  /^(src\/)?pages?\//i,
  /^(src\/)?middleware/i,
  /^(src\/)?models?\//i,
  /^(src\/)?services?\//i,
  /^(src\/)?controllers?\//i,
];

const CI_PATTERNS = [
  /^\.github\/workflows\/.+\.ya?ml$/i,
  /^\.gitlab-ci\.ya?ml$/i,
  /^Jenkinsfile$/i,
  /^\.circleci\/config\.ya?ml$/i,
];

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|rs|cpp|cc|cxx|c|h|hpp|go|java|kt|scala|rb|ex|exs|cs|swift|dart)$/i;

const IGNORE_PATTERN =
  /node_modules|\.git\/|package-lock\.json|yarn\.lock|pnpm-lock|dist\/|build\/|__pycache__|\.jpg|\.png|\.svg|\.ico|\.mp4|\.woff|\.ttf|\.eot|\.map$|\.min\.|vendor\/|target\/debug|\.next\//i;

interface PrioritizedFile {
  path: string;
  sha: string;
  size: number;
  priority: number; // 0 = critical, 1 = high, 2 = entry point, 3 = source
}

function prioritizeFiles(
  tree: { path?: string; sha?: string; size?: number; type?: string }[]
): PrioritizedFile[] {
  const files: PrioritizedFile[] = [];

  for (const t of tree) {
    if (t.type !== "blob" || !t.path || !t.sha) continue;
    if (IGNORE_PATTERN.test(t.path)) continue;

    const basename = t.path.split("/").pop()?.toLowerCase() || "";
    const size = t.size || 0;

    // Priority 0: Dependency / manifest files
    if (DEPENDENCY_FILES.has(basename) || t.path.toLowerCase() === "prisma/schema.prisma") {
      files.push({ path: t.path, sha: t.sha, size, priority: 0 });
      continue;
    }

    // Priority 0: CI/CD files
    if (CI_PATTERNS.some((p) => p.test(t.path!))) {
      files.push({ path: t.path, sha: t.sha, size, priority: 0 });
      continue;
    }

    // Priority 1: Config files
    if (CONFIG_FILES.has(basename) || /^dockerfile/i.test(basename)) {
      files.push({ path: t.path, sha: t.sha, size, priority: 1 });
      continue;
    }

    // Priority 2: Entry points & key architecture files
    if (ENTRY_PATTERNS.some((p) => p.test(t.path!))) {
      files.push({ path: t.path, sha: t.sha, size, priority: 2 });
      continue;
    }

    // Priority 3: All other source code files (ranked by size later)
    if (SOURCE_EXTENSIONS.test(t.path)) {
      files.push({ path: t.path, sha: t.sha, size, priority: 3 });
    }
  }

  // Sort: priority ascending, then size descending (larger files = more logic)
  files.sort((a, b) => a.priority - b.priority || b.size - a.size);
  return files;
}

// ── PHASE 2B: DEEP FETCH (only for selected repos, used for LaTeX generation)
// Does the expensive tree traversal + prioritized blob fetch for a single repo.
// Only called AFTER the user selects repos for resume generation.
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

  // 2. README (full — up to 3000 chars for generation context)
  let readme: string | null = null;
  try {
    const { data: readmeData } = await octokit.rest.repos.getReadme({
      owner,
      repo: repoName,
    });
    readme = Buffer.from(readmeData.content, "base64").toString("utf8").substring(0, 3000);
  } catch {
    // No README — fine
  }

  // 3. Architecture tree + prioritized file fetching
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

    // Full file tree (for architecture display & test detection)
    const allFiles = treeData.tree.filter(
      (t) => t.type === "blob" && t.path && !IGNORE_PATTERN.test(t.path)
    );
    architecture = allFiles.map((t) => t.path as string).slice(0, 80);

    // Prioritize and select top files to fetch
    const prioritized = prioritizeFiles(treeData.tree);

    // Budget: up to 18 files total
    // - All priority 0 (critical) and 1 (config) files
    // - Up to 5 entry points
    // - Fill remaining slots with source files by size
    const toFetch: PrioritizedFile[] = [];
    const maxFiles = 18;
    const maxEntryPoints = 5;
    const maxSourceFiles = 8;

    let entryCount = 0;
    let sourceCount = 0;
    for (const f of prioritized) {
      if (toFetch.length >= maxFiles) break;
      if (f.priority <= 1) {
        toFetch.push(f);
      } else if (f.priority === 2 && entryCount < maxEntryPoints) {
        toFetch.push(f);
        entryCount++;
      } else if (f.priority === 3 && sourceCount < maxSourceFiles) {
        toFetch.push(f);
        sourceCount++;
      }
    }

    // Fetch all selected files in parallel (max 6 concurrent)
    await pLimit(
      toFetch.map((file) => async () => {
        try {
          const { data: blobData } = await octokit.rest.git.getBlob({
            owner,
            repo: repoName,
            file_sha: file.sha,
          });
          if (blobData.encoding === "base64") {
            const decoded = Buffer.from(blobData.content, "base64").toString("utf8");
            // Dependency/config files: capture more (3000 chars)
            // Source files: 2000 chars
            const limit = file.priority <= 1 ? 3000 : 2000;
            const content = decoded.substring(0, limit);
            const tag = file.priority === 0 ? "DEPENDENCY" :
                        file.priority === 1 ? "CONFIG" :
                        file.priority === 2 ? "ENTRY_POINT" : "SOURCE";
            codeSnippets.push(`--- [${tag}] File: ${file.path} (${file.size} bytes) ---\n${content}`);
          }
        } catch {
          // Skip unreadable blobs
        }
      }),
      6
    );
  } catch {
    // Tree fetch failed — skip silently
  }

  return { languages, readme, architecture, codeSnippets };
}
