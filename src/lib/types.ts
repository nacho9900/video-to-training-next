// Shared contract between the client orchestration layer and the API routes.
// Every API route request/response and every domain object lives here so the
// backend and frontend agree on one source of truth.

import type { ModelInfo } from "./models";

export type GeminiFileState = "PROCESSING" | "ACTIVE" | "FAILED";

// ---- Domain objects ----

/** A question with its verified correct answer, before distractors are added. */
export interface QuestionCore {
  question: string;
  correctAnswer: string;
  /** Pedagogical explanation, starts with a time reference e.g. "At 2:15…". */
  correctReason: string;
  /** Where in the video this content appears, in seconds. */
  timestamp: number;
}

export interface QuestionOption {
  text: string;
  isCorrect: boolean;
  order: number;
}

/** Final display-ready question: 1 correct + 3 distractors, shuffled. */
export interface GeneratedQuestion {
  order: number;
  question: string;
  /** Explanation shown on the correct option. */
  correctReason: string;
  timestamp: number;
  options: QuestionOption[];
}

// ---- API: GET /api/config ----
export interface ConfigResponse {
  hasKey: boolean;
  models: ModelInfo[];
}

// ---- API: POST /api/gemini/upload ----
export interface UploadRequest {
  /** Public Vercel Blob URL of the uploaded video. */
  blobUrl: string;
}
export interface UploadResponse {
  /** Gemini Files API resource name, e.g. "files/abc123". */
  fileName: string;
  mimeType: string;
  state: GeminiFileState;
}

// ---- API: GET /api/gemini/status?name=<fileName> ----
export interface StatusResponse {
  state: GeminiFileState;
}

// ---- API: POST /api/generate/title ----
// A short descriptive title for the training, derived from the questions
// (text-only, cheap model). Used in the history list and shown in the result.
export interface TitleRequest {
  text: string;
}
export interface TitleResponse {
  title: string;
}

// ---- API: POST /api/generate/docs ----
export interface DocsRequest {
  fileName: string;
  model: string;
}
export interface DocsResponse {
  /** Markdown documentation derived from the video. */
  markdown: string;
}

// ---- API: POST /api/generate/questions ----
export interface QuestionsRequest {
  fileName: string;
  model: string;
  numberOfQuestions: number;
}
export interface QuestionsResponse {
  questions: QuestionCore[];
}

// ---- API: POST /api/generate/options ----
// Options are built one question at a time (the client fires these sequentially
// so the quiz can be revealed question by question and never overruns a
// timeout). The distractor model is chosen server-side — a lighter, cheaper
// model — so the request does not carry a `model`.
export interface OptionsRequest {
  /** A single question to build answer options for. */
  question: QuestionCore;
  /** 1-based position of this question in the quiz. */
  order: number;
}
export interface OptionsResponse {
  question: GeneratedQuestion;
}

/** A quiz question while it's being assembled: `options` is null until the
 *  distractor step fills it in, letting the UI reveal answers progressively. */
export interface BuildingQuestion {
  order: number;
  question: string;
  correctReason: string;
  timestamp: number;
  options: QuestionOption[] | null;
}

// ---- API error envelope (all routes) ----
export interface ApiError {
  error: string;
}

// ---- Client pipeline stages (drive the stepper UI) ----
export type StageId =
  | "uploading" // client → Vercel Blob
  | "gemini_upload" // server → Gemini Files API
  | "processing" // waiting for Gemini state ACTIVE
  | "generating_docs"
  | "generating_questions"
  | "generating_options"
  | "done";
