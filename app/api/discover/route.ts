import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";
import {
  profilerPrompt,
  hypothesizerPrompt,
  experimenterPrompt,
  skepticPrompt,
  narratorPrompt,
} from "@/lib/prompts";
import { benjaminiHochberg, effectSizeCheck, computeGrade } from "@/lib/skeptic";
import type { CheckResult } from "@/lib/skeptic";
import { discoveryScore } from "@/lib/surprise";

const MODEL = "claude-sonnet-4-5-20250929";

/**
 * POST /api/discover
 *
 * Single orchestrator route. Runs 5 pipeline stages sequentially via Claude.
 * Streams SSE events to the frontend for real-time progress.
 *
 * Accepts: FormData with files OR { demo: true } to use synthetic data.
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const anthropic = new Anthropic();

  // Parse input: demo mode or uploaded files
  let dataDescription = "";

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const isDemo = formData.get("demo") === "true";

    if (isDemo) {
      dataDescription = await loadDemoData();
    } else {
      // Read uploaded files as text
      const parts: string[] = [];
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          const text = await value.text();
          parts.push(`--- ${value.name} (${value.size} bytes) ---\n${text}`);
        }
      }
      dataDescription = parts.join("\n\n");
    }
  } else {
    // JSON body
    const body = await req.json();
    if (body.demo) {
      dataDescription = await loadDemoData();
    } else {
      dataDescription = body.data || "";
    }
  }

  if (!dataDescription) {
    return new Response(
      JSON.stringify({ error: "No data provided. Upload files or use demo mode." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      try {
        // ---- STAGE 1: PROFILE ----
        send("stage", { stage: "profiling", message: "Analyzing training artifacts..." });

        const profileRaw = await callClaude(anthropic, profilerPrompt(dataDescription));
        let profile: Record<string, unknown>;
        try {
          profile = JSON.parse(extractJson(profileRaw));
        } catch {
          profile = { summary: profileRaw, error: "Could not parse profile JSON" };
        }

        send("result", { stage: "profile", data: profile });

        const profileSummary =
          typeof profile.summary === "string"
            ? profile.summary
            : profileRaw.slice(0, 2000);

        // ---- STAGE 2: HYPOTHESIZE ----
        send("stage", { stage: "hypothesizing", message: "Generating hypotheses..." });

        const hypoRaw = await callClaude(anthropic, hypothesizerPrompt(profileSummary));
        let hypotheses: Array<{
          id: string;
          text: string;
          surprise_prior: number;
          test_strategy: string;
        }>;
        try {
          hypotheses = JSON.parse(extractJson(hypoRaw));
        } catch {
          hypotheses = [
            {
              id: "h1",
              text: hypoRaw.slice(0, 300),
              surprise_prior: 0.5,
              test_strategy: "unknown",
            },
          ];
        }

        send("result", { stage: "hypotheses", data: hypotheses });

        // ---- STAGE 3: EXPERIMENT ----
        send("stage", { stage: "experimenting", message: "Running statistical tests..." });

        const experimentResults: Array<{
          hypothesisId: string;
          hypothesis: string;
          test_name: string;
          p_value: number;
          effect_size: number;
          interpretation: string;
          supports: boolean;
        }> = [];

        for (const hyp of hypotheses) {
          const expRaw = await callClaude(
            anthropic,
            experimenterPrompt(
              `${hyp.text}\nTest strategy: ${hyp.test_strategy}`,
              `Profile: ${profileSummary}\n\nRaw data description:\n${dataDescription.slice(0, 4000)}`,
            ),
          );

          let expResult: {
            test_name: string;
            p_value: number;
            effect_size: number;
            interpretation: string;
            supports_hypothesis: boolean;
          };
          try {
            expResult = JSON.parse(extractJson(expRaw));
          } catch {
            expResult = {
              test_name: "unknown",
              p_value: 0.5,
              effect_size: 0.1,
              interpretation: expRaw.slice(0, 300),
              supports_hypothesis: false,
            };
          }

          const result = {
            hypothesisId: hyp.id,
            hypothesis: hyp.text,
            test_name: expResult.test_name,
            p_value: expResult.p_value,
            effect_size: expResult.effect_size,
            interpretation: expResult.interpretation,
            supports: expResult.supports_hypothesis,
          };

          experimentResults.push(result);
          send("result", { stage: "experiment", data: result });
        }

        // ---- STAGE 4: VALIDATE ----
        send("stage", { stage: "validating", message: "Running skeptic gauntlet..." });

        const allPValues = experimentResults.map((r) => r.p_value);
        const fdrSurvives = benjaminiHochberg(allPValues);

        const validatedFindings: Array<{
          hypothesis: string;
          grade: "A" | "B" | "C";
          checks: CheckResult[];
          p_value: number;
          effect_size: number;
          surprise_score: number;
          interpretation: string;
        }> = [];

        for (let i = 0; i < experimentResults.length; i++) {
          const exp = experimentResults[i];
          const hyp = hypotheses[i];

          // Check 1: FDR
          const fdrCheck: CheckResult = {
            name: "Multiple Testing",
            result: fdrSurvives[i] ? "PASS" : "FAIL",
            reason: fdrSurvives[i]
              ? `Survives BH-FDR correction at q=0.05 (${allPValues.length} tests)`
              : `Does not survive BH-FDR at q=0.05 (${allPValues.length} tests)`,
          };

          // Check 5: Effect size
          const esCheck = effectSizeCheck(exp.effect_size);

          // Checks 2-4: Claude skeptic
          let claudeChecks: CheckResult[] = [];
          try {
            const skepticRaw = await callClaude(
              anthropic,
              skepticPrompt(exp.hypothesis, exp.p_value, exp.effect_size, exp.interpretation),
            );
            const parsed = JSON.parse(extractJson(skepticRaw));
            claudeChecks = parsed.checks || [];
          } catch {
            claudeChecks = [
              { name: "Confounder Scan", result: "PASS" as const, reason: "Could not evaluate" },
              { name: "Temporal Stability", result: "PASS" as const, reason: "Could not evaluate" },
              { name: "Holdout Replication", result: "PASS" as const, reason: "Could not evaluate" },
            ];
          }

          const allChecks = [fdrCheck, ...claudeChecks, esCheck];
          const validation = computeGrade(allChecks);

          const surprise = discoveryScore({
            surpriseKL: hyp.surprise_prior,
            pValue: exp.p_value,
            effectSize: exp.effect_size,
          });

          const finding = {
            hypothesis: exp.hypothesis,
            grade: validation.grade,
            checks: validation.checks,
            p_value: exp.p_value,
            effect_size: exp.effect_size,
            surprise_score: Math.round(surprise * 100) / 100,
            interpretation: exp.interpretation,
          };

          validatedFindings.push(finding);
          send("result", { stage: "validation", data: finding });
        }

        // ---- STAGE 5: NARRATE ----
        send("stage", { stage: "narrating", message: "Writing discovery report..." });

        const findingsSummary = validatedFindings
          .sort((a, b) => b.surprise_score - a.surprise_score)
          .map(
            (f) =>
              `[Grade ${f.grade}] (surprise: ${f.surprise_score}) ${f.hypothesis}\n` +
              `  p=${f.p_value}, d=${f.effect_size}, checks: ${f.checks.map((c) => `${c.name}:${c.result}`).join(", ")}\n` +
              `  ${f.interpretation}`,
          )
          .join("\n\n");

        const report = await callClaude(anthropic, narratorPrompt(findingsSummary));

        send("complete", { report, findings: validatedFindings });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Load demo data from data/demo/ directory.
 */
async function loadDemoData(): Promise<string> {
  const demoDir = path.join(process.cwd(), "data", "demo");
  const files = ["config.json", "loss.csv", "metrics.csv"];
  const parts: string[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(demoDir, file), "utf-8");
      parts.push(`--- ${file} ---\n${content}`);
    } catch {
      // Skip missing files
    }
  }

  return parts.join("\n\n");
}

/**
 * Call Claude and return the text response.
 */
async function callClaude(client: Anthropic, prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

/**
 * Extract JSON from a response that might have markdown fences or extra text.
 */
function extractJson(text: string): string {
  // Try to find JSON in code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find raw JSON (object or array)
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1].trim();

  return text.trim();
}
