"use client";

// Orchestrates the full client → Vercel Blob → Gemini → generation pipeline.
// Beyond a single `stage`, it exposes the training as it is being built —
// video, then documentation, then question texts, then each question's answer
// options one at a time — so the UI can reveal the result piece by piece.

import { useCallback, useRef, useState } from "react";
import { uploadVideoToBlob } from "./upload-video";
import type {
  ApiError,
  BuildingQuestion,
  DocsRequest,
  DocsResponse,
  OptionsRequest,
  OptionsResponse,
  QuestionsRequest,
  QuestionsResponse,
  StageId,
  StatusResponse,
  UploadRequest,
  UploadResponse,
} from "./types";

export interface PipelineError {
  message: string;
  /** The stage that was running when the failure happened. */
  step: StageId;
}

export type PipelineStage = StageId | "idle";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

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

export interface UsePipelineReturn {
  stage: PipelineStage;
  /** Upload percentage (0-100), only meaningful while stage === "uploading". */
  progress: number;
  /** Blob URL of the uploaded video, available from the upload step onward. */
  videoUrl: string | null;
  /** Generated documentation markdown, null until it's ready. */
  markdown: string | null;
  /** Questions as they're built; each `options` is null until generated. */
  questions: BuildingQuestion[];
  run: (file: File, model: string, numberOfQuestions: number) => Promise<void>;
  reset: () => void;
  error: PipelineError | null;
}

export function usePipeline(): UsePipelineReturn {
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [questions, setQuestions] = useState<BuildingQuestion[]>([]);
  const [error, setError] = useState<PipelineError | null>(null);
  const runIdRef = useRef(0);

  const reset = useCallback(() => {
    // Bumping the run id makes any in-flight run's late updates no-ops.
    runIdRef.current += 1;
    setStage("idle");
    setProgress(0);
    setVideoUrl(null);
    setMarkdown(null);
    setQuestions([]);
    setError(null);
  }, []);

  const run = useCallback(
    async (file: File, model: string, numberOfQuestions: number) => {
      const runId = ++runIdRef.current;
      const isCurrent = () => runIdRef.current === runId;

      setError(null);
      setMarkdown(null);
      setQuestions([]);
      setVideoUrl(null);
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
        setVideoUrl(blobUrl);

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

        // 4. Docs and questions only need `fileName`, so we fetch them
        // concurrently but reveal them in order: documentation first, then the
        // question texts.
        goto("generating_docs");
        const docsPromise = postJson<DocsResponse>("/api/generate/docs", {
          fileName,
          model,
        } satisfies DocsRequest);
        const questionsPromise = postJson<QuestionsResponse>(
          "/api/generate/questions",
          { fileName, model, numberOfQuestions } satisfies QuestionsRequest,
        );

        const docsRes = await docsPromise;
        if (!isCurrent()) return;
        setMarkdown(docsRes.markdown);

        // 5. Reveal the question texts (answers still pending).
        goto("generating_questions");
        const questionsRes = await questionsPromise;
        if (!isCurrent()) return;
        const cores = questionsRes.questions;
        setQuestions(
          cores.map((core, index) => ({
            order: index + 1,
            question: core.question,
            correctReason: core.correctReason,
            timestamp: core.timestamp,
            options: null,
          })),
        );

        // 6. Build answer options one question at a time, revealing each as it
        // completes. Sequential + the cheap model keeps it reliable and fast
        // enough without ever overrunning a serverless timeout.
        goto("generating_options");
        for (let i = 0; i < cores.length; i++) {
          const order = i + 1;
          const { question } = await postJson<OptionsResponse>(
            "/api/generate/options",
            { question: cores[i], order } satisfies OptionsRequest,
          );
          if (!isCurrent()) return;
          setQuestions((prev) =>
            prev.map((q) =>
              q.order === question.order
                ? { ...q, options: question.options }
                : q,
            ),
          );
        }

        goto("done");
      } catch (err) {
        if (!isCurrent()) return;
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setError({ message, step: activeStep });
        setStage("idle");
      }
    },
    [],
  );

  return { stage, progress, videoUrl, markdown, questions, run, reset, error };
}
