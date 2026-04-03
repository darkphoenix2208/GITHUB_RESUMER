// ─── Whisper Web Worker ───────────────────────────────────────────────────────
// Runs Xenova/whisper-tiny entirely off the main thread.
// Model files are cached in the browser's Cache API after the first ~40MB download.
// ──────────────────────────────────────────────────────────────────────────────

let pipeline = null;
let transcriber = null;

async function loadTransformers() {
  if (pipeline) return;
  // Dynamic import from CDN – this is the official ESM entry point
  const module = await import(
    "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2"
  );
  pipeline = module.pipeline;
  // Configure environment
  module.env.allowLocalModels = false;
  module.env.useBrowserCache = true;
}

// ── INIT: Download & cache Whisper model ──────────────────────────────────────
async function initModel() {
  try {
    self.postMessage({ type: "init_progress", status: "loading_library" });
    await loadTransformers();

    self.postMessage({
      type: "init_progress",
      status: "downloading_model",
      progress: 0,
    });

    transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny",
      {
        progress_callback: (data) => {
          if (data.status === "progress") {
            self.postMessage({
              type: "init_progress",
              status: "downloading_model",
              file: data.file,
              progress: data.progress,
            });
          }
          if (data.status === "ready") {
            self.postMessage({
              type: "init_progress",
              status: "ready",
              file: data.file,
            });
          }
        },
      }
    );

    self.postMessage({ type: "init_complete" });
  } catch (err) {
    self.postMessage({ type: "error", error: String(err) });
  }
}

// ── TRANSCRIBE: Process Float32Array audio at 16kHz ───────────────────────────
async function transcribe(audio) {
  if (!transcriber) {
    self.postMessage({ type: "error", error: "Model not initialized yet." });
    return;
  }

  try {
    self.postMessage({ type: "transcribe_start" });

    const result = await transcriber(audio, {
      // null = auto-detect language (multilingual)
      language: null,
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    });

    const text = (result.text || "").trim();
    self.postMessage({ type: "transcribe_complete", text });
  } catch (err) {
    self.postMessage({ type: "error", error: String(err) });
  }
}

// ── Message router ────────────────────────────────────────────────────────────
self.onmessage = async (event) => {
  const { type, audio } = event.data;
  if (type === "init") await initModel();
  if (type === "transcribe") await transcribe(audio);
};
