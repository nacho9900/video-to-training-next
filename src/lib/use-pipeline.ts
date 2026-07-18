"use client";

// Orchestrates the full client → Vercel Blob → Gemini → generation pipeline.
// Beyond a single `stage`, it exposes the training as it is being built —
// video, then documentation, then question texts, then each question's answer
// options one at a time — so the UI can reveal the result piece by piece.

import { useCallback, useRef, useState } from "react";
import { saveTraining } from "./history";
import { uploadVideoToBlob } from "./upload-video";
import type {
  ApiError,
  BuildingQuestion,
  DocsRequest,
  DocsResponse,
  GeneratedQuestion,
  OptionsRequest,
  OptionsResponse,
  QuestionsRequest,
  QuestionsResponse,
  StageId,
  StatusResponse,
  TitleRequest,
  TitleResponse,
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

function fallbackTitle(): string {
  return `Training — ${new Date().toLocaleDateString()}`;
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
  /** Short descriptive title of the training, null until it's ready. */
  title: string | null;
  /** Generated documentation markdown, null until it's ready. */
  markdown: string | null;
  /** True if documentation generation failed (the training still completes). */
  docsFailed: boolean;
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
  const [title, setTitle] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [docsFailed, setDocsFailed] = useState(false);
  const [questions, setQuestions] = useState<BuildingQuestion[]>([]);
  const [error, setError] = useState<PipelineError | null>(null);
  const runIdRef = useRef(0);
  // Object URL for the locally-selected file — we show the video straight from
  // the user's own file (not the uploaded blob), which always plays and avoids
  // any storage/serving quirks. Tracked here so we can revoke it.
  const objectUrlRef = useRef<string | null>(null);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    // Bumping the run id makes any in-flight run's late updates no-ops.
    runIdRef.current += 1;
    revokeObjectUrl();
    setStage("idle");
    setProgress(0);
    setVideoUrl(null);
    setTitle(null);
    setMarkdown(null);
    setDocsFailed(false);
    setQuestions([]);
    setError(null);
  }, [revokeObjectUrl]);

  const run = useCallback(
    async (file: File, model: string, numberOfQuestions: number) => {
      const runId = ++runIdRef.current;
      const isCurrent = () => runIdRef.current === runId;

      setError(null);
      setTitle(null);
      setMarkdown(null);
      setDocsFailed(false);
      setQuestions([]);
      setProgress(0);

      // Show the video straight from the user's local file — always plays and
      // is available instantly.
      revokeObjectUrl();
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setVideoUrl(objectUrl);

      // Tracks the stage currently executing so a failure can report where it
      // happened, even after the stage state is reset back to "idle".
      let activeStep: StageId = "uploading";
      const goto = (step: StageId) => {
        activeStep = step;
        setStage(step);
      };

      try {
        // 1. Upload the raw video straight to Vercel Blob (for Gemini to read).
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

        // 4. Documentation is the slowest single call (it produces a lot of
        // text), so we DON'T block on it — it reveals itself whenever it's
        // ready while questions and answers stream in parallel. Docs are
        // secondary (collapsed), so a docs failure doesn't fail the training.
        // Locals captured for saving the finished training to history.
        let docsMarkdown: string | null = null;
        let titleValue: string | null = null;
        const built: GeneratedQuestion[] = [];

        goto("generating_docs");
        const docsPromise = postJson<DocsResponse>("/api/generate/docs", {
          fileName,
          model,
        } satisfies DocsRequest)
          .then((res) => {
            docsMarkdown = res.markdown;
            if (isCurrent()) setMarkdown(res.markdown);
          })
          .catch(() => {
            if (isCurrent()) setDocsFailed(true);
          });

        // 5. Reveal the question texts as soon as they're ready (answers still
        // pending), without waiting for docs.
        goto("generating_questions");
        const questionsRes = await postJson<QuestionsResponse>(
          "/api/generate/questions",
          { fileName, model, numberOfQuestions } satisfies QuestionsRequest,
        );
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

        // Kick off the descriptive title from the question texts (cheap,
        // text-only) — it reveals whenever it's ready, in parallel.
        const titlePromise = postJson<TitleResponse>("/api/generate/title", {
          text: cores.map((c, i) => `${i + 1}. ${c.question}`).join("\n"),
        } satisfies TitleRequest)
          .then((res) => {
            titleValue = res.title;
            if (isCurrent()) setTitle(res.title);
          })
          .catch(() => {
            // Title is optional; a fallback is used when saving.
          });

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
          built.push(question);
          setQuestions((prev) =>
            prev.map((q) =>
              q.order === question.order
                ? { ...q, options: question.options }
                : q,
            ),
          );
        }

        // Make sure the (decoupled) docs and title requests have settled
        // before we call the whole run done.
        await Promise.all([docsPromise, titlePromise]);
        if (!isCurrent()) return;
        goto("done");

        // Persist the finished training to local history.
        saveTraining({
          id: crypto.randomUUID(),
          title: titleValue ?? fallbackTitle(),
          createdAt: Date.now(),
          markdown: docsMarkdown,
          questions: built,
        });
      } catch (err) {
        if (!isCurrent()) return;
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setError({ message, step: activeStep });
        setStage("idle");
      }
    },
    [revokeObjectUrl],
  );

  return {
    stage,
    progress,
    videoUrl,
    title,
    markdown,
    docsFailed,
    questions,
    run,
    reset,
    error,
  };
}
