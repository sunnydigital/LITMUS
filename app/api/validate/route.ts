import { NextRequest, NextResponse } from "next/server";
import { skepticPrompt, type ValidationContext } from "@/lib/prompts";
import { runGauntlet } from "@/lib/skeptic";

/**
 * POST /api/validate
 *
 * Skeptic agent endpoint. Runs the 5-check validation gauntlet
 * on experiment results. Tries to KILL the finding.
 *
 * Input: { hypothesis, pValue, effectSize, experimentCode, experimentResult, allPValues, hypothesisIndex }
 * Output: { checks: CheckResult[], grade: "A"|"B"|"C", passCount: number }
 *
 * Checks 1 and 5 (FDR, effect size) run locally.
 * Checks 2-4 (confounder, temporal, holdout) delegated to Claude.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json({
    status: "not_implemented",
    message: "Wire runGauntlet() + Anthropic SDK for checks 2-4",
  });
}
