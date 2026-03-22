import { NextRequest, NextResponse } from "next/server";
import { narratorPrompt, type NarrationContext } from "@/lib/prompts";

/**
 * POST /api/narrate
 *
 * Narrator agent endpoint. Takes validated findings,
 * produces final discovery report in markdown.
 *
 * Input: { validatedFindings: [{ hypothesis, grade, evidence, surpriseScore }] }
 * Output: SSE stream of narrated markdown report
 *
 * Report includes: titles, explanations, evidence summaries,
 * confidence grades, Plotly figure references, follow-up questions.
 * Also pushes summary to Google Sheets (Operator track requirement).
 */
export async function POST(req: NextRequest) {
  return NextResponse.json({
    status: "not_implemented",
    message: "Wire Anthropic SDK with narratorPrompt() + Google Sheets push",
  });
}
