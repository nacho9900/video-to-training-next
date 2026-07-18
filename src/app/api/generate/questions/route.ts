import { NextResponse } from "next/server";

import { clampQuestionCount } from "@/lib/constants";
import {
  assertModelEnabled,
  hasGeminiKey,
  ModelNotAllowedError,
} from "@/lib/env.server";
import { generateJson } from "@/lib/gemini";
import {
  buildQuestionsPrompt,
  isQuestionsAIResponse,
  questionsResponseSchema,
} from "@/lib/prompts";
import type { ApiError, QuestionsRequest, QuestionsResponse } from "@/lib/types";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = parseQuestionsRequest(payload);
  if (!parsed) {
    return errorResponse("`fileName` and `model` are required", 400);
  }

  if (!hasGeminiKey()) {
    return errorResponse("GEMINI_API_KEY is not configured", 400);
  }

  try {
    assertModelEnabled(parsed.model);

    const { system, user } = buildQuestionsPrompt(parsed.numberOfQuestions);
    const result = await generateJson<unknown>({
      model: parsed.model,
      systemInstruction: system,
      userPrompt: user,
      responseSchema: questionsResponseSchema,
      videoFileName: parsed.fileName,
    });

    if (!isQuestionsAIResponse(result)) {
      throw new Error(
        "Gemini questions response did not match the expected schema",
      );
    }

    const body: QuestionsResponse = { questions: result.questions };
    return NextResponse.json(body);
  } catch (error) {
    return toErrorResponse(error);
  }
}

function parseQuestionsRequest(payload: unknown): QuestionsRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.fileName !== "string" || !record.fileName.trim()) {
    return null;
  }
  if (typeof record.model !== "string" || !record.model.trim()) {
    return null;
  }
  const numberOfQuestions = clampQuestionCount(Number(record.numberOfQuestions));
  return { fileName: record.fileName, model: record.model, numberOfQuestions };
}

function errorResponse(message: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}

function toErrorResponse(error: unknown): NextResponse<ApiError> {
  if (error instanceof ModelNotAllowedError) {
    return errorResponse(error.message, 400);
  }
  const message =
    error instanceof Error ? error.message : "Failed to generate questions";
  return errorResponse(message, 500);
}
