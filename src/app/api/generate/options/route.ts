import { NextResponse } from "next/server";

import { FALSE_OPTIONS_PER_QUESTION } from "@/lib/constants";
import { hasGeminiKey } from "@/lib/env.server";
import { generateJson } from "@/lib/gemini";
import { DISTRACTORS_MODEL_ID } from "@/lib/models";
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
    return errorResponse("A valid `question` and `order` are required", 400);
  }

  if (!hasGeminiKey()) {
    return errorResponse("GEMINI_API_KEY is not configured", 400);
  }

  try {
    // Distractors are a simple task — always use the cheap model, regardless
    // of the model chosen for docs/questions.
    const question = await buildGeneratedQuestion(parsed.question, parsed.order);
    const body: OptionsResponse = { question };
    return NextResponse.json(body);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function buildGeneratedQuestion(
  question: QuestionCore,
  order: number,
): Promise<GeneratedQuestion> {
  const { system, user } = buildDistractorsPrompt(
    question.question,
    question.correctAnswer,
    question.correctReason,
    FALSE_OPTIONS_PER_QUESTION,
  );

  const result = await generateJson<unknown>({
    model: DISTRACTORS_MODEL_ID,
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

  if (!isQuestionCoreAI(record.question)) {
    return null;
  }
  if (typeof record.order !== "number" || !Number.isFinite(record.order)) {
    return null;
  }

  return {
    question: record.question as QuestionCore,
    order: record.order,
  };
}

function errorResponse(message: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}

function toErrorResponse(error: unknown): NextResponse<ApiError> {
  const message =
    error instanceof Error ? error.message : "Failed to generate options";
  return errorResponse(message, 500);
}
