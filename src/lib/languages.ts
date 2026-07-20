// Languages the training content (documentation, questions, answers, title)
// can be generated in. The UI itself stays in English. Safe to import from both
// client and server.

export interface LanguageOption {
  /** Stable id used in the UI and API requests. */
  id: string;
  /** Label shown in the picker. */
  label: string;
  /** Name used inside the prompt, e.g. "Respond in Spanish". */
  promptName: string;
}

export const LANGUAGES: LanguageOption[] = [
  { id: "es", label: "Español", promptName: "Spanish" },
  { id: "en", label: "English", promptName: "English" },
];

/** Default generation language. */
export const DEFAULT_LANGUAGE_ID = "es";

/** Resolves a language id to the name used in prompts (falls back to default). */
export function languagePromptName(id: string): string {
  const match = LANGUAGES.find((l) => l.id === id);
  if (match) return match.promptName;
  return (
    LANGUAGES.find((l) => l.id === DEFAULT_LANGUAGE_ID)?.promptName ?? "Spanish"
  );
}
