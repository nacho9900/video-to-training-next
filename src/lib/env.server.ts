import "server-only";

import { isValidModelId } from "./models";

/** True when a Gemini API key is configured. Never exposes the key itself. */
export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return key;
}

/** Model ids disabled via the DISABLED_MODELS env var (comma-separated). */
export function getDisabledModelIds(): string[] {
  return (process.env.DISABLED_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isModelEnabled(modelId: string): boolean {
  return isValidModelId(modelId) && !getDisabledModelIds().includes(modelId);
}

/** Thrown as a 400 by routes when a request targets a disabled/unknown model. */
export class ModelNotAllowedError extends Error {
  constructor(modelId: string) {
    super(`Model "${modelId}" is not available`);
    this.name = "ModelNotAllowedError";
  }
}

export function assertModelEnabled(modelId: string): void {
  if (!isModelEnabled(modelId)) {
    throw new ModelNotAllowedError(modelId);
  }
}
