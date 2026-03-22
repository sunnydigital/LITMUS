/**
 * lib/mcp-discovery.ts — Virtual MCP Data Discovery for LITMUS
 *
 * Treats the data/demo-datasets/ directory as a "virtual MCP data source."
 * Discovers available datasets, profiles them, and generates cross-dataset hypotheses.
 *
 * In production, replace the virtual MCP with real MCP server / DB connector calls.
 */

import { promises as fs } from "fs";
import path from "path";
import { parseCSV, runAnalysisSuite, computeSurpriseScores, type ParsedCSV } from "@/lib/analysis";

export interface DataSource {
  id: string;
  name: string;
  description: string;
  tables: DataTable[];
  sourceType: "csv" | "mcp" | "database";
  path?: string;
}

export interface DataTable {
  name: string;
  rowCount: number;
  columns: ColumnMeta[];
  sampleRows: Record<string, string | number>[];
  statsPreview: string;
}

export interface ColumnMeta {
  name: string;
  type: "numeric" | "categorical";
  uniqueValues?: number;
  min?: number;
  max?: number;
  mean?: number;
}

export interface CrossDatasetHypothesis {
  id: string;
  datasets: string[];
  joinKey?: string;
  hypothesis: string;
  rationale: string;
  priority: "high" | "medium" | "low";
}

/**
 * Discover all available data sources.
 * Scans the demo-datasets directory (virtual MCP) and any configured real MCP endpoints.
 */
export async function discoverDataSources(): Promise<DataSource[]> {
  const sources: DataSource[] = [];

  // Virtual MCP: scan demo-datasets directory
  const demoDir = path.join(process.cwd(), "data", "demo-datasets");
  try {
    const entries = await fs.readdir(demoDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const datasetDir = path.join(demoDir, entry.name);
      const source = await profileDatasetDirectory(entry.name, datasetDir);
      if (source) sources.push(source);
    }
  } catch {
    // Demo-datasets directory not found — skip
  }

  // Real MCP endpoint (if configured)
  const mcpEndpoint = process.env.MCP_ENDPOINT_URL;
  if (mcpEndpoint) {
    try {
      const mcpSource = await discoverMCPEndpoint(mcpEndpoint);
      if (mcpSource) sources.push(mcpSource);
    } catch (err) {
      console.warn("[LITMUS] MCP endpoint discovery failed:", err instanceof Error ? err.message : err);
    }
  }

  return sources;
}

/**
 * Profile a single dataset directory (may contain multiple CSV files).
 */
async function profileDatasetDirectory(
  name: string,
  dirPath: string,
): Promise<DataSource | null> {
  try {
    const files = await fs.readdir(dirPath);
    const csvFiles = files.filter((f) => f.endsWith(".csv"));
    if (csvFiles.length === 0) return null;

    // Try to read config.json for metadata
    let description = `Dataset: ${name}`;
    try {
      const configText = await fs.readFile(path.join(dirPath, "config.json"), "utf-8");
      const config = JSON.parse(configText);
      description = config.description || config.name || description;
    } catch {
      // No config — use directory name
    }

    const tables: DataTable[] = [];

    for (const csvFile of csvFiles) {
      try {
        const text = await fs.readFile(path.join(dirPath, csvFile), "utf-8");
        const parsed = parseCSV(text);
        if (parsed.rows.length === 0) continue;

        const columns: ColumnMeta[] = [];

        for (const col of Object.keys(parsed.numericColumns)) {
          const vals = parsed.numericColumns[col].filter((v) => !isNaN(v));
          columns.push({
            name: col,
            type: "numeric",
            min: Math.min(...vals),
            max: Math.max(...vals),
            mean: vals.reduce((a, b) => a + b, 0) / vals.length,
          });
        }

        for (const col of Object.keys(parsed.categoricalColumns)) {
          const vals = parsed.categoricalColumns[col];
          columns.push({
            name: col,
            type: "categorical",
            uniqueValues: new Set(vals.filter((v) => v && v !== "NaN")).size,
          });
        }

        const statsPreview = runAnalysisSuite(parsed).slice(0, 1000);
        const sampleRows = parsed.rows.slice(0, 5);

        tables.push({
          name: csvFile.replace(".csv", ""),
          rowCount: parsed.rows.length,
          columns,
          sampleRows,
          statsPreview,
        });
      } catch {
        // Skip unreadable files
      }
    }

    if (tables.length === 0) return null;

    return {
      id: name,
      name: name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      description,
      tables,
      sourceType: "csv",
      path: dirPath,
    };
  } catch {
    return null;
  }
}

/**
 * Discover tables from a real MCP endpoint (stub — extend for real MCP).
 * Calls GET /resources on the MCP server.
 */
async function discoverMCPEndpoint(endpoint: string): Promise<DataSource | null> {
  const response = await fetch(`${endpoint}/resources`, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) return null;

  const resources = await response.json();
  if (!Array.isArray(resources)) return null;

  return {
    id: "mcp-external",
    name: "MCP Data Source",
    description: `External MCP endpoint: ${endpoint}`,
    tables: resources.map((r: Record<string, unknown>) => ({
      name: String(r.name || r.id || "unknown"),
      rowCount: Number(r.count || 0),
      columns: [],
      sampleRows: [],
      statsPreview: String(r.description || ""),
    })),
    sourceType: "mcp",
  };
}

/**
 * Cross-dataset analysis: find common columns and generate hypotheses about relationships.
 */
export function crossDatasetAnalysis(datasets: { id: string; parsed: ParsedCSV }[]): {
  commonColumns: string[];
  hypotheses: CrossDatasetHypothesis[];
  correlations: Array<{ dataset1: string; dataset2: string; col1: string; col2: string; note: string }>;
} {
  if (datasets.length < 2) {
    return { commonColumns: [], hypotheses: [], correlations: [] };
  }

  // Find common column names across datasets
  const allColSets = datasets.map((d) => new Set([
    ...Object.keys(d.parsed.numericColumns),
    ...Object.keys(d.parsed.categoricalColumns),
  ]));

  // Columns that appear in at least 2 datasets
  const colCounts: Record<string, number> = {};
  for (const colSet of allColSets) {
    for (const col of colSet) {
      colCounts[col] = (colCounts[col] || 0) + 1;
    }
  }
  const commonColumns = Object.entries(colCounts)
    .filter(([, count]) => count >= 2)
    .map(([col]) => col)
    .sort();

  const hypotheses: CrossDatasetHypothesis[] = [];
  const correlations: Array<{ dataset1: string; dataset2: string; col1: string; col2: string; note: string }> = [];

  // Generate cross-dataset hypotheses
  for (let i = 0; i < datasets.length; i++) {
    for (let j = i + 1; j < datasets.length; j++) {
      const d1 = datasets[i];
      const d2 = datasets[j];

      const sharedCols = Object.keys(d1.parsed.numericColumns).filter(
        (col) => col in d2.parsed.numericColumns,
      );

      const sharedCats = Object.keys(d1.parsed.categoricalColumns).filter(
        (col) => col in d2.parsed.categoricalColumns,
      );

      // Look for potential join keys (low-cardinality categorical columns)
      const potentialJoinKeys = sharedCats.filter((col) => {
        const uniq1 = new Set(d1.parsed.categoricalColumns[col]).size;
        const uniq2 = new Set(d2.parsed.categoricalColumns[col]).size;
        return uniq1 < 50 && uniq2 < 50;
      });

      const joinKey = potentialJoinKeys[0];

      // Hypothesis: correlation between numeric cols across datasets
      for (const col of sharedCols.slice(0, 3)) {
        hypotheses.push({
          id: `cross-${d1.id}-${d2.id}-${col}`,
          datasets: [d1.id, d2.id],
          joinKey,
          hypothesis: `Does "${col}" in "${d1.id}" show similar patterns to "${col}" in "${d2.id}"?`,
          rationale: `Both datasets contain the column "${col}". Comparing their distributions may reveal structural similarities or differences.`,
          priority: sharedCols.length > 3 ? "high" : "medium",
        });

        correlations.push({
          dataset1: d1.id,
          dataset2: d2.id,
          col1: col,
          col2: col,
          note: `Shared column "${col}" — compare distributions (n=${d1.parsed.rows.length} vs n=${d2.parsed.rows.length})`,
        });
      }

      // Hypothesis: join and look for outcome differences
      if (joinKey) {
        hypotheses.push({
          id: `cross-join-${d1.id}-${d2.id}`,
          datasets: [d1.id, d2.id],
          joinKey,
          hypothesis: `Do entities from "${d1.id}" that match "${d2.id}" on "${joinKey}" show different outcomes?`,
          rationale: `Both datasets share the "${joinKey}" column, enabling a potential join. Cross-dataset comparison may reveal selection effects or hidden relationships.`,
          priority: "high",
        });
      } else {
        // No join key — look for structural similarities
        hypotheses.push({
          id: `cross-structural-${d1.id}-${d2.id}`,
          datasets: [d1.id, d2.id],
          hypothesis: `Do the statistical patterns in "${d1.id}" and "${d2.id}" share underlying data-generating processes?`,
          rationale: `No common join key found, but both datasets may share latent structure (e.g., both showing Simpson's Paradox or similar distribution shapes).`,
          priority: "low",
        });
      }
    }
  }

  return { commonColumns, hypotheses, correlations };
}

/**
 * Load multiple datasets from the demo-datasets directory.
 * Returns parsed CSVs for cross-dataset analysis.
 */
export async function loadMultipleDatasets(
  datasetIds: string[],
): Promise<Array<{ id: string; parsed: ParsedCSV; stats: string; surpriseMap: Record<string, number> }>> {
  const results = [];

  for (const id of datasetIds) {
    const datasetDir = path.join(process.cwd(), "data", "demo-datasets", id);
    try {
      const files = await fs.readdir(datasetDir);
      const csvFiles = files.filter((f) => f.endsWith(".csv"));

      for (const csvFile of csvFiles) {
        const text = await fs.readFile(path.join(datasetDir, csvFile), "utf-8");
        const parsed = parseCSV(text);
        if (parsed.rows.length > 0) {
          const stats = runAnalysisSuite(parsed);
          const surpriseMap = computeSurpriseScores(parsed);
          results.push({ id: `${id}/${csvFile}`, parsed, stats, surpriseMap });
        }
      }
    } catch {
      // Skip missing datasets
    }
  }

  return results;
}
