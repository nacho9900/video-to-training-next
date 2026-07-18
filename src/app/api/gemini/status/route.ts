import { NextResponse } from "next/server";

import { hasGeminiKey } from "@/lib/env.server";
import { getFileState } from "@/lib/gemini";
import type { ApiError, StatusResponse } from "@/lib/types";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name || !name.trim()) {
    return errorResponse("`name` query parameter is required", 400);
  }

  if (!hasGeminiKey()) {
    return errorResponse("GEMINI_API_KEY is not configured", 400);
  }

  try {
    const state = await getFileState(name);
    const body: StatusResponse = { state };
    return NextResponse.json(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch Gemini file state";
    return errorResponse(message, 500);
  }
}

function errorResponse(message: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}
