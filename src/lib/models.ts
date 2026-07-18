// Shared model catalog. Safe to import from both client and server (no secrets).

export interface ModelDef {
  id: string;
  label: string;
  /** Short helper text shown in the dropdown (e.g. "Default", "Recommended…"). */
  hint?: string;
  isDefault?: boolean;
  recommended?: boolean;
}

export const MODELS: ModelDef[] = [
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    hint: "Default",
    isDefault: true,
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (Preview)",
    hint: "Recommended for better results",
    recommended: true,
  },
];

/** Model used by default in the UI dropdown. */
export const DEFAULT_MODEL_ID = "gemini-3.5-flash";

/** Model the provider falls back to when the chosen model fails. */
export const FALLBACK_MODEL_ID = "gemini-3.5-flash";

/**
 * Model used for the high-volume, low-complexity distractor step. Generating
 * wrong answer options is simple, so we always use the lightest/cheapest model
 * here regardless of the model chosen for docs and questions.
 */
export const DISTRACTORS_MODEL_ID = "gemini-3.1-flash-lite";

/** Human-readable label for a model id (falls back to the id itself). */
export function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

export interface ModelInfo extends ModelDef {
  enabled: boolean;
}

/** Pure helper: mark models present in `disabledIds` as disabled. */
export function computeModelInfos(disabledIds: string[]): ModelInfo[] {
  const disabled = new Set(
    disabledIds.map((s) => s.trim()).filter(Boolean),
  );
  return MODELS.map((m) => ({ ...m, enabled: !disabled.has(m.id) }));
}

export function isValidModelId(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}
