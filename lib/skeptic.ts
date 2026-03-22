/**
 * skeptic.ts - Validation utilities for LITMUS.
 *
 * Local checks:
 *   1. Multiple testing correction (Benjamini-Hochberg FDR)
 *   5. Effect size filter (Cohen's d > 0.3)
 *
 * Checks 2-4 (confounder, temporal, holdout) delegated to Claude
 * via the skeptic prompt in the discover route.
 *
 * Grades: A (5/5 pass), B (4/5 pass), C (< 4 pass)
 */

export interface CheckResult {
  name: string;
  result: "PASS" | "FAIL";
  reason: string;
}

export interface ValidationResult {
  checks: CheckResult[];
  grade: "A" | "B" | "C";
  passCount: number;
}

/**
 * Benjamini-Hochberg FDR correction.
 * Given a list of p-values and a target FDR (default 0.05),
 * returns which hypotheses survive correction.
 */
export function benjaminiHochberg(
  pValues: number[],
  fdr: number = 0.05,
): boolean[] {
  const n = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);

  const thresholds = indexed.map((_, rank) => ((rank + 1) / n) * fdr);
  let maxPassingRank = -1;

  for (let k = 0; k < n; k++) {
    if (indexed[k].p <= thresholds[k]) {
      maxPassingRank = k;
    }
  }

  const survives = new Array(n).fill(false);
  if (maxPassingRank >= 0) {
    for (let k = 0; k <= maxPassingRank; k++) {
      survives[indexed[k].i] = true;
    }
  }

  return survives;
}

/**
 * Check if effect size exceeds minimum threshold.
 * Cohen's d thresholds: small (0.2), medium (0.5), large (0.8).
 * We require d > 0.3 (between small and medium).
 */
export function effectSizeCheck(cohenD: number): CheckResult {
  const pass = Math.abs(cohenD) > 0.3;
  return {
    name: "Effect Size",
    result: pass ? "PASS" : "FAIL",
    reason: pass
      ? `Cohen's d = ${cohenD.toFixed(2)} exceeds threshold (0.3)`
      : `Cohen's d = ${cohenD.toFixed(2)} below threshold (0.3), not practically meaningful`,
  };
}

/**
 * Compute validation grade from check results.
 */
export function computeGrade(checks: CheckResult[]): ValidationResult {
  const passCount = checks.filter((c) => c.result === "PASS").length;
  const grade = passCount >= 5 ? "A" : passCount >= 4 ? "B" : "C";
  return { checks, grade, passCount };
}
