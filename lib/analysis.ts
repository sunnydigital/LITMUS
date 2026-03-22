/**
 * analysis.ts - Statistical analysis functions for LITMUS.
 *
 * Pure TypeScript implementations of common statistical tests.
 * No external dependencies — runs in Next.js Edge/Node runtime.
 */

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
 * Run a full statistical analysis suite on parsed CSV data.
 * Returns a summary string suitable for passing to Claude.
 */
export function runAnalysisSuite(parsed: ParsedCSV): string {
  const lines: string[] = [];
  const numCols = Object.keys(parsed.numericColumns);

  lines.push(`=== COMPUTED STATISTICS (from actual data) ===`);
  lines.push(`Rows: ${parsed.rows.length}, Numeric columns: ${numCols.length}`);
  lines.push(``);

  // Per-column stats
  for (const col of numCols.slice(0, 10)) {
    const vals = parsed.numericColumns[col].filter((v) => !isNaN(v));
    if (vals.length === 0) continue;
    const m = mean(vals);
    const sd = stdDev(vals, 1);
    const sorted = [...vals].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    lines.push(
      `Column "${col}": n=${vals.length}, mean=${m.toFixed(4)}, sd=${sd.toFixed(4)}, min=${min.toFixed(4)}, max=${max.toFixed(4)}`,
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

  // Pairwise correlations for first few numeric columns
  if (numCols.length >= 2) {
    lines.push(`--- Pairwise Correlations ---`);
    const colPairs = numCols.slice(0, 6);
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

  // Group comparisons for categorical columns
  const catCols = Object.keys(parsed.categoricalColumns);
  if (catCols.length > 0 && numCols.length > 0) {
    lines.push(`--- Group Comparisons ---`);
    for (const catCol of catCols.slice(0, 3)) {
      const groups = [...new Set(parsed.categoricalColumns[catCol])].filter(
        (v) => v && v !== "NaN",
      );
      if (groups.length < 2 || groups.length > 10) continue;

      for (const numCol of numCols.slice(0, 3)) {
        const groupData: Record<string, number[]> = {};
        for (const g of groups) {
          groupData[g] = parsed.rows
            .filter((r) => String(r[catCol]) === g)
            .map((r) => Number(r[numCol]))
            .filter((v) => !isNaN(v));
        }

        if (groups.length === 2) {
          const t = twoSampleTTest(groupData[groups[0]], groupData[groups[1]]);
          if (t.pValue < 0.1 || Math.abs(t.cohensD) > 0.2) {
            lines.push(
              `  "${catCol}" (${groups[0]} vs ${groups[1]}) on "${numCol}": ` +
                `t=${t.tStat.toFixed(3)}, p=${t.pValue.toFixed(4)}, d=${t.cohensD.toFixed(3)}, ` +
                `mean_A=${t.meanA.toFixed(3)}, mean_B=${t.meanB.toFixed(3)}`,
            );
          }
        }
      }
    }
    lines.push(``);
  }

  return lines.join("\n");
}
