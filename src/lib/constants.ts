// Shared tunables for the generation pipeline.

/** Default number of quiz questions when the user hasn't changed the slider. */
export const DEFAULT_NUMBER_OF_QUESTIONS = 10;

/** Bounds and step for the "number of questions" slider. */
export const MIN_QUESTIONS = 5;
export const MAX_QUESTIONS = 20;
export const QUESTIONS_STEP = 5;

/** Clamps an arbitrary value to the allowed question range, snapped to STEP. */
export function clampQuestionCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NUMBER_OF_QUESTIONS;
  const snapped = Math.round(value / QUESTIONS_STEP) * QUESTIONS_STEP;
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, snapped));
}

/** Distractors (wrong options) generated per question. */
export const FALSE_OPTIONS_PER_QUESTION = 3;

/** UI response language for the generated content. */
export const RESPONSE_LANGUAGE = "English";
