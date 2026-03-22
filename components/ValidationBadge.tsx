"use client";

/**
 * ValidationBadge
 *
 * Shows the Skeptic Gauntlet results for each validated hypothesis.
 * 5 checks displayed as pass/fail badges:
 *   1. Multiple testing (BH-FDR)
 *   2. Confounder scan (partial correlations)
 *   3. Temporal stability (pattern holds across training windows)
 *   4. Holdout replication (validate on held-out weight snapshots)
 *   5. Effect size filter (Cohen's d > 0.3)
 *
 * Grade computed: A (5/5), B (4/5), C (failed)
 */

import type { Hypothesis } from "@/app/page";

const CHECKS = [
  "Multiple Testing",
  "Confounder Scan",
  "Temporal Stability",
  "Holdout Replication",
  "Effect Size",
] as const;

interface ValidationBadgeProps {
  hypotheses: Hypothesis[];
}

export default function ValidationBadge({ hypotheses }: ValidationBadgeProps) {
  const validated = hypotheses.filter(
    (h) => h.status === "validated" || h.status === "rejected",
  );

  if (validated.length === 0) return null;

  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h2 className="text-lg font-semibold mb-4">Skeptic Gauntlet</h2>
      {/* TODO: Wire actual check results from /api/validate */}
      <div className="flex gap-2 flex-wrap">
        {CHECKS.map((check) => (
          <span
            key={check}
            className="text-xs px-3 py-1 rounded-full border border-zinc-700 text-zinc-400"
          >
            {check}
          </span>
        ))}
      </div>
    </div>
  );
}
