import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";
import { parseCSV, runAnalysisSuite, generateChartData } from "@/lib/analysis";
import type { ParsedCSV } from "@/lib/analysis";
import { TOOL_DEFINITIONS, AGENT_SYSTEM_PROMPT, executeTool } from "@/lib/tools";
import type { ToolContext } from "@/lib/tools";

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 25; // Safety limit on agentic loop iterations

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
 * Agentic orchestrator route. Claude autonomously decides which statistical
 * tools to call and in what order, streaming progress via SSE.
 *
 * Architecture:
 * 1. Parse input (file upload, demo dataset, paste)
 * 2. Pre-compute stats overview
 * 3. Start Claude agentic loop with tool_use
 * 4. Stream tool calls and results to frontend in real time
 * 5. Claude writes final validated report
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const anthropic = new Anthropic();

  // ============================================================
  // Input Parsing (kept from original)
  // ============================================================

  let dataDescription = "";
  let parsedCSV: ParsedCSV = { headers: [], rows: [], numericColumns: {}, categoricalColumns: {} };
  let precomputedStats = "";
  let profileCharts: import("@/lib/analysis").ChartData[] = [];

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const demoDataset = formData.get("demoDataset");
    const isDemo = formData.get("demo") === "true";

    if (demoDataset && typeof demoDataset === "string") {
      const result = await loadDemoDataset(demoDataset);
      dataDescription = result.desc;
      parsedCSV = result.parsed;
      precomputedStats = result.stats;
      profileCharts = result.charts;
    } else if (isDemo) {
      dataDescription = await loadLegacyDemoData();
    } else {
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
      if (csvTexts.length > 0) {
        parsedCSV = parseCSV(csvTexts[0]);
        if (parsedCSV.rows.length > 0) {
          precomputedStats = runAnalysisSuite(parsedCSV);
          profileCharts = generateChartData(parsedCSV);
        }
      }
    }
  } else {
    const body = await req.json();
    if (body.demoDataset) {
      const result = await loadDemoDataset(body.demoDataset);
      dataDescription = result.desc;
      parsedCSV = result.parsed;
      precomputedStats = result.stats;
      profileCharts = result.charts;
    } else if (body.demo) {
      dataDescription = await loadLegacyDemoData();
    } else if (body.pastedText) {
      const detected = detectAndNormalize(body.pastedText);
      dataDescription = detected.description;
      if (detected.csv) {
        parsedCSV = parseCSV(detected.csv);
        if (parsedCSV.rows.length > 0) {
          precomputedStats = runAnalysisSuite(parsedCSV);
          profileCharts = generateChartData(parsedCSV);
        }
      }
    } else {
      dataDescription = body.data || "";
      if (dataDescription) {
        parsedCSV = parseCSV(dataDescription);
        if (parsedCSV.rows.length > 0) {
          precomputedStats = runAnalysisSuite(parsedCSV);
          profileCharts = generateChartData(parsedCSV);
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

  // ============================================================
  // Agentic Loop (SSE Streaming)
  // ============================================================

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      try {
        // Send initial stage
        send("stage", { stage: "analyzing", message: "LITMUS agent starting investigation..." });

        // Profile charts are delivered via generate_chart tool call — not sent upfront
        // This prevents chart duplication when Claude also calls generate_chart

        // Build tool context
        const toolContext: ToolContext = {
          parsedCSV,
          dataDescription,
          precomputedStats,
          charts: profileCharts,
        };

        // Initial message: give Claude the data
        const userMessage = `Here is a dataset to investigate:\n\n${dataDescription.slice(0, 8000)}\n\n${precomputedStats ? `Pre-computed statistical overview:\n${precomputedStats.slice(0, 4000)}` : "No pre-computed stats available — use the describe_dataset tool to get an overview."}\n\nAnalyze this data. Use your tools to discover, test, and validate findings. Be thorough and skeptical.`;

        const messages: Anthropic.Messages.MessageParam[] = [
          { role: "user", content: userMessage },
        ];

        let turnCount = 0;

        // Agentic loop: Claude calls tools until it's done
        while (turnCount < MAX_TURNS) {
          turnCount++;

          const response = await Promise.race([
            anthropic.messages.create({
              model: MODEL,
              max_tokens: 4096,
              system: AGENT_SYSTEM_PROMPT,
              tools: TOOL_DEFINITIONS,
              messages,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Claude API call timed out after 120s")), 120_000)
            ),
          ]);

          // Process response content blocks
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

          for (const block of response.content) {
            if (block.type === "text" && block.text.trim()) {
              send("thinking", { text: block.text });
            }

            if (block.type === "tool_use") {
              // Stream the tool call to the frontend
              send("tool_call", {
                id: block.id,
                tool: block.name,
                input: block.input,
              });

              // Execute the tool
              const result = await executeTool(
                block.name,
                block.input as Record<string, unknown>,
                toolContext,
              );

              // Stream the tool result
              send("tool_result", {
                id: block.id,
                tool: block.name,
                success: result.success,
                data: result.data,
              });

              // If the tool returned charts, stream them
              if (result.charts && result.charts.length > 0) {
                send("chart", { charts: result.charts });
              }

              // Collect tool results for the next Claude turn
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result.data),
              });
            }
          }

          // Add assistant message to conversation
          messages.push({ role: "assistant", content: response.content });

          // If Claude is done (no more tool calls), extract the report
          if (response.stop_reason === "end_turn") {
            // Extract final text as report
            const finalText = response.content
              .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
              .map((b) => b.text)
              .join("\n");

            send("stage", { stage: "done", message: "Investigation complete." });
            send("complete", { report: finalText });
            break;
          }

          // If there were tool calls, send results back to Claude
          if (toolResults.length > 0) {
            messages.push({ role: "user", content: toolResults });
          }

          // Safety: update stage based on turn count
          if (turnCount === 1) {
            send("stage", { stage: "profiling", message: "Examining dataset structure..." });
          } else if (turnCount <= 3) {
            send("stage", { stage: "hypothesizing", message: "Forming hypotheses..." });
          } else if (turnCount <= 8) {
            send("stage", { stage: "experimenting", message: "Running statistical tests..." });
          } else if (turnCount <= 12) {
            send("stage", { stage: "validating", message: "Validating findings..." });
          } else {
            send("stage", { stage: "narrating", message: "Writing report..." });
          }
        }

        if (turnCount >= MAX_TURNS) {
          send("error", { message: "Agent reached maximum investigation depth. Presenting findings so far." });
          send("stage", { stage: "done", message: "Investigation ended (max turns)." });
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
// Demo data loading
// ============================================================

async function loadDemoDataset(name: string): Promise<{
  desc: string;
  stats: string;
  parsed: ParsedCSV;
  charts: import("@/lib/analysis").ChartData[];
}> {
  if (/[^a-zA-Z0-9_-]/.test(name)) throw new Error(`Invalid dataset name: ${name}`);
  const config = DEMO_DATASETS[name];
  if (!config) throw new Error(`Unknown demo dataset: ${name}`);

  const datasetDir = path.join(process.cwd(), "data", "demo-datasets", name);
  const parts: string[] = [];
  const csvTexts: string[] = [];

  for (const file of config.files) {
    try {
      const content = await fs.readFile(path.join(datasetDir, file), "utf-8");
      parts.push(`--- ${file} ---\n${content}`);
      if (file.endsWith(".csv")) csvTexts.push(content);
    } catch {
      // Skip missing files
    }
  }

  const desc = parts.join("\n\n");
  let parsed: ParsedCSV = { headers: [], rows: [], numericColumns: {}, categoricalColumns: {} };
  let stats = "";
  const charts: import("@/lib/analysis").ChartData[] = [];

  for (const csvText of csvTexts) {
    parsed = parseCSV(csvText);
    if (parsed.rows.length > 0) {
      stats += runAnalysisSuite(parsed) + "\n\n";
      charts.push(...generateChartData(parsed));
    }
  }

  return { desc, stats: stats.trim(), parsed, charts };
}

async function loadLegacyDemoData(): Promise<string> {
  const demoDir = path.join(process.cwd(), "data", "demo");
  const files = ["config.json", "loss.csv", "metrics.csv"];
  const parts: string[] = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(demoDir, file), "utf-8");
      parts.push(`--- ${file} ---\n${content}`);
    } catch { /* skip */ }
  }
  return parts.join("\n\n");
}

// ============================================================
// Input format detection and normalization
// ============================================================

function normalizeInputFormat(text: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "json") return flattenJsonToCsv(text) || text;
  if (ext === "tsv") return tsvToCsv(text);
  return text;
}

function toCsvFormat(text: string, filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "csv") return text;
  if (ext === "tsv") return tsvToCsv(text);
  if (ext === "json") return flattenJsonToCsv(text);
  if (ext === "txt") return detectAndNormalize(text).csv || null;
  return null;
}

function detectAndNormalize(text: string): { csv?: string; description: string } {
  const trimmed = text.trim();
  const tabCount = (trimmed.match(/\t/g) || []).length;
  const commaCount = (trimmed.match(/,/g) || []).length;
  if (tabCount > commaCount) {
    const csv = tsvToCsv(trimmed);
    return { csv, description: `Pasted TSV data:\n${csv}` };
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const csv = flattenJsonToCsv(trimmed);
    if (csv) return { csv, description: `Pasted JSON data (flattened):\n${csv}` };
  }
  const firstLine = trimmed.split("\n")[0];
  if (!firstLine.includes(",") && !firstLine.includes("\t") && firstLine.includes(" ")) {
    const csv = spaceToCsv(trimmed);
    return { csv, description: `Pasted space-delimited data:\n${csv}` };
  }
  return { csv: trimmed, description: `Pasted CSV data:\n${trimmed}` };
}

function tsvToCsv(tsv: string): string {
  return tsv.split("\n").map((line) =>
    line.split("\t").map((cell) => {
      const c = cell.trim();
      return c.includes(",") ? `"${c.replace(/"/g, '""')}"` : c;
    }).join(",")
  ).join("\n");
}

function spaceToCsv(text: string): string {
  return text.split("\n").map((line) => line.trim().split(/\s+/).join(",")).join("\n");
}

function flattenJsonToCsv(jsonText: string): string | null {
  try {
    const data = JSON.parse(jsonText);
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
      const allKeys = new Set<string>();
      for (const item of data) Object.keys(flattenObject(item)).forEach((k) => allKeys.add(k));
      const headers = Array.from(allKeys);
      const rows = data.map((item) => {
        const flat = flattenObject(item);
        return headers.map((h) => {
          const s = String(flat[h] ?? "");
          return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
        });
      });
      return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      const flat = flattenObject(data);
      return ["key,value", ...Object.entries(flat).map(([k, v]) => `${k},${v}`)].join("\n");
    }
    return null;
  } catch { return null; }
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
