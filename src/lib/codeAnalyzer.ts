/**
 * codeAnalyzer.ts — "Quant-Depth" Quality Engine
 *
 * Calculates:
 *  - Cyclomatic Complexity (CC)
 *  - Halstead Volume (HV) — approximated via tokenisation
 *  - Maintainability Index (MI): MAX(0,(171-5.2*ln(HV)-0.23*CC-16.2*ln(LOC))*100/171)
 *  - Documentation Ratio
 *  - Power Signals — 30+ patterns across C++, Python, TypeScript, Rust, Go
 */

export interface CodeMetrics {
  cyclomaticComplexity: number;
  halsteadVolume: number;
  maintainabilityIndex: number;
  linesOfCode: number;
  docRatio: number;
  hasTests: boolean;
  powerSignals: string[];
  grade: "A" | "B" | "C" | "D";
}

// ── POWER SIGNAL PATTERNS — "Quant-Depth" Edition ────────────────────────────
const POWER_SIGNAL_PATTERNS: Record<string, { pattern: RegExp; label: string }[]> = {
  cpp: [
    // Concurrency & Thread-Safety
    { pattern: /std::mutex|std::lock_guard|std::unique_lock|std::scoped_lock/, label: "Thread-safe synchronization (std::mutex / scoped_lock)" },
    { pattern: /std::condition_variable/, label: "Condition variable for producer-consumer concurrency" },
    { pattern: /std::atomic/, label: "Lock-free atomics (std::atomic<T>)" },
    { pattern: /std::thread|std::async|std::future|std::promise/, label: "Multi-threading with std::thread / async futures" },
    // Lock-free & Low-latency memory ordering
    { pattern: /memory_order_relaxed|memory_order_acquire|memory_order_release|memory_order_seq_cst/, label: "Explicit memory ordering for lock-free data structures" },
    { pattern: /compare_exchange_weak|compare_exchange_strong|fetch_add|fetch_sub/, label: "Compare-and-swap (CAS) lock-free operations" },
    { pattern: /volatile\s+\w/, label: "Volatile memory access (hardware register / signal handling)" },
    // Memory & Custom Allocators
    { pattern: /mmap|munmap|mprotect|madvise/, label: "Memory-mapped I/O (mmap) for zero-copy data access" },
    { pattern: /reinterpret_cast|static_cast|const_cast/, label: "Low-level type casting (reinterpret_cast / static_cast)" },
    { pattern: /operator\s+new|placement\s+new|allocator_traits/, label: "Custom memory allocator (operator new / placement new)" },
    { pattern: /aligned_alloc|posix_memalign|__attribute__.*aligned/, label: "Cache-line aligned memory allocation" },
    // SIMD & GPU
    { pattern: /_mm256_|__m256|_mm_|__m128|_mm512_|__m512/, label: "SIMD/AVX vectorization intrinsics (256/512-bit)" },
    { pattern: /__global__|cudaMemcpy|cudaMalloc|cudaLaunchKernel|__device__/, label: "CUDA GPU kernel execution" },
    // Networking & I/O
    { pattern: /sys\/socket\.h|poll\.h|netinet|AF_INET|SOCK_STREAM|SOCK_DGRAM/, label: "Direct socket programming (sys/socket.h, poll.h)" },
    { pattern: /epoll_create|epoll_ctl|epoll_wait/, label: "High-performance event I/O (epoll)" },
    { pattern: /io_uring_submit|io_uring_queue_init/, label: "io_uring async I/O (Linux kernel ring buffer)" },
    // Advanced Templates & Compile-time
    { pattern: /constexpr\s+(auto|int|bool|size_t|void)/, label: "Compile-time computation (constexpr)" },
    { pattern: /static_assert/, label: "Compile-time type assertions (static_assert)" },
    { pattern: /std::enable_if|std::is_same|std::decay/, label: "Template metaprogramming (SFINAE / type traits)" },
    // Smart Pointers & RAII
    { pattern: /shared_ptr|unique_ptr|weak_ptr|make_shared|make_unique/, label: "RAII memory management (smart pointers)" },
  ],
  python: [
    { pattern: /asyncio\.(run|create_task|gather|sleep|Queue|Event|Lock)/, label: "Async/await concurrent I/O (asyncio)" },
    { pattern: /aiohttp\.|aiofiles\.|asyncpg\./, label: "Asynchronous data pipeline (aiohttp / aiofiles)" },
    { pattern: /multiprocessing\.(Pool|Process|Queue|Manager)/, label: "Multiprocessing parallelism" },
    { pattern: /concurrent\.futures/, label: "Thread/process pool executor" },
    { pattern: /np\.vectorize|np\.einsum|np\.frompyfunc/, label: "Vectorized NumPy operations (np.vectorize / einsum)" },
    { pattern: /pandas\.rolling|\.rolling\(|\.ewm\(|\.expanding\(/, label: "Pandas rolling-window time-series analysis" },
    { pattern: /@numba\.jit|@njit|@numba\.cuda\.jit|@vectorize/, label: "JIT-compiled Numba kernel (numba.jit)" },
    { pattern: /torch\.|tensorflow\.|jax\.|keras\./, label: "Deep learning framework integration" },
    { pattern: /\.to\('cuda'\)|\.cuda\b|cudaMemcpy/, label: "GPU acceleration (CUDA / PyTorch)" },
    { pattern: /ray\.remote|dask\.|celery\./, label: "Distributed computing (Ray/Dask/Celery)" },
    { pattern: /from fastapi|import FastAPI/i, label: "High-performance ASGI API (FastAPI)" },
    { pattern: /@lru_cache|@cache|functools\.cache/, label: "Memoization / caching strategy" },
    { pattern: /ctypes\.|cffi\.|struct\.pack/, label: "Low-level C interop (ctypes/cffi)" },
  ],
  typescript: [
    { pattern: /new Worker\(|SharedArrayBuffer|Atomics\./, label: "Web Worker multi-threading" },
    { pattern: /WebSocket|ws\.on\(|socket\.io/, label: "Real-time WebSocket communication" },
    { pattern: /Redis|ioredis|createClient/, label: "Redis distributed caching layer" },
    { pattern: /kafka|bullmq|amqp/i, label: "Message queue / event-driven architecture (Kafka/BullMQ)" },
    { pattern: /Promise\.all|Promise\.allSettled|Promise\.race/, label: "Parallel async orchestration" },
    { pattern: /zod\.|yup\.|io-ts\./, label: "Runtime type validation (Zod)" },
    { pattern: /trpc\.|graphql|Apollo/, label: "Type-safe API layer (tRPC/GraphQL)" },
    { pattern: /prisma\.|drizzle\.|typeorm\./i, label: "ORM / database abstraction layer" },
    { pattern: /opentelemetry|dd-trace|@sentry/, label: "Distributed tracing / observability" },
    { pattern: /p-limit|p-queue|bottleneck/, label: "Concurrency-limited async request management" },
  ],
  rust: [
    { pattern: /Arc<Mutex|Mutex::new|RwLock/, label: "Thread-safe shared state (Arc<Mutex>)" },
    { pattern: /tokio::spawn|tokio::select|async fn/, label: "Async Tokio runtime concurrency" },
    { pattern: /unsafe\s*\{/, label: "Unsafe Rust (raw pointer / FFI optimization)" },
    { pattern: /rayon::|par_iter\(\)/, label: "Data parallelism (Rayon)" },
    { pattern: /crossbeam::|flume::/, label: "Lock-free channels (crossbeam)" },
    { pattern: /#\[derive\(Serialize|serde::/, label: "Zero-copy serialization (Serde)" },
  ],
  go: [
    { pattern: /go\s+func/, label: "Goroutine concurrency" },
    { pattern: /sync\.Mutex|sync\.RWMutex/, label: "Mutex synchronization" },
    { pattern: /chan\s+/, label: "Channel-based message passing" },
    { pattern: /context\.WithCancel|context\.WithTimeout/, label: "Context-aware cancellation" },
    { pattern: /sync\.WaitGroup/, label: "WaitGroup fan-out concurrency pattern" },
    { pattern: /pprof\.|runtime\.GOMAXPROCS/, label: "Go runtime profiling / tuning" },
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
function calcCyclomaticComplexity(code: string): number {
  const patterns = [
    /\bif\b/g, /\belse\s+if\b/g, /\bfor\b/g, /\bwhile\b/g,
    /\bswitch\b/g, /\bcatch\b/g, /\bcase\b/g, /&&|\|\|/g,
  ];
  let count = 1;
  for (const p of patterns) {
    count += (code.match(new RegExp(p.source, "g")) || []).length;
  }
  return count;
}

// ── LOC ────────────────────────────────────────────────────────────────────────
function calcLOC(code: string): number {
  return code.split("\n").filter((l) => l.trim().length > 0).length;
}

// ── DOCUMENTATION RATIO ────────────────────────────────────────────────────────
function calcDocRatio(code: string): number {
  const lines = code.split("\n");
  const total = lines.filter((l) => l.trim().length > 0).length;
  if (total === 0) return 0;
  const comments = lines.filter((l) =>
    /^\s*(\/\/|#|\/\*|\*|"""|'''|<!--)/.test(l)
  ).length;
  return Math.min(comments / total, 1);
}

// ── HALSTEAD VOLUME (approximation) ───────────────────────────────────────────
function calcHalsteadVolume(code: string): number {
  const opRe = /[+\-*/%=<>!&|^~?:]+|(\b(if|else|for|while|return|new|delete|typeof|instanceof|void|in|of)\b)/g;
  const operandRe = /\b([a-zA-Z_$][a-zA-Z0-9_$]*|\d+(\.\d+)?|"[^"]*"|'[^']*')\b/g;
  const operators = code.match(opRe) || [];
  const operands = code.match(operandRe) || [];
  const vocab = new Set(operators).size + new Set(operands).size;
  const length = operators.length + operands.length;
  if (vocab <= 1) return 1;
  return length * Math.log2(vocab);
}

// ── MAINTAINABILITY INDEX ──────────────────────────────────────────────────────
// MI = MAX(0, (171 - 5.2*ln(HV) - 0.23*CC - 16.2*ln(LOC)) * 100 / 171)
function calcMI(hv: number, cc: number, loc: number): number {
  const raw = (171 - 5.2 * Math.log(Math.max(hv, 1)) - 0.23 * cc - 16.2 * Math.log(Math.max(loc, 1))) * 100 / 171;
  return Math.max(0, Math.min(100, raw));
}

function miGrade(mi: number): "A" | "B" | "C" | "D" {
  if (mi >= 75) return "A";
  if (mi >= 55) return "B";
  if (mi >= 30) return "C";
  return "D";
}

// ── POWER SIGNALS SCANNER ──────────────────────────────────────────────────────
function scanPowerSignals(snippets: string[]): string[] {
  const found = new Set<string>();
  for (const snippet of snippets) {
    const fileHeader = snippet.match(/--- File: ([^\s]+)/)?.[1] || "";
    const lang = detectLang(fileHeader);
    if (!lang) continue;
    for (const { pattern, label } of POWER_SIGNAL_PATTERNS[lang] || []) {
      if (pattern.test(snippet)) {
        found.add(label);
        // Reset regex lastIndex for safety
        pattern.lastIndex = 0;
      }
    }
  }
  return Array.from(found);
}

// ── TEST DETECTION ─────────────────────────────────────────────────────────────
function detectTests(arch: string[]): boolean {
  return arch.some((p) => /test|spec|__tests__|_test\.|\.test\.|\.spec\./i.test(p));
}

// ── MAIN EXPORT ────────────────────────────────────────────────────────────────
export function analyzeRepo(repo: { codeSnippets: string[]; architecture: string[] }): CodeMetrics {
  const allCode = repo.codeSnippets.join("\n");
  const cc   = calcCyclomaticComplexity(allCode);
  const loc  = calcLOC(allCode);
  const hv   = calcHalsteadVolume(allCode);
  const mi   = calcMI(hv, cc, loc);
  const doc  = calcDocRatio(allCode);
  return {
    cyclomaticComplexity: Math.round(cc),
    halsteadVolume:       Math.round(hv),
    maintainabilityIndex: Math.round(mi),
    linesOfCode: loc,
    docRatio:    Math.round(doc * 100) / 100,
    hasTests:    detectTests(repo.architecture),
    powerSignals: scanPowerSignals(repo.codeSnippets),
    grade: miGrade(mi),
  };
}
