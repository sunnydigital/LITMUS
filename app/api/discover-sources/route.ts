import { NextRequest } from "next/server";
import { discoverDataSources, crossDatasetAnalysis, loadMultipleDatasets } from "@/lib/mcp-discovery";

/**
 * GET /api/discover-sources
 *
 * Scans demo-datasets/ (virtual MCP) or configured MCP endpoint.
 * Returns available data sources with metadata.
 */
export async function GET() {
  try {
    const sources = await discoverDataSources();
    return Response.json({ sources, count: sources.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/discover-sources
 *
 * Accepts { datasetIds: string[] } — runs cross-dataset analysis on selected datasets.
 * Returns cross-dataset hypotheses and correlations.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const datasetIds: string[] = body.datasetIds || [];

    if (datasetIds.length < 2) {
      return Response.json(
        { error: "Select at least 2 datasets for cross-dataset analysis" },
        { status: 400 },
      );
    }

    // Load the selected datasets
    const datasets = await loadMultipleDatasets(datasetIds);

    if (datasets.length < 2) {
      return Response.json(
        { error: "Could not load enough datasets for cross-analysis" },
        { status: 400 },
      );
    }

    // Run cross-dataset analysis
    const analysis = crossDatasetAnalysis(datasets);

    return Response.json({
      datasets: datasets.map((d) => ({
        id: d.id,
        rowCount: d.parsed.rows.length,
        columns: d.parsed.headers,
      })),
      commonColumns: analysis.commonColumns,
      hypotheses: analysis.hypotheses,
      correlations: analysis.correlations,
      statsPreview: datasets.map((d) => ({ id: d.id, stats: d.stats.slice(0, 800) })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
