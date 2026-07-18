import type { StageId } from "./types";

/** Human-readable label for each pipeline stage. Shared by the stepper and
 *  the error alert so the "which step failed" wording stays consistent. */
export const STAGE_LABELS: Record<StageId, string> = {
  uploading: "Uploading video",
  gemini_upload: "Uploading to Gemini",
  processing: "Gemini is processing the video",
  generating_docs: "Writing documentation",
  generating_questions: "Generating questions",
  generating_options: "Building answer options",
  done: "Done",
};
