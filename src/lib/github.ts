import { Octokit } from "@octokit/rest";

export async function fetchUserGitHubData(accessToken: string) {
  const octokit = new Octokit({ auth: accessToken });
  
  // Get authenticated user
  const { data: user } = await octokit.rest.users.getAuthenticated();
  
  // Get user's public repositories, sorted by recently updated
  const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 5, // Just top 5 to avoid rate limits during dev
    visibility: "public",
  });
  
  const enrichedRepos = await Promise.all(repos.map(async (repo) => {
    // 1. Fetch languages for complexity heuristic
    const { data: languages } = await octokit.rest.repos.listLanguages({
      owner: repo.owner.login,
      repo: repo.name,
    });
    
    // 2. Fetch README
    let readme = null;
    try {
      const { data: readmeData } = await octokit.rest.repos.getReadme({
        owner: repo.owner.login,
        repo: repo.name,
      });
      // Decode base64 
      readme = Buffer.from(readmeData.content, 'base64').toString('utf8');
    } catch (e) {
      console.log(`No README found for ${repo.name}`);
    }

    // 3. Deep Codebase Traversal: Fetch full tree and high-value source code snippets
    let architecture: string[] = [];
    let codeSnippets: string[] = [];
    try {
      const { data: repoData } = await octokit.rest.repos.get({
        owner: repo.owner.login,
        repo: repo.name
      });
      const branch = repoData.default_branch;

      const { data: treeData } = await octokit.rest.git.getTree({
        owner: repo.owner.login,
        repo: repo.name,
        tree_sha: branch,
        recursive: "1"
      });

      const allFiles = treeData.tree.filter(t => t.type === 'blob' && t.path);
      
      // Filter out boilerplate
      const ignorePattern = /node_modules|\.git|package-lock\.json|yarn\.lock|dist|build|\.jpg|\.png|\.svg|\.ico|\.mp4/i;
      const sourceFiles = allFiles.filter(item => !ignorePattern.test(item.path as string));
      
      // Save top 50 paths for architecture outline
      architecture = sourceFiles.map(item => item.path as string).slice(0, 50);

      // Identify high value files for snippet extraction
      const highValuePattern = /\.(ts|tsx|py|rs|cpp|go|js|jsx)$/i;
      const highValueFiles = sourceFiles.filter(item => highValuePattern.test(item.path as string));
      
      // Sort by size descending (heuristic for complexity) and take top 3 files
      highValueFiles.sort((a, b) => (b.size || 0) - (a.size || 0));
      const topFiles = highValueFiles.slice(0, 3);
      
      for (const file of topFiles) {
        if (!file.sha) continue;
        try {
          const { data: blobData } = await octokit.rest.git.getBlob({
            owner: repo.owner.login,
            repo: repo.name,
            file_sha: file.sha
          });
          
          if (blobData.encoding === 'base64') {
            const decoded = Buffer.from(blobData.content, 'base64').toString('utf8');
            // Extract a snippet (first 1000 characters) to pass into Gemini context
            codeSnippets.push(`--- File: ${file.path} ---\n${decoded.substring(0, 1000)}...`);
          }
        } catch(blobErr) {
          console.log(`Could not fetch blob for ${file.path}`);
        }
      }
    } catch(e) {
      console.log(`Could not fetch architecture or tree for ${repo.name}`);
    }
    
    return {
      name: repo.name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      primaryLanguage: repo.language,
      languages,
      architecture,
      codeSnippets,
      readme: readme ? readme.substring(0, 500) + "..." : null, // Trucate for UI preview
      updatedAt: repo.updated_at,
    };
  }));
  
  return { user, repos: enrichedRepos };
}
