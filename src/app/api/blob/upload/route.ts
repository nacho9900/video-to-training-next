import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import type { ApiError } from "@/lib/types";

export const maxDuration = 300;
export const runtime = "nodejs";

/** Video MIME types accepted from the client during direct-to-blob upload. */
const ALLOWED_VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/mpeg",
  "video/x-msvideo",
];

/**
 * Mints client-upload tokens for `@vercel/blob/client`'s `upload()` helper.
 * The browser posts here first to get a token, then uploads the video bytes
 * directly to Vercel Blob.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_VIDEO_CONTENT_TYPES,
        addRandomSuffix: true,
      }),
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload token request failed";
    return NextResponse.json<ApiError>({ error: message }, { status: 400 });
  }
}
