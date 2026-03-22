/**
 * surprise.ts - Surprise score ranking for LITMUS discoveries.
 *
 * discovery_score = surprise x significance x effect_size
 *
 * surprise:     KL divergence from expected distribution
 * significance: -log10(adjusted_p_value)
 * effect_size:  |Cohen's d| or |r|
 *
 * Obvious confirmations get deprioritized even at p < 0.001.
 */

/**
 * KL divergence D_KL(P || Q) for discrete distributions.
 * P = observed, Q = expected (prior).
 * Both must be normalized probability arrays of equal length.
 * Epsilon added to avoid log(0).
 */
export function klDivergence(
  observed: number[],
  expected: number[],
  epsilon: number = 1e-10,
): number {
  if (observed.length !== expected.length) {
    throw new Error("Distributions must have equal length");
  }

  let kl = 0;
  for (let i = 0; i < observed.length; i++) {
    const p = Math.max(observed[i], epsilon);
    const q = Math.max(expected[i], epsilon);
    kl += p * Math.log(p / q);
  }

  return Math.max(kl, 0);
}

/**
 * Significance component: -log10(p_value).
 * Clamped to [0, 10] to avoid infinity at very small p-values.
 */
export function significance(pValue: number): number {
  if (pValue <= 0) return 10;
  return Math.min(-Math.log10(pValue), 10);
}

/**
 * Compute discovery score for a single finding.
 */
export function discoveryScore(params: {
  surpriseKL: number;
  pValue: number;
  effectSize: number;
}): number {
  const sig = significance(params.pValue);
  const effect = Math.abs(params.effectSize);
  return params.surpriseKL * sig * effect;
}

/**
 * Convert a numeric array into a normalized probability distribution
 * using histogram binning. Used by analysis.ts for KL divergence computation.
 */
export function distributionFromValues(values: number[], bins: number = 10): number[] {
  const valid = values.filter((v) => !isNaN(v) && isFinite(v));
  if (valid.length === 0) return new Array(bins).fill(1 / bins);

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min;

  // If all values are the same, uniform distribution
  if (range < 1e-10) {
    const dist = new Array(bins).fill(0);
    dist[0] = 1;
    return dist;
  }

  const counts = new Array(bins).fill(0);
  for (const v of valid) {
    const binIdx = Math.min(bins - 1, Math.floor(((v - min) / range) * bins));
    counts[binIdx]++;
  }

  // Normalize to probability distribution
  const total = valid.length;
  return counts.map((c) => c / total);
}

/**
 * Rank findings by discovery score descending.
 */
export function rankFindings<T extends { surpriseKL: number; pValue: number; effectSize: number }>(
  findings: T[],
): (T & { discoveryScore: number; rank: number })[] {
  const scored = findings.map((f) => ({
    ...f,
    discoveryScore: discoveryScore(f),
    rank: 0,
  }));

  scored.sort((a, b) => b.discoveryScore - a.discoveryScore);
  scored.forEach((f, i) => {
    f.rank = i + 1;
  });

  return scored;
}
