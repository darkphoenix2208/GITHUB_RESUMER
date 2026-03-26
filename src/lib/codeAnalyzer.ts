/**
 * codeAnalyzer.ts
 * 
 * Quality Engine for Repo-to-Resume.
 * Calculates:
 *  - Cyclomatic Complexity (CC)
 *  - Halstead Volume (HV)
 *  - Maintainability Index (MI) per the standard formula
 *  - Documentation Ratio
 *  - Power Signals (advanced patterns that indicate technical depth)
 */

export interface CodeMetrics {
  cyclomaticComplexity: number;
  halsteadVolume: number;
  maintainabilityIndex: number;  // 0-100 scale
  linesOfCode: number;
  docRatio: number;              // 0-1 scale
  hasTests: boolean;
  powerSignals: string[];        // e.g. ["Uses std::mutex (thread-safety)", "CUDA kernel detected"]
  grade: "A" | "B" | "C" | "D"; // derived from MI score
}

// ── POWER SIGNAL PATTERNS ─────────────────────────────────────────────────────
// These are patterns that indicate advanced technical depth — perfect for resume bullets.
const POWER_SIGNAL_PATTERNS: Record<string, { pattern: RegExp; label: string }[]> = {
  cpp: [
    { pattern: /std::mutex|std::lock_guard|std::unique_lock/g, label: "Thread-safe synchronization (std::mutex)" },
    { pattern: /std::condition_variable/g, label: "Condition variable concurrency pattern" },
    { pattern: /std::atomic/g, label: "Lock-free atomics (std::atomic)" },
    { pattern: /std::thread|std::async/g, label: "Multi-threading (std::thread)" },
    { pattern: /__global__|cudaMemcpy|cudaLaunchKernel/g, label: "CUDA GPU kernel execution" },
    { pattern: /_mm256_|__m256|_mm_|__m128/g, label: "SIMD/AVX vectorization intrinsics" },
    { pattern: /mmap|munmap|mprotect/g, label: "Memory-mapped I/O (mmap)" },
    { pattern: /epoll_|kqueue|io_uring/g, label: "High-performance async I/O (epoll/io_uring)" },
    { pattern: /CRTP|template.*template/g, label: "Advanced C++ template metaprogramming (CRTP)" },
    { pattern: /shared_ptr|unique_ptr|weak_ptr/g, label: "RAII memory management (smart pointers)" },
    { pattern: /constexpr|static_assert/g, label: "Compile-time computation (constexpr)" },
  ],
  python: [
    { pattern: /asyncio\.(run|create_task|gather|sleep)/g, label: "Async/await concurrent I/O (asyncio)" },
    { pattern: /multiprocessing\.(Pool|Process|Queue)/g, label: "Multiprocessing parallelism" },
    { pattern: /from\s+fastapi|import\s+FastAPI/gi, label: "High-performance API design (FastAPI)" },
    { pattern: /torch\.|tensorflow\.|jax\./g, label: "Deep learning framework integration" },
    { pattern: /cuda\(\)|\.to\('cuda'\)|\.gpu\(\)/g, label: "GPU acceleration (CUDA)" },
    { pattern: /np\.vectorize|np\.einsum|numba\.|@jit/g, label: "Vectorized numerical computing (NumPy/Numba)" },
    { pattern: /ray\.remote|dask\.|celery\./g, label: "Distributed computing (Ray/Dask/Celery)" },
    { pattern: /pydantic|dataclass|TypedDict/g, label: "Type-safe data validation (Pydantic)" },
    { pattern: /@lru_cache|@cache|functools\.cache/g, label: "Memoization / caching strategy" },
  ],
  typescript: [
    { pattern: /new\s+Worker\(|SharedArrayBuffer|Atomics\./g, label: "Web Worker multi-threading" },
    { pattern: /WebSocket|ws\.on|socket\.io/g, label: "Real-time WebSocket communication" },
    { pattern: /Redis|ioredis|createClient/g, label: "Redis distributed caching layer" },
    { pattern: /kafka|bullmq|amqp/gi, label: "Message queue / event-driven architecture" },
    { pattern: /Promise\.all|Promise\.allSettled|Promise\.race/g, label: "Parallel async orchestration" },
    { pattern: /zod\.|yup\.|io-ts\./g, label: "Runtime type validation (Zod)" },
    { pattern: /trpc\.|graphql|Apollo/g, label: "Type-safe API layer (tRPC/GraphQL)" },
    { pattern: /prisma\.|drizzle\.|typeorm\./gi, label: "ORM / database abstraction layer" },
  ],
  rust: [
    { pattern: /Arc<Mutex|Mutex::new|RwLock/g, label: "Thread-safe shared state (Arc<Mutex>)" },
    { pattern: /tokio::spawn|tokio::select|async fn/g, label: "Async Tokio runtime concurrency" },
    { pattern: /unsafe\s*\{/g, label: "Unsafe Rust (raw pointer / FFI optimization)" },
    { pattern: /rayon::|par_iter\(\)/g, label: "Data parallelism (Rayon)" },
    { pattern: /crossbeam::|flume::/g, label: "Lock-free channels (crossbeam)" },
    { pattern: /#\[derive\(Serialize|serde::/g, label: "Zero-copy serialization (Serde)" },
  ],
  go: [
    { pattern: /go\s+func|goroutine/g, label: "Goroutine concurrency" },
    { pattern: /sync\.Mutex|sync\.RWMutex/g, label: "Mutex synchronization" },
    { pattern: /chan\s+|<-\s*chan/g, label: "Channel-based message passing" },
    { pattern: /context\.WithCancel|context\.WithTimeout/g, label: "Context-aware cancellation" },
  ],
};

// Detect language from file extension
function detectLang(filename: string): keyof typeof POWER_SIGNAL_PATTERNS | null {
  if (/\.(cpp|cc|cxx|hpp|h)$/i.test(filename)) return "cpp";
  if (/\.(py|pyw)$/i.test(filename)) return "python";
  if (/\.(ts|tsx|js|jsx)$/i.test(filename)) return "typescript";
  if (/\.rs$/i.test(filename)) return "rust";
  if (/\.go$/i.test(filename)) return "go";
  return null;
}

// ── CYCLOMATIC COMPLEXITY ─────────────────────────────────────────────────────
// Counts decision points: each branch increases complexity by 1.
function calcCyclomaticComplexity(code: string): number {
  const decisionPatterns = [
    /\bif\b/g, /\belse\s+if\b/g, /\bfor\b/g, /\bwhile\b/g,
    /\bswitch\b/g, /\bcatch\b/g, /\bcase\b/g,
    /&&|\|\|/g,  // logical operators add implicit branches
    /\?\s*[^:]+\s*:/g, // ternary
  ];
  let count = 1; // baseline complexity = 1
  for (const pattern of decisionPatterns) {
    count += (code.match(new RegExp(pattern.source, "g")) || []).length;
  }
  return count;
}

// ── LOC (lines of code, excluding blanks) ─────────────────────────────────────
function calcLOC(code: string): number {
  return code.split("\n").filter((l) => l.trim().length > 0).length;
}

// ── DOCUMENTATION RATIO ───────────────────────────────────────────────────────
function calcDocRatio(code: string): number {
  const lines = code.split("\n");
  const totalLines = lines.filter((l) => l.trim().length > 0).length;
  if (totalLines === 0) return 0;
  const commentLines = lines.filter((l) =>
    /^\s*(\/\/|#|\/\*|\*|"""|'''|<!--)/.test(l)
  ).length;
  return Math.min(commentLines / totalLines, 1);
}

// ── HALSTEAD VOLUME (approximation) ──────────────────────────────────────────
// A full Halstead implementation requires tokenization. We approximate by counting
// unique operators and operands via keyword and symbol frequency.
function calcHalsteadVolume(code: string): number {
  const operatorPattern = /[+\-*/%=<>!&|^~?:]+|(\b(if|else|for|while|return|new|delete|typeof|instanceof|void|in|of)\b)/g;
  const operandPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*|\d+(\.\d+)?|"[^"]*"|'[^']*')\b/g;

  const operators = code.match(operatorPattern) || [];
  const operands = code.match(operandPattern) || [];

  const n1 = new Set(operators).size; // unique operators
  const n2 = new Set(operands).size;  // unique operands
  const N1 = operators.length;         // total operators
  const N2 = operands.length;          // total operands

  const vocabulary = n1 + n2;
  const length = N1 + N2;

  if (vocabulary <= 1) return 1;
  return length * Math.log2(vocabulary);
}

// ── MAINTAINABILITY INDEX ─────────────────────────────────────────────────────
// MI = max(0, (171 - 5.2*ln(HV) - 0.23*CC - 16.2*ln(LOC)) * 100 / 171)
function calcMaintainabilityIndex(hv: number, cc: number, loc: number): number {
  const safeHV = Math.max(hv, 1);
  const safeLOC = Math.max(loc, 1);
  const raw = (171 - 5.2 * Math.log(safeHV) - 0.23 * cc - 16.2 * Math.log(safeLOC)) * 100 / 171;
  return Math.max(0, Math.min(100, raw));
}

function miGrade(mi: number): "A" | "B" | "C" | "D" {
  if (mi >= 75) return "A"; // Highly maintainable
  if (mi >= 55) return "B"; // Moderate
  if (mi >= 30) return "C"; // Warning zone
  return "D";               // Technical debt
}

// ── POWER SIGNALS SCANNER ─────────────────────────────────────────────────────
function scanPowerSignals(codeSnippets: string[]): string[] {
  const found = new Set<string>();

  for (const snippet of codeSnippets) {
    // Detect language from the --- File: path --- header
    const fileHeader = snippet.match(/--- File: ([^\s]+)/)?.[1] || "";
    const lang = detectLang(fileHeader);
    if (!lang) continue;

    const patterns = POWER_SIGNAL_PATTERNS[lang] || [];
    for (const { pattern, label } of patterns) {
      if (new RegExp(pattern.source, pattern.flags || "g").test(snippet)) {
        found.add(label);
      }
    }
  }

  return Array.from(found);
}

// ── TEST FILE DETECTION ───────────────────────────────────────────────────────
function detectTests(architecture: string[]): boolean {
  const testPattern = /test|spec|__tests__|_test\.|\.test\.|\.spec\./i;
  return architecture.some((path) => testPattern.test(path));
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export function analyzeRepo(repo: {
  codeSnippets: string[];
  architecture: string[];
}): CodeMetrics {
  // Combine all code snippets for aggregate metrics
  const allCode = repo.codeSnippets.join("\n");

  const cc = calcCyclomaticComplexity(allCode);
  const loc = calcLOC(allCode);
  const hv = calcHalsteadVolume(allCode);
  const mi = calcMaintainabilityIndex(hv, cc, loc);
  const docRatio = calcDocRatio(allCode);
  const hasTests = detectTests(repo.architecture);
  const powerSignals = scanPowerSignals(repo.codeSnippets);

  return {
    cyclomaticComplexity: Math.round(cc),
    halsteadVolume: Math.round(hv),
    maintainabilityIndex: Math.round(mi),
    linesOfCode: loc,
    docRatio: Math.round(docRatio * 100) / 100,
    hasTests,
    powerSignals,
    grade: miGrade(mi),
  };
}
