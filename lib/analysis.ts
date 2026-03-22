/**
 * analysis.ts - Statistical analysis functions for LITMUS.
 *
 * Pure TypeScript implementations of common statistical tests.
 * No external dependencies — runs in Next.js Edge/Node runtime.
 */

import { klDivergence, distributionFromValues } from "@/lib/surprise";

// ---- Types ----

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string | number>[];
  numericColumns: Record<string, number[]>;
  categoricalColumns: Record<string, string[]>;
}

export interface ChangepointResult {
  indices: number[];
  ratios: number[];
}

export interface AnomalyResult {
  indices: number[];
  zScores: number[];
}

export interface CorrelationResult {
  r: number;
  pValue: number;
  n: number;
}

export interface TTestResult {
  tStat: number;
  pValue: number;
  cohensD: number;
  meanA: number;
  meanB: number;
}

export interface ChiSquareResult {
  chiSq: number;
  pValue: number;
  df: number;
}

export interface SimpsonsParadoxResult {
  overallDiff: number;
  strataDiffs: Record<string, number>;
  paradoxDetected: boolean;
  description: string;
}

export interface ChartData {
  type: "bar" | "grouped-bar" | "line" | "forest";
  title: string;
  data: Record<string, unknown>[];
  config: Record<string, unknown>;
}

// ---- CSV Parser ----

/**
 * Parse CSV text into typed columns.
 * Numbers are auto-detected; everything else stays as string.
 */
export function parseCSV(text: string): ParsedCSV {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], numericColumns: {}, categoricalColumns: {} };
  }

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  const rows: Record<string, string | number>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const row: Record<string, string | number> = {};
    headers.forEach((h, idx) => {
      const cell = (cells[idx] || "").trim().replace(/^"|"$/g, "");
      const num = Number(cell);
      row[h] = cell === "" ? "" : isNaN(num) ? cell : num;
    });
    rows.push(row);
  }

  const numericColumns: Record<string, number[]> = {};
  const categoricalColumns: Record<string, string[]> = {};

  for (const h of headers) {
    const vals = rows.map((r) => r[h]);
    const nums = vals.filter((v) => typeof v === "number") as number[];
    if (nums.length > rows.length * 0.5) {
      // Majority numeric → numeric column
      numericColumns[h] = rows.map((r) =>
        typeof r[h] === "number" ? (r[h] as number) : NaN,
      );
    } else {
      categoricalColumns[h] = vals.map((v) => String(v));
    }
  }

  return { headers, rows, numericColumns, categoricalColumns };
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ---- Statistical Helpers ----

function mean(arr: number[]): number {
  const valid = arr.filter((x) => !isNaN(x));
  if (valid.length === 0) return NaN;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function variance(arr: number[], ddof = 1): number {
  const valid = arr.filter((x) => !isNaN(x));
  if (valid.length <= ddof) return NaN;
  const m = mean(valid);
  return valid.reduce((sum, x) => sum + (x - m) ** 2, 0) / (valid.length - ddof);
}

function stdDev(arr: number[], ddof = 1): number {
  return Math.sqrt(variance(arr, ddof));
}

/**
 * Regularized incomplete beta function approximation (for t-distribution p-values).
 * Uses continued fraction expansion.
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use symmetry relation if needed
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a);
  }

  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = (Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta)) / a;

  // Lentz's continued fraction
  let f = 1;
  let C = 1;
  let D = 1 - ((a + b) * x) / (a + 1);
  D = D === 0 ? 1e-30 : 1 / D;
  f = D;

  for (let m = 1; m <= 200; m++) {
    // Even step
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    D = 1 + numerator * D;
    C = 1 + numerator / C;
    D = D === 0 ? 1e-30 : 1 / D;
    C = C === 0 ? 1e-30 : C;
    f *= C * D;

    // Odd step
    numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    D = 1 + numerator * D;
    C = 1 + numerator / C;
    D = D === 0 ? 1e-30 : 1 / D;
    C = C === 0 ? 1e-30 : C;
    const delta = C * D;
    f *= delta;

    if (Math.abs(delta - 1) < 1e-10) break;
  }

  return front * f;
}

function lgamma(x: number): number {
  // Lanczos approximation
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }

  x -= 1;
  let a = p[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) {
    a += p[i] / (x + i);
  }

  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Two-tailed p-value from t-distribution with `df` degrees of freedom.
 */
function tDistPValue(t: number, df: number): number {
  const x = df / (df + t * t);
  const p = incompleteBeta(x, df / 2, 0.5);
  return Math.min(1, p);
}

/**
 * Chi-square CDF p-value (upper tail).
 */
function chiSquarePValue(chiSq: number, df: number): number {
  if (chiSq <= 0) return 1;
  // Use regularized gamma function approximation
  return 1 - regularizedGammaP(df / 2, chiSq / 2);
}

function regularizedGammaP(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;
  if (x < a + 1) {
    // Series representation
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n <= 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  } else {
    // Continued fraction representation
    let f = 1;
    let C = 1;
    let D = 1 - (x - a - 1) / (x + 1);
    D = D === 0 ? 1e-30 : 1 / D;
    f = D;
    for (let i = 1; i <= 200; i++) {
      const an = i * (a - i);
      D = an * D + (x + 2 * i + 1 - a);
      D = D === 0 ? 1e-30 : 1 / D;
      C = (x + 2 * i + 1 - a) + an / C;
      C = C === 0 ? 1e-30 : C;
      const delta = C * D;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-10) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) / (x * f);
  }
}

// ---- Public Analysis Functions ----

/**
 * Sliding window std dev ratio changepoint detection.
 * Returns indices where adjacent windows diverge significantly.
 */
export function detectChangepoints(
  series: number[],
  threshold = 2.0,
): ChangepointResult {
  const valid = series.filter((x) => !isNaN(x));
  if (valid.length < 10) return { indices: [], ratios: [] };

  const windowSize = Math.max(3, Math.floor(valid.length / 10));
  const indices: number[] = [];
  const ratios: number[] = [];

  for (let i = windowSize; i < valid.length - windowSize; i++) {
    const left = valid.slice(i - windowSize, i);
    const right = valid.slice(i, i + windowSize);
    const sdLeft = stdDev(left, 1);
    const sdRight = stdDev(right, 1);

    const ratio = Math.max(sdLeft, sdRight) / (Math.min(sdLeft, sdRight) + 1e-10);
    const meanLeft = mean(left);
    const meanRight = mean(right);
    const pooledSD = Math.sqrt((variance(left, 1) + variance(right, 1)) / 2);
    const meanShift = Math.abs(meanRight - meanLeft) / (pooledSD + 1e-10);

    if (ratio > threshold || meanShift > threshold) {
      indices.push(i);
      ratios.push(Math.max(ratio, meanShift));
    }
  }

  // Merge nearby changepoints (within windowSize)
  const merged: number[] = [];
  const mergedRatios: number[] = [];
  let lastIdx = -Infinity;
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] - lastIdx > windowSize) {
      merged.push(indices[i]);
      mergedRatios.push(ratios[i]);
      lastIdx = indices[i];
    }
  }

  return { indices: merged, ratios: mergedRatios };
}

/**
 * Rolling z-score anomaly detection.
 * Flags points where |z| > 2.5 relative to local window.
 */
export function zScoreAnomalies(series: number[], window = 20): AnomalyResult {
  const indices: number[] = [];
  const zScores: number[] = [];

  for (let i = 0; i < series.length; i++) {
    if (isNaN(series[i])) continue;
    const start = Math.max(0, i - window);
    const end = Math.min(series.length, i + window + 1);
    const localWindow = series.slice(start, end).filter((x) => !isNaN(x));
    if (localWindow.length < 3) continue;

    const m = mean(localWindow);
    const sd = stdDev(localWindow, 1);
    if (sd < 1e-10) continue;

    const z = (series[i] - m) / sd;
    if (Math.abs(z) > 2.5) {
      indices.push(i);
      zScores.push(z);
    }
  }

  return { indices, zScores };
}

/**
 * Shannon entropy of a discrete distribution.
 * Input: array of counts or probabilities.
 */
export function computeEntropy(distribution: number[]): number {
  const total = distribution.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  return -distribution
    .filter((x) => x > 0)
    .map((x) => {
      const p = x / total;
      return p * Math.log2(p);
    })
    .reduce((a, b) => a + b, 0);
}

/**
 * Pearson correlation with two-tailed p-value.
 */
export function pearsonCorrelation(x: number[], y: number[]): CorrelationResult {
  const pairs = x
    .map((xi, i) => [xi, y[i]])
    .filter(([a, b]) => !isNaN(a) && !isNaN(b));

  const n = pairs.length;
  if (n < 3) return { r: 0, pValue: 1, n };

  const xs = pairs.map(([a]) => a);
  const ys = pairs.map(([, b]) => b);
  const mx = mean(xs);
  const my = mean(ys);

  let num = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    sx += dx * dx;
    sy += dy * dy;
  }

  const denom = Math.sqrt(sx * sy);
  const r = denom < 1e-10 ? 0 : num / denom;
  const clampedR = Math.max(-1, Math.min(1, r));

  // t-statistic for correlation
  const tStat = (clampedR * Math.sqrt(n - 2)) / Math.sqrt(1 - clampedR ** 2 + 1e-15);
  const pValue = tDistPValue(Math.abs(tStat), n - 2);

  return { r: clampedR, pValue, n };
}

/**
 * Welch's two-sample t-test.
 * Returns t-statistic, two-tailed p-value, and Cohen's d.
 */
export function twoSampleTTest(a: number[], b: number[]): TTestResult {
  const va = a.filter((x) => !isNaN(x));
  const vb = b.filter((x) => !isNaN(x));

  const na = va.length;
  const nb = vb.length;

  if (na < 2 || nb < 2) {
    return { tStat: 0, pValue: 1, cohensD: 0, meanA: mean(va), meanB: mean(vb) };
  }

  const ma = mean(va);
  const mb = mean(vb);
  const varA = variance(va, 1);
  const varB = variance(vb, 1);

  const se = Math.sqrt(varA / na + varB / nb);
  if (se < 1e-10) return { tStat: 0, pValue: 1, cohensD: 0, meanA: ma, meanB: mb };

  const tStat = (ma - mb) / se;

  // Welch-Satterthwaite degrees of freedom
  const df = (varA / na + varB / nb) ** 2 / (varA ** 2 / (na ** 2 * (na - 1)) + varB ** 2 / (nb ** 2 * (nb - 1)));

  const pValue = tDistPValue(Math.abs(tStat), df);

  // Cohen's d (pooled SD)
  const pooledSD = Math.sqrt(((na - 1) * varA + (nb - 1) * varB) / (na + nb - 2));
  const cohensD = pooledSD < 1e-10 ? 0 : (ma - mb) / pooledSD;

  return { tStat, pValue, cohensD, meanA: ma, meanB: mb };
}

/**
 * Chi-square goodness-of-fit test.
 */
export function chiSquareTest(observed: number[], expected: number[]): ChiSquareResult {
  if (observed.length !== expected.length || observed.length === 0) {
    return { chiSq: 0, pValue: 1, df: 0 };
  }

  const totalObs = observed.reduce((a, b) => a + b, 0);
  const totalExp = expected.reduce((a, b) => a + b, 0);

  let chiSq = 0;
  for (let i = 0; i < observed.length; i++) {
    const e = (expected[i] / totalExp) * totalObs;
    if (e > 0) {
      chiSq += (observed[i] - e) ** 2 / e;
    }
  }

  const df = observed.length - 1;
  const pValue = chiSquarePValue(chiSq, df);

  return { chiSq, pValue, df };
}

/**
 * Simpson's Paradox detection.
 * Checks if the overall trend between outcomeCol and treatmentCol
 * reverses when stratified by stratifyCol.
 */
export function detectSimpsonsParadox(
  data: ParsedCSV,
  outcomeCol: string,
  treatmentCol: string,
  stratifyCol: string,
): SimpsonsParadoxResult {
  const rows = data.rows;

  // Get unique treatment values
  const treatments = [...new Set(rows.map((r) => String(r[treatmentCol])))];
  if (treatments.length < 2) {
    return {
      overallDiff: 0,
      strataDiffs: {},
      paradoxDetected: false,
      description: "Need at least 2 treatment groups",
    };
  }

  const tA = treatments[0];
  const tB = treatments[1];

  function outcomeMean(subset: typeof rows): number {
    const vals = subset
      .map((r) => Number(r[outcomeCol]))
      .filter((v) => !isNaN(v));
    return vals.length === 0 ? NaN : mean(vals);
  }

  // Overall difference
  const groupA = rows.filter((r) => String(r[treatmentCol]) === tA);
  const groupB = rows.filter((r) => String(r[treatmentCol]) === tB);
  const overallDiff = outcomeMean(groupB) - outcomeMean(groupA);

  // Strata differences
  const strata = [...new Set(rows.map((r) => String(r[stratifyCol])))];
  const strataDiffs: Record<string, number> = {};

  for (const stratum of strata) {
    const stratumA = rows.filter(
      (r) => String(r[stratifyCol]) === stratum && String(r[treatmentCol]) === tA,
    );
    const stratumB = rows.filter(
      (r) => String(r[stratifyCol]) === stratum && String(r[treatmentCol]) === tB,
    );
    if (stratumA.length > 0 && stratumB.length > 0) {
      strataDiffs[stratum] = outcomeMean(stratumB) - outcomeMean(stratumA);
    }
  }

  // Simpson's paradox: overall direction is opposite to ALL strata directions
  const strataValues = Object.values(strataDiffs);
  const paradoxDetected =
    strataValues.length > 0 &&
    strataValues.every((d) => Math.sign(d) === -Math.sign(overallDiff) && !isNaN(d));

  const direction = overallDiff > 0 ? "positive" : "negative";
  const strataDirection = strataValues[0] > 0 ? "positive" : "negative";
  const description = paradoxDetected
    ? `Simpson's paradox detected! Overall ${tB} vs ${tA} difference is ${direction} (${overallDiff.toFixed(3)}), but within every stratum of ${stratifyCol}, the difference is ${strataDirection}.`
    : `No clear paradox. Overall difference: ${overallDiff.toFixed(3)}.`;

  return { overallDiff, strataDiffs, paradoxDetected, description };
}

/**
 * Compute KL-divergence-based surprise scores for each detected finding.
 * Returns a map of description → surprise value in [0, 1].
 */
export function computeSurpriseScores(parsed: ParsedCSV): Record<string, number> {
  const rawScores: Record<string, number> = {};

  const numCols = Object.keys(parsed.numericColumns);
  const catCols = Object.keys(parsed.categoricalColumns);

  // --- Group comparison surprises (t-tests) ---
  const treatmentCols = catCols.filter((col) => {
    const uniq = [...new Set(parsed.categoricalColumns[col].filter((v) => v && v !== "NaN"))];
    return uniq.length >= 2 && uniq.length <= 5;
  });

  for (const catCol of treatmentCols) {
    const groups = [...new Set(parsed.categoricalColumns[catCol])].filter(
      (v) => v && v !== "NaN",
    );
    if (groups.length < 2) continue;

    for (const numCol of numCols) {
      for (let gi = 0; gi < groups.length; gi++) {
        for (let gj = gi + 1; gj < groups.length; gj++) {
          const gA = groups[gi];
          const gB = groups[gj];
          const valA = parsed.rows
            .filter((r) => String(r[catCol]) === gA)
            .map((r) => Number(r[numCol]))
            .filter((v) => !isNaN(v));
          const valB = parsed.rows
            .filter((r) => String(r[catCol]) === gB)
            .map((r) => Number(r[numCol]))
            .filter((v) => !isNaN(v));

          if (valA.length < 5 || valB.length < 5) continue;

          // Compute histograms over combined range
          const allVals = [...valA, ...valB];
          const minV = Math.min(...allVals);
          const maxV = Math.max(...allVals);
          const range = maxV - minV;
          if (range < 1e-10) continue;

          const BINS = 10;
          const distA = distributionFromValues(valA, BINS);
          const distB = distributionFromValues(valB, BINS);

          const kl = (klDivergence(distA, distB) + klDivergence(distB, distA)) / 2; // symmetric KL
          const key = `${catCol} ${gA} vs ${gB} on ${numCol}`;
          rawScores[key] = kl;
        }
      }
    }
  }

  // --- Correlation surprises ---
  if (numCols.length >= 2) {
    const allCorrs: number[] = [];
    for (let i = 0; i < numCols.length && i < 10; i++) {
      for (let j = i + 1; j < numCols.length && j < 10; j++) {
        const c = pearsonCorrelation(
          parsed.numericColumns[numCols[i]],
          parsed.numericColumns[numCols[j]],
        );
        if (!isNaN(c.r)) allCorrs.push(Math.abs(c.r));
      }
    }
    const medianCorr =
      allCorrs.length > 0
        ? allCorrs.sort((a, b) => a - b)[Math.floor(allCorrs.length / 2)]
        : 0.3;

    for (let i = 0; i < numCols.length && i < 10; i++) {
      for (let j = i + 1; j < numCols.length && j < 10; j++) {
        const c = pearsonCorrelation(
          parsed.numericColumns[numCols[i]],
          parsed.numericColumns[numCols[j]],
        );
        if (isNaN(c.r) || c.pValue >= 0.05) continue;
        // Surprise = how much higher than median correlation
        const excess = Math.max(0, Math.abs(c.r) - medianCorr);
        const kl = excess * 3; // scale so excess of 0.33 → KL~1
        const key = `correlation ${numCols[i]} vs ${numCols[j]}`;
        rawScores[key] = kl;
      }
    }
  }

  // --- Simpson's Paradox surprises ---
  const binaryNumCols = numCols.filter((col) => {
    const vals = parsed.numericColumns[col].filter((v) => !isNaN(v));
    const uniq = [...new Set(vals)];
    return uniq.length === 2 && uniq.every((v) => v === 0 || v === 1);
  });

  const treatmentCatCols = catCols.filter((col) => {
    const uniq = [...new Set(parsed.categoricalColumns[col].filter((v) => v && v !== "NaN"))];
    return uniq.length >= 2 && uniq.length <= 3;
  });
  const stratifierCatCols = catCols.filter((col) => {
    const uniq = [...new Set(parsed.categoricalColumns[col].filter((v) => v && v !== "NaN"))];
    return uniq.length >= 2 && uniq.length <= 10;
  });

  for (const outCol of binaryNumCols) {
    for (const treatCol of treatmentCatCols) {
      for (const stratCol of stratifierCatCols) {
        if (stratCol === treatCol) continue;

        const result = detectSimpsonsParadox(parsed, outCol, treatCol, stratCol);
        if (result.paradoxDetected) {
          // Compute KL between overall distribution and stratum-weighted distribution
          const treatments = [...new Set(parsed.rows.map((r) => String(r[treatCol])))].filter(
            (v) => v && v !== "NaN",
          );
          const strata = [...new Set(parsed.rows.map((r) => String(r[stratCol])))].filter(
            (v) => v && v !== "NaN",
          );

          const overallRates = treatments.map((t) => {
            const subset = parsed.rows.filter((r) => String(r[treatCol]) === t);
            const vals = subset.map((r) => Number(r[outCol])).filter((v) => !isNaN(v));
            return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          });

          // Weighted average of stratum rates
          const weightedRates = treatments.map((t) => {
            let totalWeightedRate = 0;
            let totalWeight = 0;
            for (const stratum of strata) {
              const subset = parsed.rows.filter(
                (r) => String(r[treatCol]) === t && String(r[stratCol]) === stratum,
              );
              if (subset.length > 0) {
                const vals = subset.map((r) => Number(r[outCol])).filter((v) => !isNaN(v));
                const rate = vals.reduce((a, b) => a + b, 0) / vals.length;
                totalWeightedRate += rate * subset.length;
                totalWeight += subset.length;
              }
            }
            return totalWeight > 0 ? totalWeightedRate / totalWeight : 0;
          });

          const totalOvR = overallRates.reduce((a, b) => a + b, 0) || 1;
          const totalWR = weightedRates.reduce((a, b) => a + b, 0) || 1;
          const normOvR = overallRates.map((r) => r / totalOvR);
          const normWR = weightedRates.map((r) => r / totalWR);

          const kl = klDivergence(normOvR, normWR);
          // Paradox gets a minimum of 0.8 surprise
          const key = `Simpson's Paradox (${outCol} × ${treatCol} × ${stratCol})`;
          rawScores[key] = Math.max(kl + 1.5, 2.0); // ensure high surprise
        }
      }
    }
  }

  // --- Changepoint surprises ---
  for (const col of numCols) {
    const vals = parsed.numericColumns[col];
    const cp = detectChangepoints(vals, 2.0);
    if (cp.indices.length > 0) {
      // Compute KL between pre and post first changepoint
      const cpIdx = cp.indices[0];
      const preSeg = vals.slice(0, cpIdx).filter((v) => !isNaN(v));
      const postSeg = vals.slice(cpIdx).filter((v) => !isNaN(v));
      if (preSeg.length >= 5 && postSeg.length >= 5) {
        const distPre = distributionFromValues(preSeg, 10);
        const distPost = distributionFromValues(postSeg, 10);
        const kl = (klDivergence(distPre, distPost) + klDivergence(distPost, distPre)) / 2;
        const key = `changepoint in ${col}`;
        rawScores[key] = kl;
      }
    }
  }

  // --- Normalize all scores to [0, 1] ---
  const rawValues = Object.values(rawScores);
  if (rawValues.length === 0) return {};

  const maxKL = Math.max(...rawValues, 1e-10);
  const result: Record<string, number> = {};
  for (const [key, kl] of Object.entries(rawScores)) {
    // sigmoid-like normalization: min(1, kl / maxKL)
    result[key] = Math.min(1, kl / maxKL);
  }

  return result;
}

/**
 * Generate chart data for relevant visualizations based on parsed CSV.
 * Returns an array of ChartData objects for rendering.
 */
export function generateChartData(parsed: ParsedCSV): ChartData[] {
  const charts: ChartData[] = [];
  const numCols = Object.keys(parsed.numericColumns);
  const catCols = Object.keys(parsed.categoricalColumns);

  // --- Detect dataset type ---

  // Check for treatment/group + outcome (Simpson's Paradox style)
  const treatmentCols = catCols.filter((col) => {
    const uniq = [...new Set(parsed.categoricalColumns[col].filter((v) => v && v !== "NaN"))];
    return uniq.length >= 2 && uniq.length <= 5;
  });

  const binaryNumCols = numCols.filter((col) => {
    const vals = parsed.numericColumns[col].filter((v) => !isNaN(v));
    const uniq = [...new Set(vals)];
    return uniq.length === 2 && uniq.every((v) => v === 0 || v === 1);
  });

  // --- Grouped bar chart for treatment × stratifier × outcome ---
  if (binaryNumCols.length > 0 && treatmentCols.length >= 2) {
    const outCol = binaryNumCols[0];
    const treatCol = treatmentCols[0];
    const stratCol = treatmentCols.find((c) => c !== treatCol);

    if (stratCol) {
      const treatments = [...new Set(parsed.categoricalColumns[treatCol].filter((v) => v && v !== "NaN"))];
      const strata = [...new Set(parsed.categoricalColumns[stratCol].filter((v) => v && v !== "NaN"))];

      // Overall rates
      const chartDataPoints: Record<string, unknown>[] = [];

      // Overall segment
      const overallPoint: Record<string, unknown> = { segment: "Overall" };
      for (const t of treatments) {
        const subset = parsed.rows
          .filter((r) => String(r[treatCol]) === t)
          .map((r) => Number(r[outCol]))
          .filter((v) => !isNaN(v));
        overallPoint[t] = subset.length > 0 ? Math.round((subset.reduce((a, b) => a + b, 0) / subset.length) * 1000) / 1000 : 0;
      }
      chartDataPoints.push(overallPoint);

      // Per-stratum
      for (const stratum of strata) {
        const point: Record<string, unknown> = { segment: stratum };
        for (const t of treatments) {
          const subset = parsed.rows
            .filter((r) => String(r[treatCol]) === t && String(r[stratCol]) === stratum)
            .map((r) => Number(r[outCol]))
            .filter((v) => !isNaN(v));
          point[t] = subset.length > 0 ? Math.round((subset.reduce((a, b) => a + b, 0) / subset.length) * 1000) / 1000 : 0;
        }
        chartDataPoints.push(point);
      }

      charts.push({
        type: "grouped-bar",
        title: `Conversion Rate: ${treatCol} vs ${stratCol}`,
        data: chartDataPoints,
        config: {
          keys: treatments,
          xKey: "segment",
          xLabel: stratCol,
          yLabel: `${outCol} rate`,
        },
      });
    }
  }

  // --- Line chart for time-series data ---
  // Look for a time column (day, month, week, date, time, period)
  const timeColNames = ["day", "month", "week", "date", "time", "period", "timestamp"];
  const timeCol =
    numCols.find((c) => timeColNames.some((t) => c.toLowerCase().includes(t))) ||
    catCols.find((c) => timeColNames.some((t) => c.toLowerCase().includes(t)));

  if (timeCol) {
    // Find primary metrics to chart (exclude the time column itself)
    const metricsToChart = numCols.filter((c) => c !== timeCol).slice(0, 4);

    for (const metricCol of metricsToChart) {
      const vals = parsed.numericColumns[metricCol];
      const cp = detectChangepoints(vals, 2.0);
      const anomalies = zScoreAnomalies(vals, 20);

      const timeVals = parsed.numericColumns[timeCol] || [];
      const chartDataPoints = parsed.rows.map((row, idx) => {
        const point: Record<string, unknown> = {
          x: timeVals[idx] ?? idx,
          value: Number(row[metricCol]),
          isAnomaly: anomalies.indices.includes(idx),
        };
        return point;
      });

      charts.push({
        type: "line",
        title: `${metricCol} over time`,
        data: chartDataPoints,
        config: {
          xKey: "x",
          valueKey: "value",
          xLabel: timeCol,
          yLabel: metricCol,
          changepoints: cp.indices,
          anomalyKey: "isAnomaly",
        },
      });
    }
  }

  // --- Forest plot / horizontal bar for multi-endpoint (clinical trial style) ---
  // Detect if we have a "group" column with treatment/placebo and multiple outcome columns
  const groupCol = catCols.find((c) => {
    const uniq = [...new Set(parsed.categoricalColumns[c].filter((v) => v && v !== "NaN"))];
    return uniq.length === 2;
  });

  if (groupCol && !timeCol && numCols.length >= 4) {
    const groups = [...new Set(parsed.categoricalColumns[groupCol].filter((v) => v && v !== "NaN"))];
    if (groups.length === 2) {
      const [gA, gB] = groups;
      const effectSizes: Record<string, unknown>[] = [];

      for (const numCol of numCols) {
        const valA = parsed.rows
          .filter((r) => String(r[groupCol]) === gA)
          .map((r) => Number(r[numCol]))
          .filter((v) => !isNaN(v));
        const valB = parsed.rows
          .filter((r) => String(r[groupCol]) === gB)
          .map((r) => Number(r[numCol]))
          .filter((v) => !isNaN(v));

        if (valA.length < 3 || valB.length < 3) continue;

        const t = twoSampleTTest(valA, valB);
        const isSignificant = t.pValue < 0.05;
        const isTiny = Math.abs(t.cohensD) < 0.1;

        effectSizes.push({
          endpoint: numCol,
          cohensD: Math.round(t.cohensD * 1000) / 1000,
          pValue: Math.round(t.pValue * 10000) / 10000,
          significant: isSignificant,
          tiny: isTiny,
          color: isSignificant && !isTiny ? "green" : isTiny && isSignificant ? "red" : "gray",
        });
      }

      if (effectSizes.length >= 3) {
        charts.push({
          type: "forest",
          title: `Effect Sizes by Endpoint (${gA} vs ${gB})`,
          data: effectSizes,
          config: {
            xKey: "cohensD",
            yKey: "endpoint",
            colorKey: "color",
            pValueKey: "pValue",
          },
        });
      }
    }
  }

  return charts;
}

/**
 * Run a full statistical analysis suite on parsed CSV data.
 * Returns a summary string suitable for passing to Claude.
 */
export function runAnalysisSuite(parsed: ParsedCSV): string {
  const lines: string[] = [];
  const numCols = Object.keys(parsed.numericColumns);
  const catCols = Object.keys(parsed.categoricalColumns);

  lines.push(`=== COMPUTED STATISTICS (from actual data) ===`);
  lines.push(`Rows: ${parsed.rows.length}, Numeric columns: ${numCols.length}, Categorical columns: ${catCols.length}`);
  lines.push(`Column names: ${parsed.headers.join(", ")}`);
  lines.push(``);

  // Per-column stats
  for (const col of numCols.slice(0, 15)) {
    const vals = parsed.numericColumns[col].filter((v) => !isNaN(v));
    if (vals.length === 0) continue;
    const m = mean(vals);
    const sd = stdDev(vals, 1);
    const sorted = [...vals].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];

    // Detect if column is binary (0/1)
    const uniqueVals = [...new Set(vals)];
    const isBinary = uniqueVals.length === 2 && uniqueVals.every(v => v === 0 || v === 1);
    const typeNote = isBinary ? " [binary 0/1]" : "";

    lines.push(
      `Column "${col}"${typeNote}: n=${vals.length}, mean=${m.toFixed(4)}, sd=${sd.toFixed(4)}, median=${median.toFixed(4)}, min=${min.toFixed(4)}, max=${max.toFixed(4)}`,
    );

    // Changepoints
    const cp = detectChangepoints(vals, 2.0);
    if (cp.indices.length > 0) {
      lines.push(
        `  Changepoints at rows: ${cp.indices.slice(0, 5).join(", ")} (ratio: ${cp.ratios.slice(0, 5).map((r) => r.toFixed(2)).join(", ")})`,
      );
    }

    // Anomalies
    const anom = zScoreAnomalies(vals, 20);
    if (anom.indices.length > 0) {
      lines.push(
        `  Z-score anomalies at rows: ${anom.indices.slice(0, 5).join(", ")} (z: ${anom.zScores.slice(0, 5).map((z) => z.toFixed(2)).join(", ")})`,
      );
    }
  }

  lines.push(``);

  // Categorical column summaries
  if (catCols.length > 0) {
    lines.push(`--- Categorical Column Summaries ---`);
    for (const col of catCols) {
      const vals = parsed.categoricalColumns[col];
      const counts: Record<string, number> = {};
      for (const v of vals) {
        if (v && v !== "NaN") counts[v] = (counts[v] || 0) + 1;
      }
      const summary = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([v, n]) => `${v}:${n}`)
        .join(", ");
      lines.push(`  "${col}": ${summary}`);
    }
    lines.push(``);
  }

  // Pairwise correlations for numeric columns
  if (numCols.length >= 2) {
    lines.push(`--- Pairwise Correlations ---`);
    const colPairs = numCols.slice(0, 10);
    for (let i = 0; i < colPairs.length; i++) {
      for (let j = i + 1; j < colPairs.length; j++) {
        const c = pearsonCorrelation(
          parsed.numericColumns[colPairs[i]],
          parsed.numericColumns[colPairs[j]],
        );
        if (Math.abs(c.r) > 0.3 || c.pValue < 0.05) {
          lines.push(
            `  "${colPairs[i]}" vs "${colPairs[j]}": r=${c.r.toFixed(3)}, p=${c.pValue.toFixed(4)}, n=${c.n}`,
          );
        }
      }
    }
    lines.push(``);
  }

  // Group comparisons: ALL categorical × ALL numeric combinations
  if (catCols.length > 0 && numCols.length > 0) {
    lines.push(`--- Group Comparisons (t-tests for ALL categorical×numeric pairs) ---`);

    // Identify likely treatment/group columns (2-5 unique values)
    const treatmentCols = catCols.filter(col => {
      const uniq = [...new Set(parsed.categoricalColumns[col].filter(v => v && v !== "NaN"))];
      return uniq.length >= 2 && uniq.length <= 5;
    });

    for (const catCol of treatmentCols) {
      const groups = [...new Set(parsed.categoricalColumns[catCol])].filter(
        (v) => v && v !== "NaN",
      );
      if (groups.length < 2 || groups.length > 10) continue;

      lines.push(`  Group variable: "${catCol}" (${groups.join(", ")})`);

      for (const numCol of numCols) {
        const groupData: Record<string, number[]> = {};
        for (const g of groups) {
          groupData[g] = parsed.rows
            .filter((r) => String(r[catCol]) === g)
            .map((r) => Number(r[numCol]))
            .filter((v) => !isNaN(v));
        }

        if (groups.length === 2) {
          const t = twoSampleTTest(groupData[groups[0]], groupData[groups[1]]);
          lines.push(
            `    "${catCol}" (${groups[0]} vs ${groups[1]}) → "${numCol}": ` +
              `t=${t.tStat.toFixed(3)}, p=${t.pValue.toFixed(4)}, d=${t.cohensD.toFixed(3)}, ` +
              `mean_${groups[0]}=${t.meanA.toFixed(4)}, mean_${groups[1]}=${t.meanB.toFixed(4)}, ` +
              `n_${groups[0]}=${groupData[groups[0]].length}, n_${groups[1]}=${groupData[groups[1]].length}`,
          );
        } else {
          // Multi-group: report all pairwise
          for (let gi = 0; gi < groups.length; gi++) {
            for (let gj = gi + 1; gj < groups.length; gj++) {
              const gA = groups[gi];
              const gB = groups[gj];
              if ((groupData[gA]?.length ?? 0) < 2 || (groupData[gB]?.length ?? 0) < 2) continue;
              const t = twoSampleTTest(groupData[gA], groupData[gB]);
              lines.push(
                `    "${catCol}" (${gA} vs ${gB}) → "${numCol}": ` +
                  `t=${t.tStat.toFixed(3)}, p=${t.pValue.toFixed(4)}, d=${t.cohensD.toFixed(3)}, ` +
                  `mean_${gA}=${t.meanA.toFixed(4)}, mean_${gB}=${t.meanB.toFixed(4)}`,
              );
            }
          }
        }
      }
    }
    lines.push(``);
  }

  // Simpson's Paradox detection: ALL plausible (outcome, treatment, stratifier) combos
  // Identify binary outcome columns and treatment columns
  const binaryNumCols = numCols.filter(col => {
    const vals = parsed.numericColumns[col].filter(v => !isNaN(v));
    const uniq = [...new Set(vals)];
    return uniq.length === 2 && uniq.every(v => v === 0 || v === 1);
  });

  const treatmentCatCols = catCols.filter(col => {
    const uniq = [...new Set(parsed.categoricalColumns[col].filter(v => v && v !== "NaN"))];
    return uniq.length >= 2 && uniq.length <= 3;
  });

  const stratifierCatCols = catCols.filter(col => {
    const uniq = [...new Set(parsed.categoricalColumns[col].filter(v => v && v !== "NaN"))];
    return uniq.length >= 2 && uniq.length <= 10;
  });

  if (binaryNumCols.length > 0 && treatmentCatCols.length > 0 && stratifierCatCols.length > 0) {
    lines.push(`--- Simpson's Paradox Detection ---`);

    for (const outCol of binaryNumCols) {
      for (const treatCol of treatmentCatCols) {
        for (const stratCol of stratifierCatCols) {
          if (stratCol === treatCol) continue; // Don't stratify by treatment itself

          const result = detectSimpsonsParadox(parsed, outCol, treatCol, stratCol);

          const strataStr = Object.entries(result.strataDiffs)
            .map(([k, v]) => `${k}:${v.toFixed(4)}`)
            .join(", ");

          lines.push(
            `  outcome="${outCol}", treatment="${treatCol}", stratifier="${stratCol}":`,
          );
          lines.push(
            `    overall_diff=${result.overallDiff.toFixed(4)}, strata_diffs={${strataStr}}, paradox=${result.paradoxDetected}`,
          );
          lines.push(`    ${result.description}`);
        }
      }
    }
    lines.push(``);
  }

  // Also run Simpson's with continuous outcomes if no binary cols found
  if (binaryNumCols.length === 0 && numCols.length > 0 && treatmentCatCols.length >= 2) {
    lines.push(`--- Simpson's Paradox Detection (continuous outcomes) ---`);
    const outCols = numCols.slice(0, 5);
    for (const outCol of outCols) {
      for (const treatCol of treatmentCatCols) {
        for (const stratCol of treatmentCatCols) {
          if (stratCol === treatCol) continue;
          const result = detectSimpsonsParadox(parsed, outCol, treatCol, stratCol);
          if (result.paradoxDetected) {
            lines.push(
              `  PARADOX DETECTED: outcome="${outCol}", treatment="${treatCol}", stratifier="${stratCol}"`,
            );
            lines.push(`    ${result.description}`);
          }
        }
      }
    }
    lines.push(``);
  }

  // --- Computed Surprise Scores ---
  const surpriseScores = computeSurpriseScores(parsed);
  const surpriseEntries = Object.entries(surpriseScores);
  if (surpriseEntries.length > 0) {
    lines.push(`--- Computed Surprise Scores ---`);
    for (const [desc, score] of surpriseEntries.sort((a, b) => b[1] - a[1])) {
      lines.push(`  "${desc}": surprise_kl=${score.toFixed(4)}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}
