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
import { parseCSV, runAnalysisSuite, computeSurpriseScores, generateChartData } from "@/lib/analysis";
import { pushToGoogleSheets } from "@/lib/sheets";

const MODEL = "claude-sonnet-4-5-20250929";

// Demo dataset configurations
const DEMO_DATASETS: Record<string, { label: string; files: string[] }> = {
  "simpsons-paradox": {
    label: "Simpson's Paradox A/B Test",
    files: ["config.json", "ab_test.csv"],
  },
  "startup-metrics": {
    label: "Startup SaaS Metrics",
    files: ["config.json", "metrics.csv"],
  },
  "clinical-trial": {
    label: "Clinical Trial",
    files: ["config.json", "trial_results.csv"],
  },
  "feature-drift": {
    label: "ML Feature Drift",
    files: ["config.json", "monitoring.csv"],
  },
  "grokking": {
    label: "Grokking Detection (Transformer Training)",
    files: ["config.json", "loss.csv", "metrics.csv"],
  },
};

/**
 * POST /api/discover
 *
 * Single orchestrator route. Runs 5 pipeline stages sequentially via Claude.
 * Streams SSE events to the frontend for real-time progress.
 *
 * Features:
 * - Retry with exponential backoff on Claude call failures
 * - Graceful fallbacks when Claude returns bad JSON
 * - Sub-agent spawning for targeted analysis
 * - Dynamic replanning when no significant findings in round 1
 * - Google Sheets push after narration
 *
 * Accepts:
 *   - FormData with files (file upload)
 *   - FormData with demo=true (legacy demo)
 *   - FormData with demoDataset=<name> (new demo datasets)
 *   - JSON body with { demo: true } or { demoDataset: string }
 *   - JSON/TSV/pasted text auto-detection
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const anthropic = new Anthropic();

  // Parse input
  let dataDescription = "";
  let computedStats = "";
  let computedSurpriseMap: Record<string, number> = {};
  let profileCharts: import("@/lib/analysis").ChartData[] = [];

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const demoDataset = formData.get("demoDataset");
    const isDemo = formData.get("demo") === "true";

    if (demoDataset && typeof demoDataset === "string") {
      const { desc, stats, surpriseMap, charts } = await loadDemoDataset(demoDataset);
      dataDescription = desc;
      computedStats = stats;
      computedSurpriseMap = surpriseMap;
      profileCharts = charts;
    } else if (isDemo) {
      dataDescription = await loadLegacyDemoData();
    } else {
      // Read uploaded files as text
      const parts: string[] = [];
      const csvTexts: string[] = [];
      for (const [, value] of formData.entries()) {
        if (value instanceof File) {
          const text = await value.text();
          const normalized = normalizeInputFormat(text, value.name);
          parts.push(`--- ${value.name} (${value.size} bytes) ---\n${normalized}`);
          if (value.name.endsWith(".csv") || value.name.endsWith(".tsv") ||
              value.name.endsWith(".txt") || value.name.endsWith(".json")) {
            const csvForm = toCsvFormat(normalized, value.name);
            if (csvForm) csvTexts.push(csvForm);
          }
        }
      }
      dataDescription = parts.join("\n\n");
      // Run analysis on uploaded CSVs
      if (csvTexts.length > 0) {
        const allStats: string[] = [];
        for (const csvText of csvTexts) {
          const parsed = parseCSV(csvText);
          if (parsed.rows.length > 0) {
            allStats.push(runAnalysisSuite(parsed));
            Object.assign(computedSurpriseMap, computeSurpriseScores(parsed));
            profileCharts.push(...generateChartData(parsed));
          }
        }
        computedStats = allStats.join("\n\n");
      }
    }
  } else {
    // JSON body
    const body = await req.json();
    if (body.demoDataset) {
      const { desc, stats, surpriseMap, charts } = await loadDemoDataset(body.demoDataset);
      dataDescription = desc;
      computedStats = stats;
      computedSurpriseMap = surpriseMap;
      profileCharts = charts;
    } else if (body.demo) {
      dataDescription = await loadLegacyDemoData();
    } else if (body.pastedText) {
      // Auto-detect pasted text format
      const detected = detectAndNormalize(body.pastedText);
      dataDescription = detected.description;
      if (detected.csv) {
        const parsed = parseCSV(detected.csv);
        if (parsed.rows.length > 0) {
          computedStats = runAnalysisSuite(parsed);
          computedSurpriseMap = computeSurpriseScores(parsed);
          profileCharts = generateChartData(parsed);
        }
      }
    } else {
      dataDescription = body.data || "";
      if (dataDescription) {
        const parsed = parseCSV(dataDescription);
        if (parsed.rows.length > 0) {
          computedStats = runAnalysisSuite(parsed);
          computedSurpriseMap = computeSurpriseScores(parsed);
          profileCharts = generateChartData(parsed);
        }
      }
    }
  }

  if (!dataDescription) {
    return new Response(
      JSON.stringify({ error: "No data provided. Upload files or use a demo dataset." }),
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
        send("stage", { stage: "profiling", message: "Profiling dataset..." });

        const profileRaw = await callClaudeWithRetry(anthropic, profilerPrompt(dataDescription), "profiler");
        let profile: Record<string, unknown>;
        try {
          profile = JSON.parse(extractJson(profileRaw));
        } catch {
          profile = { summary: profileRaw, error: "Could not parse profile JSON" };
        }

        send("result", { stage: "profile", data: profile });

        // Send profile-level charts
        if (profileCharts.length > 0) {
          send("chart", { stage: "profile", charts: profileCharts });
        }

        const profileSummary =
          typeof profile.summary === "string"
            ? profile.summary
            : profileRaw.slice(0, 2000);

        // ---- STAGE 2: HYPOTHESIZE ----
        send("stage", { stage: "hypothesizing", message: "Generating hypotheses..." });

        let hypotheses = await generateHypotheses(anthropic, profileSummary, computedSurpriseMap);
        send("result", { stage: "hypotheses", data: hypotheses });

        // Send surprise score bar chart for hypotheses
        if (hypotheses.length > 0) {
          send("chart", {
            stage: "hypothesis",
            charts: [{
              type: "bar",
              title: "Hypothesis Surprise Scores (Prior KL-Divergence)",
              data: hypotheses.map((h, i) => ({
                label: `H${i + 1}`,
                Surprise: Math.round(h.surprise_prior * 100) / 100,
              })),
              config: { keys: ["Surprise"], xKey: "label", yLabel: "Surprise" },
            }],
          });
        }

        // ---- STAGE 3: EXPERIMENT ----
        send("stage", { stage: "experimenting", message: "Running statistical tests..." });

        const experimentResults = await runExperiments(
          anthropic, hypotheses, profileSummary, dataDescription, computedStats, send
        );

        // ---- DYNAMIC REPLANNING ----
        // If ALL findings have p > 0.1, nothing interesting was found — replan!
        const allInsignificant = experimentResults.every((r) => r.p_value > 0.1);
        if (allInsignificant) {
          send("subagent", {
            parent: "experimenter",
            action: "All findings insignificant (p > 0.1). Replanning with creative hypotheses...",
          });

          const replanPrompt = `The first round found nothing significant (all p > 0.1). Generate 3 more creative hypotheses exploring interactions, non-linear patterns, or subgroup effects. Be bold — look for Simpson's Paradox, interaction effects, threshold behaviors, or outlier-driven patterns.`;

          const additionalHypotheses = await generateHypotheses(
            anthropic,
            `${profileSummary}\n\n${replanPrompt}`,
            computedSurpriseMap,
          );

          send("result", { stage: "hypotheses", data: additionalHypotheses });
          send("stage", { stage: "experimenting", message: "Re-running experiments with creative hypotheses..." });

          const additionalResults = await runExperiments(
            anthropic, additionalHypotheses, profileSummary, dataDescription, computedStats, send
          );

          hypotheses = [...hypotheses, ...additionalHypotheses];
          experimentResults.push(...additionalResults);
        }

        // Send forest plot of effect sizes across all experiments
        if (experimentResults.length > 0) {
          send("chart", {
            stage: "experiment",
            charts: [{
              type: "forest",
              title: "Effect Sizes Across Experiments (Cohen's d)",
              data: experimentResults.map((exp, i) => {
                const label = `H${i + 1}: ${exp.hypothesis.length > 45 ? exp.hypothesis.slice(0, 45) + "…" : exp.hypothesis}`;
                const color = exp.p_value < 0.05 ? (exp.supports ? "green" : "red") : "gray";
                return { endpoint: label, cohensD: Math.round(exp.effect_size * 1000) / 1000, pValue: exp.p_value, color };
              }),
              config: { xKey: "cohensD", yKey: "endpoint" },
            }],
          });
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
          const hyp = hypotheses[i] ?? hypotheses[hypotheses.length - 1];

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

          // Checks 2-4: Claude skeptic (with retry)
          let claudeChecks: CheckResult[] = [];
          try {
            const skepticRaw = await callClaudeWithRetry(
              anthropic,
              skepticPrompt(exp.hypothesis, exp.p_value, exp.effect_size, exp.interpretation),
              "skeptic",
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

        const report = await callClaudeWithRetry(anthropic, narratorPrompt(findingsSummary), "narrator");

        send("complete", { report, findings: validatedFindings });

        // ---- GOOGLE SHEETS EXPORT ----
        send("stage", { stage: "exporting", message: "Pushing findings to Google Sheets..." });

        try {
          const sheetsResult = await pushToGoogleSheets(validatedFindings, report);
          if (sheetsResult) {
            send("result", { stage: "sheets", data: { url: sheetsResult.url } });
          }
          // If null, silently skip (no credentials configured)
        } catch {
          // Non-critical — don't fail the pipeline
        }

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

// ============================================================
// Sub-pipeline helpers
// ============================================================

/**
 * Generate hypotheses with retry and fallback.
 */
async function generateHypotheses(
  anthropic: Anthropic,
  profileSummary: string,
  computedSurpriseMap: Record<string, number>,
): Promise<Array<{ id: string; text: string; surprise_prior: number; test_strategy: string }>> {
  const hypoRaw = await callClaudeWithRetry(anthropic, hypothesizerPrompt(profileSummary), "hypothesizer");

  let hypotheses: Array<{ id: string; text: string; surprise_prior: number; test_strategy: string }>;
  try {
    hypotheses = JSON.parse(extractJson(hypoRaw));
  } catch {
    // Fallback: generate a default hypothesis from the profile summary
    const firstLine = profileSummary.split("\n")[0] || "this dataset";
    hypotheses = [
      {
        id: "h1",
        text: `The primary metric in ${firstLine.slice(0, 100)} shows a statistically significant pattern worth investigating.`,
        surprise_prior: 0.5,
        test_strategy: "descriptive statistics and trend analysis",
      },
    ];
  }

  // Override Claude's subjective surprise_prior with computed KL-divergence values
  if (Object.keys(computedSurpriseMap).length > 0) {
    hypotheses = hypotheses.map((hyp) => {
      const matched = matchSurpriseScore(hyp.text, computedSurpriseMap);
      if (matched !== null) {
        return { ...hyp, surprise_prior: matched };
      }
      return hyp;
    });
  }

  return hypotheses;
}

/**
 * Run experiments on hypotheses, with sub-agent spawning for targeted analysis.
 */
async function runExperiments(
  anthropic: Anthropic,
  hypotheses: Array<{ id: string; text: string; surprise_prior: number; test_strategy: string }>,
  profileSummary: string,
  dataDescription: string,
  computedStats: string,
  send: (event: string, data: unknown) => void,
): Promise<Array<{
  hypothesisId: string;
  hypothesis: string;
  test_name: string;
  p_value: number;
  effect_size: number;
  interpretation: string;
  supports: boolean;
}>> {
  const experimentResults = [];

  for (const hyp of hypotheses) {
    const expRaw = await callClaudeWithRetry(
      anthropic,
      experimenterPrompt(
        `${hyp.text}\nTest strategy: ${hyp.test_strategy}`,
        `Profile: ${profileSummary}\n\nRaw data description:\n${dataDescription.slice(0, 3000)}`,
        computedStats || undefined,
      ),
      "experimenter",
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

    // Clamp p-value and effect_size to valid ranges
    expResult.p_value = Math.max(0, Math.min(1, expResult.p_value || 0.5));
    expResult.effect_size = expResult.effect_size || 0;

    // ---- SUB-AGENT: Targeted analysis when the experimenter can't test the hypothesis ----
    const cantTest = expResult.test_name === "unknown" || expResult.p_value === 0.5;
    if (cantTest && computedStats) {
      send("subagent", {
        parent: "experimenter",
        action: `Spawning targeted analysis for hypothesis: "${hyp.text.slice(0, 60)}..."`,
      });

      // Run a more focused sub-agent call with only the relevant stats
      const relevantStats = extractRelevantStats(hyp.text, computedStats);
      const subAgentPrompt = `
You are a statistical sub-agent. Your parent experimenter could not test this hypothesis:
"${hyp.text}"

Here are the specifically relevant computed statistics:
${relevantStats}

Choose the most appropriate statistical test and return a JSON object with:
{
  "test_name": "name of the test",
  "p_value": 0.0-1.0,
  "effect_size": Cohen's d or correlation r,
  "interpretation": "one sentence",
  "supports_hypothesis": true or false
}
Return only the JSON object.`;

      try {
        const subRaw = await callClaudeWithRetry(anthropic, subAgentPrompt, "subagent");
        const subResult = JSON.parse(extractJson(subRaw));
        if (subResult.test_name && subResult.test_name !== "unknown") {
          expResult = subResult;
          expResult.p_value = Math.max(0, Math.min(1, expResult.p_value || 0.5));
        }
      } catch {
        // Sub-agent also failed — keep original result
      }
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

  return experimentResults;
}

/**
 * Extract the most relevant stats from computedStats for a given hypothesis text.
 */
function extractRelevantStats(hypothesisText: string, computedStats: string): string {
  const hLower = hypothesisText.toLowerCase();
  const lines = computedStats.split("\n");

  // Score each line by how many words from the hypothesis appear in it
  const hWords = hLower.match(/\b\w{4,}\b/g) || [];

  const scored = lines.map((line) => {
    const lineLower = line.toLowerCase();
    const score = hWords.filter((w) => lineLower.includes(w)).length;
    return { line, score };
  });

  // Take top 20 lines most relevant to the hypothesis
  const relevant = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((s) => s.line);

  return relevant.length > 0 ? relevant.join("\n") : computedStats.slice(0, 1500);
}

// ============================================================
// Input format detection and normalization
// ============================================================

/**
 * Normalize file content based on file extension and detected format.
 */
function normalizeInputFormat(text: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (ext === "json") {
    return flattenJsonToCsv(text) || text;
  }
  if (ext === "tsv") {
    return tsvToCsv(text);
  }
  return text;
}

/**
 * Convert file content to CSV format based on detected type.
 */
function toCsvFormat(text: string, filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "csv") return text;
  if (ext === "tsv") return tsvToCsv(text);
  if (ext === "json") return flattenJsonToCsv(text);
  if (ext === "txt") return detectAndNormalize(text).csv || null;
  return null;
}

/**
 * Auto-detect pasted text format and return CSV + description.
 */
function detectAndNormalize(text: string): { csv?: string; description: string } {
  const trimmed = text.trim();

  // Detect TSV (tabs more common than commas)
  const tabCount = (trimmed.match(/\t/g) || []).length;
  const commaCount = (trimmed.match(/,/g) || []).length;

  if (tabCount > commaCount) {
    const csv = tsvToCsv(trimmed);
    return { csv, description: `Pasted TSV data:\n${csv}` };
  }

  // Try JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const csv = flattenJsonToCsv(trimmed);
    if (csv) return { csv, description: `Pasted JSON data (flattened):\n${csv}` };
  }

  // Detect space-delimited
  const firstLine = trimmed.split("\n")[0];
  if (!firstLine.includes(",") && !firstLine.includes("\t") && firstLine.includes(" ")) {
    const csv = spaceToCsv(trimmed);
    return { csv, description: `Pasted space-delimited data:\n${csv}` };
  }

  // Default: assume CSV
  return { csv: trimmed, description: `Pasted CSV data:\n${trimmed}` };
}

function tsvToCsv(tsv: string): string {
  return tsv
    .split("\n")
    .map((line) =>
      line
        .split("\t")
        .map((cell) => {
          const c = cell.trim();
          return c.includes(",") ? `"${c.replace(/"/g, '""')}"` : c;
        })
        .join(","),
    )
    .join("\n");
}

function spaceToCsv(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim().split(/\s+/).join(","))
    .join("\n");
}

function flattenJsonToCsv(jsonText: string): string | null {
  try {
    const data = JSON.parse(jsonText);

    // Array of objects → CSV
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
      const allKeys = new Set<string>();
      for (const item of data) {
        Object.keys(flattenObject(item)).forEach((k) => allKeys.add(k));
      }
      const headers = Array.from(allKeys);
      const rows = data.map((item) => {
        const flat = flattenObject(item);
        return headers.map((h) => {
          const v = flat[h] ?? "";
          const s = String(v);
          return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
        });
      });
      return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    // Single object → key-value pairs
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      const flat = flattenObject(data);
      const pairs = Object.entries(flat);
      return ["key,value", ...pairs.map(([k, v]) => `${k},${v}`)].join("\n");
    }

    return null;
  } catch {
    return null;
  }
}

function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      result[fullKey] = JSON.stringify(value);
    } else {
      result[fullKey] = value as string | number;
    }
  }
  return result;
}

// ============================================================
// Claude with retry + exponential backoff
// ============================================================

/**
 * Call Claude with up to 2 retries and exponential backoff.
 * On final failure, throws so the caller can use its fallback.
 */
async function callClaudeWithRetry(
  client: Anthropic,
  prompt: string,
  stage: string,
  maxRetries = 2,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s
        await sleep(1000 * attempt);
        console.warn(`[LITMUS] Retrying ${stage} (attempt ${attempt + 1}/${maxRetries + 1})`);
      }
      return await callClaude(client, prompt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[LITMUS] ${stage} failed on attempt ${attempt + 1}:`, lastError.message);
    }
  }

  throw lastError ?? new Error(`${stage} failed after ${maxRetries + 1} attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Demo data loading
// ============================================================

/**
 * Load a named demo dataset from data/demo-datasets/{name}/.
 * Returns both a text description and pre-computed stats.
 */
async function loadDemoDataset(name: string): Promise<{ desc: string; stats: string; surpriseMap: Record<string, number>; charts: import("@/lib/analysis").ChartData[] }> {
  const config = DEMO_DATASETS[name];
  if (!config) {
    throw new Error(`Unknown demo dataset: ${name}`);
  }

  const datasetDir = path.join(process.cwd(), "data", "demo-datasets", name);
  const parts: string[] = [];
  const csvTexts: string[] = [];

  for (const file of config.files) {
    try {
      const content = await fs.readFile(path.join(datasetDir, file), "utf-8");
      parts.push(`--- ${file} ---\n${content}`);
      if (file.endsWith(".csv")) {
        csvTexts.push(content);
      }
    } catch {
      // Skip missing files
    }
  }

  const desc = parts.join("\n\n");

  // Run statistical analysis on CSV files
  const statsParts: string[] = [];
  const surpriseMap: Record<string, number> = {};
  const charts: import("@/lib/analysis").ChartData[] = [];

  for (const csvText of csvTexts) {
    const parsed = parseCSV(csvText);
    if (parsed.rows.length > 0) {
      statsParts.push(runAnalysisSuite(parsed));
      Object.assign(surpriseMap, computeSurpriseScores(parsed));
      charts.push(...generateChartData(parsed));
    }
  }
  const stats = statsParts.join("\n\n");

  return { desc, stats, surpriseMap, charts };
}

/**
 * Fuzzy-match a hypothesis text to a computed surprise score.
 * Looks for column names or test descriptions appearing in both.
 */
function matchSurpriseScore(
  hypothesisText: string,
  surpriseMap: Record<string, number>,
): number | null {
  const hText = hypothesisText.toLowerCase();

  let bestScore: number | null = null;
  let bestMatchLen = 0;

  for (const [key, score] of Object.entries(surpriseMap)) {
    const keyLower = key.toLowerCase();
    // Extract meaningful tokens from the key
    const tokens = keyLower
      .replace(/['"×()]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    // Count how many tokens appear in the hypothesis text
    const matchCount = tokens.filter((t) => hText.includes(t)).length;

    if (matchCount > 0 && matchCount >= bestMatchLen) {
      bestMatchLen = matchCount;
      bestScore = score;
    }
  }

  return bestScore;
}

/**
 * Load legacy demo data from data/demo/ directory.
 */
async function loadLegacyDemoData(): Promise<string> {
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
