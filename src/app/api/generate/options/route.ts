import { NextResponse } from "next/server";

import { FALSE_OPTIONS_PER_QUESTION } from "@/lib/constants";
import {
  assertModelEnabled,
  hasGeminiKey,
  ModelNotAllowedError,
} from "@/lib/env.server";
import { generateJson } from "@/lib/gemini";
import {
  buildDistractorsPrompt,
  distractorsResponseSchema,
  isDistractorsAIResponse,
  isQuestionCoreAI,
  shuffleArray,
} from "@/lib/prompts";
import type {
  ApiError,
  GeneratedQuestion,
  OptionsRequest,
  OptionsResponse,
  QuestionCore,
  QuestionOption,
} from "@/lib/types";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = parseOptionsRequest(payload);
  if (!parsed) {
    return errorResponse(
      "`model` and a non-empty `questions` array are required",
      400,
    );
  }

  if (!hasGeminiKey()) {
    return errorResponse("GEMINI_API_KEY is not configured", 400);
  }

  try {
    assertModelEnabled(parsed.model);

    const startOrder = parsed.startOrder ?? 1;
    const questions = await Promise.all(
      parsed.questions.map((question, index) =>
        buildGeneratedQuestion(question, parsed.model, startOrder + index),
      ),
    );

    const body: OptionsResponse = { questions };
    return NextResponse.json(body);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function buildGeneratedQuestion(
  question: QuestionCore,
  model: string,
  order: number,
): Promise<GeneratedQuestion> {
  const { system, user } = buildDistractorsPrompt(
    question.question,
    question.correctAnswer,
    question.correctReason,
    FALSE_OPTIONS_PER_QUESTION,
  );

  const result = await generateJson<unknown>({
    model,
    systemInstruction: system,
    userPrompt: user,
    responseSchema: distractorsResponseSchema,
  });

  if (!isDistractorsAIResponse(result)) {
    throw new Error(
      "Gemini distractors response did not match the expected schema",
    );
  }

  const unordered: Omit<QuestionOption, "order">[] = [
    { text: question.correctAnswer, isCorrect: true },
    ...result.falseOptions.map((text) => ({ text, isCorrect: false })),
  ];

  const options: QuestionOption[] = shuffleArray(unordered).map(
    (option, index) => ({ ...option, order: index + 1 }),
  );

  return {
    order,
    question: question.question,
    correctReason: question.correctReason,
    timestamp: question.timestamp,
    options,
  };
}

function parseOptionsRequest(payload: unknown): OptionsRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;

  if (typeof record.model !== "string" || !record.model.trim()) {
    return null;
  }
  if (!Array.isArray(record.questions) || record.questions.length === 0) {
    return null;
  }
  if (!record.questions.every(isQuestionCoreAI)) {
    return null;
  }

  if (record.startOrder !== undefined && typeof record.startOrder !== "number") {
    return null;
  }

  return {
    model: record.model,
    questions: record.questions as QuestionCore[],
    startOrder: record.startOrder as number | undefined,
  };
}

function errorResponse(message: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}

function toErrorResponse(error: unknown): NextResponse<ApiError> {
  if (error instanceof ModelNotAllowedError) {
    return errorResponse(error.message, 400);
  }
  const message =
    error instanceof Error ? error.message : "Failed to generate options";
  return errorResponse(message, 500);
}
