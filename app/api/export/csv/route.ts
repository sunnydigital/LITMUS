import { NextRequest } from "next/server";

/**
 * POST /api/export/csv
 *
 * Accepts findings JSON and returns a downloadable CSV file.
 * Columns: Rank, Finding, Grade, Surprise Score, P-Value, Effect Size, Checks Passed, Checks Failed, Interpretation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const findings: Array<{
      hypothesis: string;
      grade: string;
      surprise_score: number;
      p_value: number;
      effect_size: number;
      checks: Array<{ name: string; result: string; reason: string }>;
      interpretation: string;
    }> = body.findings || [];

    if (!findings.length) {
      return new Response(JSON.stringify({ error: "No findings provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Sort by surprise score descending (best first)
    const sorted = [...findings].sort((a, b) => (b.surprise_score ?? 0) - (a.surprise_score ?? 0));

    // CSV header
    const headers = [
      "Rank",
      "Finding",
      "Grade",
      "Surprise Score",
      "P-Value",
      "Effect Size",
      "Checks Passed",
      "Checks Failed",
      "Interpretation",
    ];

    function escapeCsv(val: string | number | null | undefined): string {
      const str = String(val ?? "");
      // Escape quotes and wrap in quotes if needed
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const rows = sorted.map((f, i) => {
      const passed = (f.checks || []).filter((c) => c.result === "PASS").map((c) => c.name).join("; ");
      const failed = (f.checks || []).filter((c) => c.result === "FAIL").map((c) => c.name).join("; ");
      return [
        escapeCsv(i + 1),
        escapeCsv(f.hypothesis),
        escapeCsv(f.grade),
        escapeCsv(f.surprise_score?.toFixed(3)),
        escapeCsv(f.p_value?.toFixed(4)),
        escapeCsv(f.effect_size?.toFixed(3)),
        escapeCsv(passed),
        escapeCsv(failed),
        escapeCsv(f.interpretation),
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `litmus-findings-${timestamp}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
