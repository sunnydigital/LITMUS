import { NextRequest, NextResponse } from "next/server";
import { experimenterPrompt, type ExperimentContext } from "@/lib/prompts";
import { runExperiment } from "@/lib/sandbox";

/**
 * POST /api/experiment
 *
 * Experimenter agent endpoint. Takes a hypothesis,
 * generates a Python test script via Claude,
 * executes in E2B sandbox, returns results.
 *
 * Input: { hypothesis: string, profileSummary: string, availableData: string[] }
 * Output: { testName, pValue, effectSize, plotJson, interpretation }
 *
 * The generated Python code runs in E2B with:
 * scipy, statsmodels, sklearn, torch, plotly, numpy, pandas
 */
export async function POST(req: NextRequest) {
  return NextResponse.json({
    status: "not_implemented",
    message: "Wire Anthropic SDK with experimenterPrompt() + runExperiment()",
  });
}
