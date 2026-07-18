"use client";

// Orchestrates the full client → Vercel Blob → Gemini → generation pipeline,
// exposing a single `stage` value the UI can render as a stepper.

import { useCallback, useRef, useState } from "react";
import { uploadVideoToBlob } from "./upload-video";
import type {
  ApiError,
  DocsRequest,
  DocsResponse,
  GeneratedQuestion,
  OptionsRequest,
  OptionsResponse,
  QuestionsRequest,
  QuestionsResponse,
  StageId,
  StatusResponse,
  UploadRequest,
  UploadResponse,
} from "./types";

export interface PipelineResult {
  videoUrl: string;
  markdown: string;
  questions: GeneratedQuestion[];
}

export interface PipelineError {
  message: string;
  /** The stage that was running when the failure happened. */
  step: StageId;
}

export type PipelineStage = StageId | "idle";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const OPTIONS_CHUNK_SIZE = 5;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `Request to ${url} failed (${res.status}).`;
    try {
      const body = (await res.json()) as Partial<ApiError>;
      if (body?.error) message = body.error;
    } catch {
      // Response wasn't JSON; keep the default message.
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, { method: "POST", body: JSON.stringify(body) });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilActive(
  fileName: string,
  isCurrent: () => boolean,
): Promise<void> {
  const start = Date.now();
  while (isCurrent()) {
    const { state } = await fetchJson<StatusResponse>(
      `/api/gemini/status?name=${encodeURIComponent(fileName)}`,
    );
    if (state === "ACTIVE") return;
    if (state === "FAILED") {
      throw new Error("Gemini failed to process the video. Please try again.");
    }
    if (Date.now() - start > POLL_TIMEOUT_MS) {
      throw new Error(
        "Timed out waiting for Gemini to finish processing the video.",
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export interface UsePipelineReturn {
  stage: PipelineStage;
  /** Upload percentage (0-100), only meaningful while stage === "uploading". */
  progress: number;
  run: (file: File, model: string, numberOfQuestions: number) => Promise<void>;
  reset: () => void;
  result: PipelineResult | null;
  error: PipelineError | null;
}

export function usePipeline(): UsePipelineReturn {
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<PipelineError | null>(null);
  const runIdRef = useRef(0);

  const reset = useCallback(() => {
    // Bumping the run id makes any in-flight run's late updates no-ops.
    runIdRef.current += 1;
    setStage("idle");
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  const run = useCallback(async (file: File, model: string, numberOfQuestions: number) => {
    const runId = ++runIdRef.current;
    const isCurrent = () => runIdRef.current === runId;

    setError(null);
    setResult(null);
    setProgress(0);

    // Tracks the stage currently executing so a failure can report where it
    // happened, even after the stage state is reset back to "idle".
    let activeStep: StageId = "uploading";
    const goto = (step: StageId) => {
      activeStep = step;
      setStage(step);
    };

    try {
      // 1. Upload the raw video straight to Vercel Blob.
      goto("uploading");
      const blobUrl = await uploadVideoToBlob(file, (pct) => {
        if (isCurrent()) setProgress(pct);
      });
      if (!isCurrent()) return;

      // 2. Hand the blob to Gemini's Files API.
      goto("gemini_upload");
      const { fileName } = await postJson<UploadResponse>(
        "/api/gemini/upload",
        { blobUrl } satisfies UploadRequest,
      );
      if (!isCurrent()) return;

      // 3. Wait for Gemini to finish ingesting the file.
      goto("processing");
      await pollUntilActive(fileName, isCurrent);
      if (!isCurrent()) return;

      // 4 & 5. Docs and question-writing both only need `fileName`, so they
      // run concurrently; we still advance the stage monotonically so the
      // stepper reads top-to-bottom.
      goto("generating_docs");
      const docsPromise = postJson<DocsResponse>("/api/generate/docs", {
        fileName,
        model,
      } satisfies DocsRequest);
      const questionsPromise = postJson<QuestionsResponse>(
        "/api/generate/questions",
        { fileName, model, numberOfQuestions } satisfies QuestionsRequest,
      );

      const questionsRes = await questionsPromise;
      if (!isCurrent()) return;
      goto("generating_questions");

      // 6. Build multiple-choice options for every question, chunked and
      // fired in parallel to stay well under any serverless timeout.
      goto("generating_options");
      const batches = chunk(questionsRes.questions, OPTIONS_CHUNK_SIZE);
      const optionsResults = await Promise.all(
        batches.map((batch, idx) =>
          postJson<OptionsResponse>("/api/generate/options", {
            model,
            questions: batch,
            startOrder: idx * OPTIONS_CHUNK_SIZE + 1,
          } satisfies OptionsRequest),
        ),
      );
      if (!isCurrent()) return;

      const questions = optionsResults
        .flatMap((r) => r.questions)
        .sort((a, b) => a.order - b.order);

      // Docs were kicked off in parallel with question generation; make sure
      // they're done before we call the pipeline complete.
      const { markdown } = await docsPromise;
      if (!isCurrent()) return;

      goto("done");
      setResult({ videoUrl: blobUrl, markdown, questions });
    } catch (err) {
      if (!isCurrent()) return;
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError({ message, step: activeStep });
      setStage("idle");
    }
  }, []);

  return { stage, progress, run, reset, result, error };
}
