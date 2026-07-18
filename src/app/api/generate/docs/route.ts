import { NextResponse } from "next/server";

import {
  assertModelEnabled,
  hasGeminiKey,
  ModelNotAllowedError,
} from "@/lib/env.server";
import { generateJson } from "@/lib/gemini";
import { buildDocsPrompt, docsResponseSchema, isDocsAIResponse } from "@/lib/prompts";
import type { ApiError, DocsRequest, DocsResponse } from "@/lib/types";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = parseDocsRequest(payload);
  if (!parsed) {
    return errorResponse("`fileName` and `model` are required", 400);
  }

  if (!hasGeminiKey()) {
    return errorResponse("GEMINI_API_KEY is not configured", 400);
  }

  try {
    assertModelEnabled(parsed.model);

    const { system, user } = buildDocsPrompt();
    const result = await generateJson<unknown>({
      model: parsed.model,
      systemInstruction: system,
      userPrompt: user,
      responseSchema: docsResponseSchema,
      videoFileName: parsed.fileName,
    });

    if (!isDocsAIResponse(result)) {
      throw new Error("Gemini docs response did not match the expected schema");
    }

    const body: DocsResponse = { markdown: result.documentation };
    return NextResponse.json(body);
  } catch (error) {
    return toErrorResponse(error);
  }
}

function parseDocsRequest(payload: unknown): DocsRequest | null {
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
  return { fileName: record.fileName, model: record.model };
}

function errorResponse(message: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}

function toErrorResponse(error: unknown): NextResponse<ApiError> {
  if (error instanceof ModelNotAllowedError) {
    return errorResponse(error.message, 400);
  }
  const message =
    error instanceof Error ? error.message : "Failed to generate documentation";
  return errorResponse(message, 500);
}
