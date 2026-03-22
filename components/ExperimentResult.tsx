"use client";

/**
 * ExperimentResult
 *
 * Displays results from the Experimenter agent.
 * Each result shows:
 *   - Which hypothesis it tests
 *   - Test name (e.g., "KS test on pre/post weight distributions")
 *   - p-value (color-coded: green < 0.05, yellow < 0.1, red >= 0.1)
 *   - Effect size (Cohen's d)
 *   - Plotly chart (embedded iframe or react-plotly)
 *   - Interpretation (1-2 sentences from Claude)
 *
 * TODO: Wire Plotly charts from E2B sandbox output
 */

import type { ExperimentResultData } from "@/app/page";

interface ExperimentResultProps {
  results: ExperimentResultData[];
}

export default function ExperimentResult({ results }: ExperimentResultProps) {
  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h2 className="text-lg font-semibold mb-4">Experiments</h2>
      {results.length === 0 ? (
        <p className="text-zinc-500 text-sm">No experiments run yet.</p>
      ) : (
        <ul className="space-y-4">
          {results.map((r, i) => (
            <li key={i} className="p-4 rounded-lg border border-zinc-800">
              <p className="font-medium text-sm">{r.testName}</p>
              <div className="flex gap-4 mt-2 text-xs text-zinc-400">
                <span>
                  p ={" "}
                  <span
                    className={
                      r.pValue < 0.05
                        ? "text-green-400"
                        : r.pValue < 0.1
                          ? "text-yellow-400"
                          : "text-red-400"
                    }
                  >
                    {r.pValue.toFixed(4)}
                  </span>
                </span>
                <span>d = {r.effectSize.toFixed(2)}</span>
              </div>
              <p className="text-sm text-zinc-300 mt-2">{r.interpretation}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
