import { NextRequest, NextResponse } from "next/server";
import { profilerPrompt, type ProfileContext } from "@/lib/prompts";

/**
 * POST /api/profile
 *
 * Profiler agent endpoint. Receives uploaded training artifacts,
 * sends to Claude for analysis, returns structured profile.
 *
 * Input: FormData with training artifact files
 * Output: SSE stream of profiling progress, final JSON profile
 *
 * TODO: Parse .pt files for weight shapes, .csv for loss curves,
 * .npy for attention maps. Currently delegates all parsing to Claude.
 */
export async function POST(req: NextRequest) {
  // TODO: Wire Anthropic SDK + SSE streaming
  return NextResponse.json({
    status: "not_implemented",
    message: "Wire Anthropic SDK with profilerPrompt()",
  });
}
