import { NextResponse } from "next/server";

import { getDisabledModelIds, hasGeminiKey } from "@/lib/env.server";
import { computeModelInfos } from "@/lib/models";
import type { ConfigResponse } from "@/lib/types";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse<ConfigResponse>> {
  const body: ConfigResponse = {
    hasKey: hasGeminiKey(),
    models: computeModelInfos(getDisabledModelIds()),
  };
  return NextResponse.json(body);
}
