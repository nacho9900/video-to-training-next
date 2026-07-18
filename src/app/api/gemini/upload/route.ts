import { NextResponse } from "next/server";

import { hasGeminiKey } from "@/lib/env.server";
import { uploadVideoFromUrl } from "@/lib/gemini";
import type { ApiError, UploadRequest, UploadResponse } from "@/lib/types";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = parseUploadRequest(payload);
  if (!parsed) {
    return errorResponse("`blobUrl` is required", 400);
  }

  if (!hasGeminiKey()) {
    return errorResponse("GEMINI_API_KEY is not configured", 400);
  }

  try {
    const uploaded = await uploadVideoFromUrl(parsed.blobUrl);
    const body: UploadResponse = uploaded;
    return NextResponse.json(body);
  } catch (error) {
    return toErrorResponse(error);
  }
}

function parseUploadRequest(payload: unknown): UploadRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.blobUrl !== "string" || !record.blobUrl.trim()) {
    return null;
  }
  return { blobUrl: record.blobUrl };
}

function errorResponse(message: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}

function toErrorResponse(error: unknown): NextResponse<ApiError> {
  const message =
    error instanceof Error ? error.message : "Failed to upload video to Gemini";
  return errorResponse(message, 500);
}
