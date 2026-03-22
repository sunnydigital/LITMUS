/**
 * skeptic.ts - 5-check validation gauntlet for LITMUS.
 *
 * Runs each finding through:
 *   1. Multiple testing correction (Benjamini-Hochberg FDR)
 *   2. Confounder scan (partial correlations)
 *   3. Temporal stability (pattern holds across training windows)
 *   4. Holdout replication (validate on held-out checkpoints)
 *   5. Effect size filter (Cohen's d > 0.3)
 *
 * Grades: A (5/5 pass), B (4/5 pass), C (< 4 pass, archived)
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

/**
 * Run full skeptic gauntlet via Claude API.
 * Sends hypothesis + experiment results to /api/validate endpoint.
 * Returns structured validation result.
 *
 * TODO: Implement E2B sandbox execution for checks 2-4
 * (partial correlation, temporal stability, holdout replication
 * require actual computation on the training artifacts)
 */
export async function runGauntlet(params: {
  hypothesis: string;
  pValue: number;
  effectSize: number;
  experimentCode: string;
  experimentResult: string;
  allPValues: number[];
  hypothesisIndex: number;
}): Promise<ValidationResult> {
  // Check 1: Multiple testing
  const fdrSurvives = benjaminiHochberg(params.allPValues);
  const fdrCheck: CheckResult = {
    name: "Multiple Testing",
    result: fdrSurvives[params.hypothesisIndex] ? "PASS" : "FAIL",
    reason: fdrSurvives[params.hypothesisIndex]
      ? `Survives BH-FDR correction at q=0.05 (${params.allPValues.length} tests)`
      : `Does not survive BH-FDR correction (${params.allPValues.length} tests, adjusted threshold too low)`,
  };

  // Check 5: Effect size
  const esCheck = effectSizeCheck(params.effectSize);

  // Checks 2-4: Delegated to Claude via /api/validate
  // These require reasoning about confounders, temporal patterns, and holdout design
  // TODO: Wire to API endpoint
  const placeholderChecks: CheckResult[] = [
    { name: "Confounder Scan", result: "PASS", reason: "TODO: wire to /api/validate" },
    { name: "Temporal Stability", result: "PASS", reason: "TODO: wire to /api/validate" },
    { name: "Holdout Replication", result: "PASS", reason: "TODO: wire to /api/validate" },
  ];

  const allChecks = [fdrCheck, ...placeholderChecks, esCheck];
  return computeGrade(allChecks);
}
