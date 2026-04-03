"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Utility: resample PCM audio to 16 kHz using OfflineAudioContext ──────────
async function resampleTo16kHz(
  audioData: Float32Array,
  inputSampleRate: number
): Promise<Float32Array> {
  if (inputSampleRate === 16000) return audioData;
  const targetLength = Math.round(
    (audioData.length * 16000) / inputSampleRate
  );
  const offlineCtx = new OfflineAudioContext(1, targetLength, 16000);
  const buffer = offlineCtx.createBuffer(1, audioData.length, inputSampleRate);
  buffer.copyToChannel(audioData, 0);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

// ── Public hook interface ────────────────────────────────────────────────────
export interface UseWhisperReturn {
  /** True while the ~40 MB model is being downloaded (first run only). */
  isModelLoading: boolean;
  /** True once the model is ready for inference. */
  modelReady: boolean;
  /** 0-100 download progress for the model files. */
  modelProgress: number;
  /** True while the microphone is actively recording. */
  isListening: boolean;
  /** True while Whisper is transcribing the recorded audio. */
  isTranscribing: boolean;
  /** The latest transcription result. */
  transcript: string;
  /** Kick off the one-time model download. */
  initModel: () => void;
  /** Start recording from the microphone. */
  startListening: () => Promise<void>;
  /** Stop recording and send audio to Whisper for transcription. */
  stopListening: () => void;
}

export function useWhisper(
  onTranscript?: (text: string) => void
): UseWhisperReturn {
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");

  // ── Spin up the worker once ────────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker("/whisper.worker.mjs", { type: "module" });

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case "init_progress":
          setModelProgress(Math.round(msg.progress ?? 0));
          break;
        case "init_complete":
          setIsModelLoading(false);
          setModelReady(true);
          setModelProgress(100);
          break;
        case "transcribe_start":
          setIsTranscribing(true);
          break;
        case "transcribe_complete":
          setIsTranscribing(false);
          setTranscript(msg.text);
          onTranscriptRef.current?.(msg.text);
          break;
        case "error":
          console.error("[useWhisper] Worker error:", msg.error);
          setIsModelLoading(false);
          setIsTranscribing(false);
          break;
      }
    };

    worker.onerror = (err) => {
      console.error("[useWhisper] Worker crashed:", err);
      setIsModelLoading(false);
      setIsTranscribing(false);
    };

    workerRef.current = worker;
    return () => {
      worker.terminate();
    };
  }, []);

  // ── Tear down mic resources ────────────────────────────────────────────────
  const cleanupMic = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    if (contextRef.current && contextRef.current.state !== "closed") {
      contextRef.current.close().catch(() => {});
    }
    contextRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // cleanup on unmount
  useEffect(() => cleanupMic, [cleanupMic]);

  // ── Public API ─────────────────────────────────────────────────────────────
  const initModel = useCallback(() => {
    if (!workerRef.current || modelReady || isModelLoading) return;
    setIsModelLoading(true);
    setModelProgress(0);
    workerRef.current.postMessage({ type: "init" });
  }, [modelReady, isModelLoading]);

  const startListening = useCallback(async () => {
    if (isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const context = new AudioContext();
      contextRef.current = context;

      const source = context.createMediaStreamSource(stream);
      // 4096 buffer, mono in, mono out
      const processor = context.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      chunksRef.current = [];

      processor.onaudioprocess = (ev) => {
        const pcm = ev.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(pcm));
      };

      source.connect(processor);
      processor.connect(context.destination);
      setIsListening(true);
    } catch (err) {
      console.error("[useWhisper] Mic access denied:", err);
    }
  }, [isListening]);

  const stopListening = useCallback(async () => {
    if (!isListening) return;
    setIsListening(false);

    const sampleRate = contextRef.current?.sampleRate ?? 44100;
    const chunks = [...chunksRef.current];
    cleanupMic();

    if (chunks.length === 0) return;

    // Merge all PCM chunks into one array
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Float32Array(totalLen);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.length;
    }

    // Resample to 16 kHz (Whisper's expected rate)
    const audio16k = await resampleTo16kHz(merged, sampleRate);

    // Transfer the buffer to the worker (zero-copy)
    workerRef.current?.postMessage(
      { type: "transcribe", audio: audio16k },
      [audio16k.buffer]
    );
  }, [isListening, cleanupMic]);

  return {
    isModelLoading,
    modelReady,
    modelProgress,
    isListening,
    isTranscribing,
    transcript,
    initModel,
    startListening,
    stopListening,
  };
}
