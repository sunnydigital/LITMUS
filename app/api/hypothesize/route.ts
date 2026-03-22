import { NextRequest, NextResponse } from "next/server";
import { hypothesizerPrompt, type HypothesisContext } from "@/lib/prompts";

/**
 * POST /api/hypothesize
 *
 * Hypothesizer agent endpoint. Takes profile + prior results,
 * generates ranked hypotheses about training dynamics.
 *
 * Input: { profile: ProfileContext, priorHypotheses: [], experimentResults: [] }
 * Output: JSON array of hypotheses ranked by expected info gain
 *
 * This is called in a LOOP: experiment results feed back in,
 * generating refined hypotheses each round.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json({
    status: "not_implemented",
    message: "Wire Anthropic SDK with hypothesizerPrompt()",
  });
}
