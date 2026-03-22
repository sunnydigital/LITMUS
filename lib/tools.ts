/**
 * tools.ts - Tool definitions and executor for the LITMUS agentic loop.
 *
 * Wraps existing statistical functions from analysis.ts, skeptic.ts, and surprise.ts
 * as Anthropic tool_use compatible tools. Claude decides which to call and in what order.
 */

import type { ParsedCSV, ChartData } from "@/lib/analysis";
import {
  twoSampleTTest,
  pearsonCorrelation,
  detectSimpsonsParadox,
  detectChangepoints,
  zScoreAnomalies,
  chiSquareTest,
  computeEntropy,
  generateChartData,
  runAnalysisSuite,
} from "@/lib/analysis";
import { benjaminiHochberg, effectSizeCheck, computeGrade } from "@/lib/skeptic";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

// ---- Tool Definitions (Anthropic format) ----

export const TOOL_DEFINITIONS: Tool[] = [
  {
    name: "describe_dataset",
    description:
      "Get a comprehensive statistical overview of the dataset: column names, types, row count, descriptive statistics, correlations, t-tests, and notable patterns. Call this first to understand the data.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "run_ttest",
    description:
      "Run Welch's two-sample t-test comparing a numeric column across two groups defined by a categorical column. Returns t-statistic, p-value, Cohen's d effect size, and group means.",
    input_schema: {
      type: "object" as const,
      properties: {
        group_column: {
          type: "string",
          description: "Categorical column that defines the two groups (e.g., 'treatment', 'arm')",
        },
        value_column: {
          type: "string",
          description: "Numeric column to compare between groups (e.g., 'converted', 'primary_endpoint')",
        },
      },
      required: ["group_column", "value_column"],
    },
  },
  {
    name: "compute_correlation",
    description:
      "Compute Pearson correlation between two numeric columns. Returns correlation coefficient r, p-value, and sample size.",
    input_schema: {
      type: "object" as const,
      properties: {
        column_x: { type: "string", description: "First numeric column" },
        column_y: { type: "string", description: "Second numeric column" },
      },
      required: ["column_x", "column_y"],
    },
  },
  {
    name: "detect_simpsons_paradox",
    description:
      "Check if a trend reverses when stratified by subgroups — Simpson's Paradox. Provide an outcome column (numeric), a treatment/group column (categorical), and a stratification column (categorical). If the overall trend is opposite to within-group trends, this is a paradox.",
    input_schema: {
      type: "object" as const,
      properties: {
        outcome_column: { type: "string", description: "Numeric outcome column (e.g., 'converted', 'score')" },
        treatment_column: { type: "string", description: "Categorical treatment/group column (e.g., 'variant', 'arm')" },
        stratify_column: { type: "string", description: "Categorical column to stratify by (e.g., 'segment', 'device')" },
      },
      required: ["outcome_column", "treatment_column", "stratify_column"],
    },
  },
  {
    name: "detect_changepoints",
    description:
      "Find structural breaks in a numeric time series where the statistical properties (mean, variance) shift significantly. Returns indices and magnitude of each changepoint.",
    input_schema: {
      type: "object" as const,
      properties: {
        column: { type: "string", description: "Numeric column to analyze for changepoints" },
      },
      required: ["column"],
    },
  },
  {
    name: "detect_anomalies",
    description:
      "Find anomalous data points in a numeric column using rolling z-scores (threshold 2.5). Returns indices and z-scores of anomalous values.",
    input_schema: {
      type: "object" as const,
      properties: {
        column: { type: "string", description: "Numeric column to check for anomalies" },
      },
      required: ["column"],
    },
  },
  {
    name: "chi_square_test",
    description:
      "Run a chi-square goodness-of-fit test on a categorical column to check if the distribution is non-uniform. Returns chi-square statistic, p-value, and degrees of freedom.",
    input_schema: {
      type: "object" as const,
      properties: {
        column: { type: "string", description: "Categorical column to test" },
      },
      required: ["column"],
    },
  },
  {
    name: "compute_entropy",
    description:
      "Compute Shannon entropy of a numeric column's distribution. High entropy = uniform/unpredictable, low entropy = concentrated/predictable.",
    input_schema: {
      type: "object" as const,
      properties: {
        column: { type: "string", description: "Numeric column to compute entropy for" },
      },
      required: ["column"],
    },
  },
  {
    name: "validate_findings",
    description:
      "Run the skeptic gauntlet on all findings so far. Applies Benjamini-Hochberg FDR correction for multiple testing and Cohen's d effect size threshold (> 0.3). Returns which findings survive and their grades (A/B/C). ALWAYS call this after running multiple statistical tests.",
    input_schema: {
      type: "object" as const,
      properties: {
        findings: {
          type: "array",
          description: "Array of findings to validate",
          items: {
            type: "object",
            properties: {
              description: { type: "string", description: "What the finding claims" },
              p_value: { type: "number", description: "P-value from the test" },
              effect_size: { type: "number", description: "Cohen's d or equivalent" },
            },
            required: ["description", "p_value", "effect_size"],
          },
        },
      },
      required: ["findings"],
    },
  },
  {
    name: "generate_chart",
    description:
      "Generate auto-detected charts based on the dataset type. Returns chart configurations for the frontend to render. Charts include grouped bars for A/B tests, line charts for time series, forest plots for clinical trials.",
    input_schema: {
      type: "object" as const,
      properties: {
        chart_type: {
          type: "string",
          enum: ["auto", "bar", "grouped-bar", "line", "forest"],
          description: "Chart type: 'auto' to auto-detect, or specify explicitly",
        },
        title: { type: "string", description: "Chart title (used for custom charts)" },
      },
      required: [],
    },
  },
  {
    name: "web_search",
    description:
      "Search the web to find relevant research, papers, or context about a statistical finding. Use this to ground your discoveries in existing knowledge.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
];

// ---- Tool Context (shared state for the agentic loop) ----

export interface ToolContext {
  parsedCSV: ParsedCSV;
  dataDescription: string;
  precomputedStats: string;
  charts: ChartData[];
}

// ---- Tool Executor ----

export interface ToolResult {
  success: boolean;
  data: unknown;
  charts?: ChartData[];
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  switch (name) {
    case "describe_dataset":
      return executeDescribeDataset(ctx);
    case "run_ttest":
      return executeRunTTest(input, ctx);
    case "compute_correlation":
      return executeComputeCorrelation(input, ctx);
    case "detect_simpsons_paradox":
      return executeDetectSimpsonsParadox(input, ctx);
    case "detect_changepoints":
      return executeDetectChangepoints(input, ctx);
    case "detect_anomalies":
      return executeDetectAnomalies(input, ctx);
    case "chi_square_test":
      return executeChiSquareTest(input, ctx);
    case "compute_entropy":
      return executeComputeEntropy(input, ctx);
    case "validate_findings":
      return executeValidateFindings(input);
    case "generate_chart":
      return executeGenerateChart(input, ctx);
    case "web_search":
      return executeWebSearch(input);
    default:
      return { success: false, data: { error: `Unknown tool: ${name}` } };
  }
}

// ---- Individual Tool Implementations ----

function executeDescribeDataset(ctx: ToolContext): ToolResult {
  if (ctx.precomputedStats) {
    return {
      success: true,
      data: {
        row_count: ctx.parsedCSV.rows.length,
        columns: ctx.parsedCSV.headers,
        numeric_columns: Object.keys(ctx.parsedCSV.numericColumns),
        categorical_columns: Object.keys(ctx.parsedCSV.categoricalColumns),
        statistical_overview: ctx.precomputedStats,
      },
    };
  }
  const stats = runAnalysisSuite(ctx.parsedCSV);
  return {
    success: true,
    data: {
      row_count: ctx.parsedCSV.rows.length,
      columns: ctx.parsedCSV.headers,
      numeric_columns: Object.keys(ctx.parsedCSV.numericColumns),
      categorical_columns: Object.keys(ctx.parsedCSV.categoricalColumns),
      statistical_overview: stats,
    },
  };
}

function executeRunTTest(input: Record<string, unknown>, ctx: ToolContext): ToolResult {
  const groupCol = String(input.group_column || "");
  const valueCol = String(input.value_column || "");

  const catValues = ctx.parsedCSV.categoricalColumns[groupCol];
  const numValues = ctx.parsedCSV.numericColumns[valueCol];

  if (!catValues) {
    return { success: false, data: { error: `Column '${groupCol}' not found or not categorical. Available: ${Object.keys(ctx.parsedCSV.categoricalColumns).join(", ")}` } };
  }
  if (!numValues) {
    return { success: false, data: { error: `Column '${valueCol}' not found or not numeric. Available: ${Object.keys(ctx.parsedCSV.numericColumns).join(", ")}` } };
  }

  const uniqueGroups = [...new Set(catValues)];
  if (uniqueGroups.length < 2) {
    return { success: false, data: { error: `Column '${groupCol}' has only ${uniqueGroups.length} unique value(s). Need at least 2 groups.` } };
  }

  // Use first two groups
  const groupA = uniqueGroups[0];
  const groupB = uniqueGroups[1];
  const valsA = numValues.filter((_, i) => catValues[i] === groupA).filter((v) => !isNaN(v));
  const valsB = numValues.filter((_, i) => catValues[i] === groupB).filter((v) => !isNaN(v));

  if (valsA.length < 2 || valsB.length < 2) {
    return { success: false, data: { error: `Not enough data: group '${groupA}' has ${valsA.length} values, group '${groupB}' has ${valsB.length} values.` } };
  }

  const result = twoSampleTTest(valsA, valsB);
  return {
    success: true,
    data: {
      test: "Welch's two-sample t-test",
      groups: { [groupA]: { n: valsA.length, mean: round(result.meanA, 4) }, [groupB]: { n: valsB.length, mean: round(result.meanB, 4) } },
      t_statistic: round(result.tStat, 4),
      p_value: round(result.pValue, 6),
      cohens_d: round(result.cohensD, 4),
      significant: result.pValue < 0.05,
      effect_magnitude: Math.abs(result.cohensD) < 0.2 ? "negligible" : Math.abs(result.cohensD) < 0.5 ? "small" : Math.abs(result.cohensD) < 0.8 ? "medium" : "large",
    },
  };
}

function executeComputeCorrelation(input: Record<string, unknown>, ctx: ToolContext): ToolResult {
  const colX = String(input.column_x || "");
  const colY = String(input.column_y || "");

  const xVals = ctx.parsedCSV.numericColumns[colX];
  const yVals = ctx.parsedCSV.numericColumns[colY];

  if (!xVals) return { success: false, data: { error: `Numeric column '${colX}' not found. Available: ${Object.keys(ctx.parsedCSV.numericColumns).join(", ")}` } };
  if (!yVals) return { success: false, data: { error: `Numeric column '${colY}' not found. Available: ${Object.keys(ctx.parsedCSV.numericColumns).join(", ")}` } };

  const result = pearsonCorrelation(xVals, yVals);
  return {
    success: true,
    data: {
      test: "Pearson correlation",
      columns: [colX, colY],
      r: round(result.r, 4),
      p_value: round(result.pValue, 6),
      n: result.n,
      significant: result.pValue < 0.05,
      strength: Math.abs(result.r) < 0.3 ? "weak" : Math.abs(result.r) < 0.7 ? "moderate" : "strong",
      direction: result.r > 0 ? "positive" : "negative",
    },
  };
}

function executeDetectSimpsonsParadox(input: Record<string, unknown>, ctx: ToolContext): ToolResult {
  const outcomeCol = String(input.outcome_column || "");
  const treatmentCol = String(input.treatment_column || "");
  const stratifyCol = String(input.stratify_column || "");

  if (!outcomeCol || !treatmentCol || !stratifyCol) {
    return { success: false, data: { error: "All three columns required: outcome_column, treatment_column, stratify_column." } };
  }
  if (!ctx.parsedCSV.numericColumns[outcomeCol]) {
    return { success: false, data: { error: `Numeric column '${outcomeCol}' not found. Available: ${Object.keys(ctx.parsedCSV.numericColumns).join(", ")}` } };
  }
  if (!ctx.parsedCSV.categoricalColumns[treatmentCol]) {
    return { success: false, data: { error: `Categorical column '${treatmentCol}' not found. Available: ${Object.keys(ctx.parsedCSV.categoricalColumns).join(", ")}` } };
  }
  if (!ctx.parsedCSV.categoricalColumns[stratifyCol]) {
    return { success: false, data: { error: `Categorical column '${stratifyCol}' not found. Available: ${Object.keys(ctx.parsedCSV.categoricalColumns).join(", ")}` } };
  }

  const result = detectSimpsonsParadox(ctx.parsedCSV, outcomeCol, treatmentCol, stratifyCol);
  return {
    success: true,
    data: {
      paradox_detected: result.paradoxDetected,
      description: result.description,
      overall_difference: round(result.overallDiff, 4),
      strata_differences: result.strataDiffs,
    },
  };
}

function executeDetectChangepoints(input: Record<string, unknown>, ctx: ToolContext): ToolResult {
  const col = String(input.column || "");
  const values = ctx.parsedCSV.numericColumns[col];
  if (!values) return { success: false, data: { error: `Numeric column '${col}' not found. Available: ${Object.keys(ctx.parsedCSV.numericColumns).join(", ")}` } };

  const result = detectChangepoints(values);
  return {
    success: true,
    data: {
      column: col,
      changepoints_found: result.indices.length,
      changepoint_indices: result.indices,
      magnitude_ratios: result.ratios.map((r) => round(r, 3)),
      total_observations: values.length,
    },
  };
}

function executeDetectAnomalies(input: Record<string, unknown>, ctx: ToolContext): ToolResult {
  const col = String(input.column || "");
  const values = ctx.parsedCSV.numericColumns[col];
  if (!values) return { success: false, data: { error: `Numeric column '${col}' not found. Available: ${Object.keys(ctx.parsedCSV.numericColumns).join(", ")}` } };

  const result = zScoreAnomalies(values);
  return {
    success: true,
    data: {
      column: col,
      anomalies_found: result.indices.length,
      anomaly_indices: result.indices.slice(0, 20),
      z_scores: result.zScores.slice(0, 20).map((z) => round(z, 3)),
      total_observations: values.length,
      anomaly_rate: round(result.indices.length / values.length, 4),
    },
  };
}

function executeChiSquareTest(input: Record<string, unknown>, ctx: ToolContext): ToolResult {
  const col = String(input.column || "");
  const catValues = ctx.parsedCSV.categoricalColumns[col];
  if (!catValues) return { success: false, data: { error: `Categorical column '${col}' not found. Available: ${Object.keys(ctx.parsedCSV.categoricalColumns).join(", ")}` } };

  // Count frequencies
  const counts: Record<string, number> = {};
  for (const v of catValues) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const observed = Object.values(counts);
  const total = observed.reduce((a, b) => a + b, 0);
  const expected = observed.map(() => total / observed.length);

  const result = chiSquareTest(observed, expected);
  return {
    success: true,
    data: {
      test: "Chi-square goodness-of-fit",
      column: col,
      observed_frequencies: counts,
      chi_square: round(result.chiSq, 4),
      p_value: round(result.pValue, 6),
      degrees_of_freedom: result.df,
      significant: result.pValue < 0.05,
    },
  };
}

function executeComputeEntropy(input: Record<string, unknown>, ctx: ToolContext): ToolResult {
  const col = String(input.column || "");
  const values = ctx.parsedCSV.numericColumns[col];
  if (!values) return { success: false, data: { error: `Numeric column '${col}' not found. Available: ${Object.keys(ctx.parsedCSV.numericColumns).join(", ")}` } };

  const validValues = values.filter((v) => !isNaN(v));
  // Create a histogram distribution
  const bins = 10;
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const binWidth = (max - min) / bins || 1;
  const histogram = new Array(bins).fill(0);
  for (const v of validValues) {
    const bin = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    histogram[bin]++;
  }
  const total = validValues.length;
  const distribution = histogram.map((c) => c / total);

  const entropy = computeEntropy(distribution);
  const maxEntropy = Math.log2(bins);

  return {
    success: true,
    data: {
      column: col,
      entropy: round(entropy, 4),
      max_possible_entropy: round(maxEntropy, 4),
      normalized_entropy: round(entropy / maxEntropy, 4),
      interpretation: entropy / maxEntropy > 0.8 ? "high (near-uniform distribution)" : entropy / maxEntropy > 0.5 ? "moderate" : "low (concentrated distribution)",
    },
  };
}

function executeValidateFindings(input: Record<string, unknown>): ToolResult {
  const findings = (input.findings as Array<{ description: string; p_value: number; effect_size: number }>) || [];
  if (findings.length === 0) {
    return { success: false, data: { error: "No findings to validate." } };
  }

  const pValues = findings.map((f) => f.p_value);
  const fdrSurvives = benjaminiHochberg(pValues);

  const validated = findings.map((f, i) => {
    const fdrPass = fdrSurvives[i];
    const esCheck = effectSizeCheck(f.effect_size);
    const checks = [
      { name: "BH-FDR Correction", result: fdrPass ? "PASS" : "FAIL", reason: fdrPass ? `Survives at q=0.05 (${pValues.length} total tests)` : `Killed by BH-FDR (${pValues.length} total tests)` },
      { name: "Effect Size", result: esCheck.result, reason: esCheck.reason },
    ];
    const passCount = checks.filter((c) => c.result === "PASS").length;
    const grade = passCount === 2 ? "A" : passCount === 1 ? "B" : "C";

    return {
      description: f.description,
      p_value: f.p_value,
      effect_size: f.effect_size,
      fdr_survives: fdrPass,
      effect_size_adequate: esCheck.result === "PASS",
      grade,
      checks,
      verdict: grade === "C" ? "ARCHIVED — not reliable" : grade === "B" ? "MARGINAL — use with caution" : "VALIDATED — robust finding",
    };
  });

  const summary = {
    total_findings: findings.length,
    grade_a: validated.filter((v) => v.grade === "A").length,
    grade_b: validated.filter((v) => v.grade === "B").length,
    grade_c: validated.filter((v) => v.grade === "C").length,
    killed_by_fdr: validated.filter((v) => !v.fdr_survives).length,
    killed_by_effect_size: validated.filter((v) => !v.effect_size_adequate).length,
  };

  return {
    success: true,
    data: { findings: validated, summary },
  };
}

function executeGenerateChart(_input: Record<string, unknown>, ctx: ToolContext): ToolResult {
  const charts = generateChartData(ctx.parsedCSV);
  if (charts.length === 0) {
    return { success: true, data: { message: "No charts auto-detected for this dataset type." }, charts: [] };
  }
  return {
    success: true,
    data: { charts_generated: charts.length, types: charts.map((c) => c.type) },
    charts,
  };
}

async function executeWebSearch(input: Record<string, unknown>): Promise<ToolResult> {
  const query = String(input.query || "");
  if (!query) return { success: false, data: { error: "No search query provided." } };

  // Try Brave Search API if available
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    try {
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
        headers: { "X-Subscription-Token": braveKey, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const results = (data.web?.results || []).slice(0, 5).map((r: { title: string; url: string; description: string }) => ({
          title: r.title,
          url: r.url,
          snippet: r.description,
        }));
        return { success: true, data: { query, results, source: "brave" } };
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Try Tavily if available
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: tavilyKey, query, max_results: 5 }),
      });
      if (res.ok) {
        const data = await res.json();
        const results = (data.results || []).slice(0, 5).map((r: { title: string; url: string; content: string }) => ({
          title: r.title,
          url: r.url,
          snippet: r.content?.slice(0, 200),
        }));
        return { success: true, data: { query, results, source: "tavily" } };
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: return a note that web search is not configured
  return {
    success: true,
    data: {
      query,
      results: [],
      source: "none",
      note: "Web search API not configured. Set BRAVE_SEARCH_API_KEY or TAVILY_API_KEY for live results.",
    },
  };
}

// ---- Helpers ----

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

// ---- System Prompt ----

export const AGENT_SYSTEM_PROMPT = `You are LITMUS, an autonomous data research agent. You investigate datasets to discover statistically validated insights.

You have a dataset loaded and a toolkit of statistical analysis functions. Your mission is to find the most important, REAL patterns — and kill the fake ones.

## How You Work

1. OBSERVE: Call describe_dataset to understand the data structure and see a comprehensive statistical overview.
2. HYPOTHESIZE: Based on what you see, form 3-5 hypotheses about interesting patterns. Explain your reasoning.
3. TEST: Run targeted statistical tests using your tools. NEVER guess p-values — always use the tools.
4. VALIDATE: After testing all hypotheses, ALWAYS call validate_findings with ALL your findings. This runs Benjamini-Hochberg FDR correction and effect size filtering. This is critical — it catches false discoveries from multiple testing.
5. VISUALIZE: Call generate_chart to create visualizations of your key findings.
6. CONTEXTUALIZE: Optionally search the web for relevant research context.
7. REPORT: Write a comprehensive markdown report of your validated discoveries.

## Critical Rules

- Be GENUINELY SKEPTICAL. Most initial findings are false discoveries.
- Always use tools to get real numbers. Never fabricate statistics.
- After testing multiple hypotheses, ALWAYS validate with validate_findings.
- Only include findings graded A or B in your final report. Grade C findings are archived.
- Effect size matters more than p-value. A tiny effect (Cohen's d < 0.2), even if "significant," is not interesting.
- Show your reasoning at EVERY step. Explain WHY you're running each test and WHAT you expect to find.
- If a finding fails validation, say so honestly and explain why. Failed validations are interesting too.

## Your Report Format

Write your final report in markdown:

# Discovery Report: [Dataset Name]

## Executive Summary
2-3 sentence summary of what you found and what survived validation.

## Validated Findings

### Finding 1: [Title]
**Grade: [A/B]** | p = [value] | Cohen's d = [value]
[Description of what you found, why it matters, and the evidence]

### Finding 2: ...

## Archived Findings (Failed Validation)
Brief note on what looked promising but was killed by the skeptic gauntlet and why.

## What to Investigate Next
2-3 follow-up questions for deeper analysis.
`;
