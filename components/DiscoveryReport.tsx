"use client";

/**
 * DiscoveryReport
 *
 * Final narrated output from the Narrator agent.
 * Renders markdown with embedded Plotly charts.
 * Each finding shows:
 *   - Discovery title
 *   - Narrated explanation (plain English)
 *   - Cited evidence (experiment IDs, p-values, effect sizes)
 *   - Confidence grade (A/B/C badge)
 *   - Surprise score ranking
 *   - Interactive visualization
 *
 * TODO: Markdown renderer + Plotly embed
 * TODO: Google Sheets push button
 */

interface DiscoveryReportProps {
  report: string;
}

export default function DiscoveryReport({ report }: DiscoveryReportProps) {
  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h2 className="text-lg font-semibold mb-4">Discovery Report</h2>
      {report ? (
        <div className="prose prose-invert prose-sm max-w-none">
          {/* TODO: Replace with proper markdown renderer */}
          <pre className="whitespace-pre-wrap text-sm text-zinc-300">
            {report}
          </pre>
        </div>
      ) : (
        <p className="text-zinc-500 text-sm">
          Report will appear after validation.
        </p>
      )}
    </div>
  );
}
