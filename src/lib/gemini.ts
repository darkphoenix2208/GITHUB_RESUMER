import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function getEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
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

// Phase 2: RAG Matching
export async function matchRepositories(jd: string, repos: any[]) {
  const jdEmbedding = await getEmbedding(jd);
  
  const reposWithScores = await Promise.all(
    repos.map(async (repo) => {
      // Create a contextual string out of the repo
      const repoContext = `
        Repository Name: ${repo.name}
        Description: ${repo.description}
        Languages: ${Object.keys(repo.languages || {}).join(", ")}
        Architecture: ${repo.architecture.join(", ")}
        README Snippet: ${repo.readme || ""}
        Code Snippets: ${(repo.codeSnippets || []).join("\n")}
      `;
      const repoEmbedding = await getEmbedding(repoContext);
      const score = cosineSimilarity(jdEmbedding, repoEmbedding);
      return { ...repo, score };
    })
  );

  // Sort by highest score first
  reposWithScores.sort((a, b) => b.score - a.score);
  return reposWithScores.slice(0, 3); // Return top 3
}

// Phase 3: LaTeX Generation
export async function generateResumeBullets(jd: string, matchedRepos: any[]) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are an expert Staff Engineer and resume writer. 
    Below is a target Job Description (JD) and the top mathematically matched GitHub repositories for a candidate.
    
    Target Job Description:
    ${jd}

    Candidate's Matched Repositories Context:
    ${matchedRepos.map(r => `
      - Repo: ${r.name}
      - Languages: ${Object.keys(r.languages || {}).join(", ")}
      - Outline: ${r.architecture.slice(0, 10).join(", ")}
      - Code Snippets: ${(r.codeSnippets || []).join("\n")}
      - Description: ${r.description}
    `).join("\n")}

    Task:
    Generate highly optimized, ATS-friendly resume bullet points in RAW LaTeX format (no markdown code blocks, just raw latex).
    For each matched repository, generate 3 to 4 professional, action-oriented bullet points.
    The bullet points MUST quantify achievements based on the inferred complexity from the provided context. If you can only infer the architecture and not the exact number, use explicit bracketed placeholders like [X]% or [N] users so the candidate can seamlessly fill them in later.
    Make it sound like an expert software engineer wrote it.

    Output Format:
    \\resumeSubheading
      {Project Name}{Date}
      {Role/Subtitle}{Location}
      \\resumeItemListStart
        \\resumeItem{Bullet point 1}
        \\resumeItem{Bullet point 2}
        \\resumeItem{Bullet point 3}
      \\resumeItemListEnd
    
    Return ONLY the LaTeX code. No surrounding explanations. Let's think step by step to ensure high quality, but only output the final LaTeX code block.
  `;

  const result = await model.generateContent(prompt);
  let text = result.response.text();
  
  // Clean up if the model wraps it in markdown
  if (text.startsWith("\`\`\`latex")) {
    text = text.replace(/^\`\`\`latex\n/, "").replace(/\n\`\`\`$/, "");
  } else if (text.startsWith("\`\`\`")) {
    text = text.replace(/^\`\`\`\n/, "").replace(/\n\`\`\`$/, "");
  }
  
  return text.trim();
}
