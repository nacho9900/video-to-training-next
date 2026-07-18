// Client-side helper: streams a video file straight to Vercel Blob storage
// using a short-lived client token minted by our own /api/blob/upload route.

import { upload } from "@vercel/blob/client";

/**
 * Uploads `file` to Vercel Blob and returns its public URL.
 * `onProgress` receives the upload percentage (0-100) as it streams.
 */
export async function uploadVideoToBlob(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    onUploadProgress: (event) => onProgress(event.percentage),
  });

  return blob.url;
}
