import "server-only";

import {
  type Content,
  createPartFromUri,
  FileState,
  type GenerateContentConfig,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type Part,
  type Schema,
} from "@google/genai";

import { getGeminiKey } from "./env.server";
import { FALLBACK_MODEL_ID } from "./models";
import type { GeminiFileState } from "./types";

/** Creates a fresh GoogleGenAI client authenticated with the server-side API key. */
export function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getGeminiKey() });
}

/** Harm categories we disable entirely — this is internal training content, not public output. */
const SAFETY_SETTINGS = [
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
].map((category) => ({ category, threshold: HarmBlockThreshold.OFF }));

function mapFileState(state: FileState | undefined): GeminiFileState {
  switch (state) {
    case FileState.ACTIVE:
      return "ACTIVE";
    case FileState.FAILED:
      return "FAILED";
    default:
      return "PROCESSING";
  }
}

export interface UploadedGeminiFile {
  fileName: string;
  mimeType: string;
  state: GeminiFileState;
}

/**
 * Fetches the video from the given blob URL and uploads it to the Gemini
 * Files API, letting Gemini assign the file name. The returned `fileName` is
 * the canonical resource name every later step references. Does not wait for
 * the file to become ACTIVE.
 */
export async function uploadVideoFromUrl(
  blobUrl: string,
): Promise<UploadedGeminiFile> {
  const ai = getClient();

  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch video from blob URL (${response.status} ${response.statusText})`,
    );
  }
  const mimeType = response.headers.get("content-type") ?? "video/mp4";
  const blob = await response.blob();

  const file = await ai.files.upload({ file: blob, config: { mimeType } });

  if (!file.name) {
    throw new Error("Gemini file upload did not return a file name");
  }

  return {
    fileName: file.name,
    mimeType: file.mimeType ?? mimeType,
    state: mapFileState(file.state),
  };
}

/** Polls the current processing state of a previously-uploaded Gemini file. */
export async function getFileState(
  fileName: string,
): Promise<GeminiFileState> {
  const ai = getClient();
  const file = await ai.files.get({ name: fileName });
  return mapFileState(file.state);
}

/** Builds the media Part for a ready (ACTIVE) Gemini file, for use in prompts. */
export async function getVideoPart(fileName: string): Promise<Part> {
  const ai = getClient();
  const file = await ai.files.get({ name: fileName });
  if (!file.uri || !file.mimeType) {
    throw new Error(`Gemini file ${fileName} is missing uri/mimeType`);
  }
  return createPartFromUri(file.uri, file.mimeType);
}

export interface GenerateJsonParams {
  model: string;
  systemInstruction?: string;
  userPrompt: string;
  responseSchema: Schema;
  videoFileName?: string;
}

async function buildContents(params: GenerateJsonParams): Promise<Content[]> {
  const contents: Content[] = [];

  if (params.systemInstruction) {
    contents.push({ role: "model", parts: [{ text: params.systemInstruction }] });
  }

  const userParts: Part[] = [{ text: params.userPrompt }];
  if (params.videoFileName) {
    userParts.push(await getVideoPart(params.videoFileName));
  }
  contents.push({ role: "user", parts: userParts });

  return contents;
}

async function callModel<T>(
  ai: GoogleGenAI,
  model: string,
  contents: Content[],
  config: GenerateContentConfig,
): Promise<T> {
  const response = await ai.models.generateContent({ model, contents, config });

  if (response.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked the request (model ${model}): ${response.promptFeedback.blockReason}`,
    );
  }

  const text = response.text;
  if (!text) {
    throw new Error(`Gemini returned an empty response (model ${model})`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini returned invalid JSON (model ${model}): ${reason}`);
  }
}

/**
 * Generates structured JSON content from Gemini, with one automatic retry
 * against FALLBACK_MODEL_ID if the requested model fails (unless it already
 * is the fallback model).
 */
export async function generateJson<T>(params: GenerateJsonParams): Promise<T> {
  const ai = getClient();
  const contents = await buildContents(params);
  const config: GenerateContentConfig = {
    safetySettings: SAFETY_SETTINGS,
    responseMimeType: "application/json",
    responseSchema: params.responseSchema,
    temperature: 0.2,
  };

  try {
    return await callModel<T>(ai, params.model, contents, config);
  } catch (error) {
    if (params.model === FALLBACK_MODEL_ID) {
      throw error;
    }
    return await callModel<T>(ai, FALLBACK_MODEL_ID, contents, config);
  }
}
