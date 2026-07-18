import { NextResponse } from "next/server";

import { hasGeminiKey } from "@/lib/env.server";
import { generateJson } from "@/lib/gemini";
import { DISTRACTORS_MODEL_ID } from "@/lib/models";
import {
  buildTitlePrompt,
  isTitleAIResponse,
  titleResponseSchema,
} from "@/lib/prompts";
import type { ApiError, TitleRequest, TitleResponse } from "@/lib/types";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = parseTitleRequest(payload);
  if (!parsed) {
    return errorResponse("A non-empty `text` is required", 400);
  }

  if (!hasGeminiKey()) {
    return errorResponse("GEMINI_API_KEY is not configured", 400);
  }

  try {
    const { system, user } = buildTitlePrompt(parsed.text);
    // Titles are simple — always use the cheap model.
    const result = await generateJson<unknown>({
      model: DISTRACTORS_MODEL_ID,
      systemInstruction: system,
      userPrompt: user,
      responseSchema: titleResponseSchema,
    });

    if (!isTitleAIResponse(result)) {
      throw new Error("Gemini title response did not match the expected schema");
    }

    const body: TitleResponse = { title: result.title.trim() };
    return NextResponse.json(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate a title";
    return errorResponse(message, 500);
  }
}

function parseTitleRequest(payload: unknown): TitleRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.text !== "string" || !record.text.trim()) {
    return null;
  }
  return { text: record.text };
}

function errorResponse(message: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}
