<div align="center">
  <br />
  <h1>🚀 RepoResumer (Engineering Intelligence Suite)</h1>
  <p>
    <strong>Transform your GitHub repositories into ATS-optimized LaTeX resumes and deployed engineering portfolios using mathematically verifiable AI.</strong>
  </p>
  <br />
</div>

## 🧠 What is RepoResumer?
RepoResumer is a mathematically-grounded SaaS platform built for software engineers, quants, and systems architects. It reads your raw GitHub repositories, extracts architectural patterns, measures your engineering value, and uses highly-tuned LLMs to generate a world-class **LaTeX Resume** and **Interactive RAG Portfolio** tailored exactly to a target Job Description.

It bypasses traditional "AI Resume Builders" by parsing your actual codebase, enforcing strict "ownership-first" wording constraints, banning generic AI filler, and generating pure machine-readable mathematical proof of work.

---

## ⚡ Core Features

### 1. The RAG Matching Engine
- Integrates `gemini-embedding-001` to cross-reference your GitHub READMEs, logic, and languages against any pasted **Target Job Description**.
- Ranks your repositories semantically to perfectly align your past work with the recruiter's exact required tech stack.

### 2. AST "Power Signal" Detection
- Scans source code for deep algorithmic complexity markers. 
- Detects high-level HFT/SysEng signals like `std::atomic`, `lock-free buffers`, `mmap`, `SIMD intrinsics`, and async multiplexing.
- Injects these exact architectural patterns into the generated resume bullets to prove deep technical competence.

### 3. Engineering Value Engine
- Built-in **COCOMO II Algorithmic Cost Estimator**.
- Parses repository size and complexity to automatically predict the time effort (in Person-Months) and estimated USD engineering value your open-source projects represent.
- Displays calculated Maintainability Indexes (MI) and Cyclomatic Complexity metadata.

### 4. Ownership-First Humanization (Two-Pass LLM)
- Uses **Llama-3.3-70b** (via Groq) as an embedded "Staff Engineer Reviewer".
- First pass drafts the technical metrics. The second pass strictly removes flagged AI-filler words (e.g., *leveraged*, *spearheaded*) replacing them with hard ownership verbs (*engineered*, *architected*, *shipped*).

### 5. Multi-Themed Interactive Portfolio & Chatbot
- Generates a standalone, client-rendered static web portfolio showcasing your best work.
- Includes a live **"Ask My Code" RAG Digital Avatar**. Recruiters can click the chatbot in your portfolio and interrogate an AI trained exclusively on your code snippets and architecture choices.
- Supports three environments: **Glass (Modern)**, **Terminal (Hacker)**, and **Bloomberg (Quant/HFT)**.

### 6. Social Proof Ingestion
- Hooks into WakaTime to prove raw coding hours.
- Parses Codeforces and LeetCode to append verified competitive programming ratings and difficulty solves directly into your resume's competitive programming LaTeX section.

---

## 🛠️ Tech Stack
- **Framework:** Next.js (App Router, React 18)
- **Styling:** Tailwind CSS + custom Glassmorphism/Terminal UI
- **AI / Embeddings:** Google Gemini (`gemini-embedding-001`)
- **LLM Engine:** Groq SDK (`llama-3.3-70b-versatile`)
- **Auth:** Next-Auth (GitHub Provider)
- **PDF Compiler:** Seamless integration with `latex.ytotech.com`

---

## ⚙️ Quick Start Installation

1. **Clone the repo**
   \`\`\`bash
   git clone https://github.com/your-username/GITHUB_RESUMER.git
   cd GITHUB_RESUMER
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configure Environment Variables**
   Create a \`.env.local\` file in the root directory:
   \`\`\`env
   # GitHub OAuth App
   GITHUB_ID="your_github_oauth_client_id"
   GITHUB_SECRET="your_github_oauth_client_secret"

   # Internal Next-Auth Secret
   AUTH_SECRET="your_random_auth_secret_string"

   # AI Providers
   GEMINI_API_KEY="your_google_gemini_api_key"
   GROQ_API_KEY="your_groq_api_key"
   \`\`\`

4. **Run the Development Server**
   \`\`\`bash
   npm run dev
   \`\`\`
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 💻 Usage Flow
1. **Connect GitHub:** Login via OAuth; the app immediately builds an index of your public repos.
2. **Setup Job Description:** Paste the specific JD you want to apply for.
3. **Score & Select:** Click "Score All Repos". The Gemini embedding engine ranks the best architectural fits.
4. **Generate Resume:** The Staff Engineer agent writes hyper-authentic, ATS-friendly LaTeX. Preview it live in the browser or hit "Export PDF" for the compiled document.
5. **Launch Portfolio:** Click the Launch Interactive Portfolio button to instantly generate a local, themed showcase site where recruiters can use the RAG Chatbot to interrogate your codebase.

---

<div align="center">
  <i>Built with absolute precision for elite engineering recruitment.</i>
</div>
