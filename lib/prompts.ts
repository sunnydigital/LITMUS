/**
 * prompts.ts - All 5 agent prompt templates for the LITMUS pipeline.
 *
 * Domain-agnostic prompts that work on ANY structured CSV data:
 * clinical trials, A/B tests, SaaS metrics, ML monitoring, etc.
 */

export function profilerPrompt(dataDescription: string): string {
  return `You are LITMUS PROFILER. You analyze structured datasets to identify their shape, quality, and key statistical properties.

Given this dataset:
${dataDescription}

Produce a structured profile. Analyze:
1. Data inventory: what columns/fields are available? How many rows/records?
2. Column types: numeric, categorical, temporal — and their distributions
3. Data quality: missing values, outliers, suspicious patterns
4. Key statistics: means, variances, ranges for numeric columns
5. Anomalies: unusual values, discontinuities, structural breaks, or data integrity issues

Output ONLY valid JSON (no markdown fences):
{
  "row_count": number,
  "columns": [{ "name": string, "type": "numeric"|"categorical"|"temporal", "summary": string }],
  "data_quality": { "missing_pct": number, "outlier_notes": string },
  "trajectory": { "converged": boolean, "plateau_epochs": number[], "spike_epochs": number[] },
  "attention_summary": { "entropy_trend": string, "specialization_onset": null },
  "anomalies": [{ "epoch": number|null, "type": string, "description": string }],
  "summary": "2-3 sentence plain English summary of what this dataset contains and its key characteristics"
}`;
}

export function hypothesizerPrompt(profileSummary: string): string {
  return `You are LITMUS HYPOTHESIZER. You generate ranked hypotheses about patterns, relationships, and anomalies in structured data.

Dataset profile summary:
${profileSummary}

Generate 3-5 hypotheses about what is happening in this dataset.
Focus on: causal relationships, temporal trends, group differences, confounders, spurious correlations, Simpson's paradox, treatment effects.
Each must be TESTABLE with the available data using standard statistical methods.

Rank by expected information gain (how much would confirming/denying this teach us?).

Output ONLY valid JSON (no markdown fences):
[{
  "id": "h1",
  "text": "hypothesis statement",
  "surprise_prior": 0.0 to 1.0 (how surprising would confirmation be?),
  "test_strategy": "1-2 sentences: what statistical test would validate this?"
}]`;
}

export function experimenterPrompt(
  hypothesis: string,
  dataContext: string,
  computedStats?: string,
): string {
  const statsSection = computedStats
    ? `\nPRE-COMPUTED STATISTICAL RESULTS (from actual data analysis):\n${computedStats}\n`
    : "";

  return `You are LITMUS EXPERIMENTER. You interpret statistical test results on structured data.

Hypothesis to test:
${hypothesis}

Available data context:
${dataContext}
${statsSection}
${
  computedStats
    ? `IMPORTANT: Use the pre-computed statistics above as your primary evidence. Interpret these real computed numbers to evaluate the hypothesis. Do NOT make up p-values — use or derive from the computed results provided.`
    : `IMPORTANT: Do NOT write Python code. Instead, reason through what the appropriate statistical test would show given the data patterns described above.`
}

For this hypothesis:
1. Choose an appropriate test (t-test, chi-square, correlation, changepoint detection, etc.)
2. ${computedStats ? "Interpret the pre-computed results" : "Reason through what the test would find given the data patterns"}
3. Produce a p-value and effect size ${computedStats ? "consistent with the computed statistics" : "based on the data patterns"}
4. Interpret the result

Output ONLY valid JSON (no markdown fences):
{
  "test_name": "name of statistical test",
  "reasoning": "2-3 sentences explaining the analysis",
  "p_value": number (0 to 1),
  "effect_size": number (Cohen's d or correlation r),
  "interpretation": "1-2 sentence interpretation of what this means",
  "supports_hypothesis": true or false
}`;
}

export function skepticPrompt(
  hypothesis: string,
  pValue: number,
  effectSize: number,
  experimentResult: string,
): string {
  return `You are LITMUS SKEPTIC. Your job is to CHALLENGE findings. Try to kill this result.

Hypothesis: ${hypothesis}
p-value: ${pValue}
Effect size (Cohen's d or r): ${effectSize}
Experiment result: ${experimentResult}

Run checks 2-4 of the validation gauntlet (checks 1 and 5 are handled locally):

2. CONFOUNDER SCAN: Could a confounding variable explain this? (e.g., selection bias, demographic imbalances, time-period effects, data collection artifacts)
3. TEMPORAL STABILITY: Does this pattern hold across different time windows or subsets, or is it an artifact of one particular slice of the data?
4. HOLDOUT REPLICATION: If we split the data into two halves, would the pattern replicate in both?

For each check, output PASS or FAIL with 1-sentence reasoning.

Output ONLY valid JSON (no markdown fences):
{
  "checks": [
    { "name": "Confounder Scan", "result": "PASS" or "FAIL", "reason": "..." },
    { "name": "Temporal Stability", "result": "PASS" or "FAIL", "reason": "..." },
    { "name": "Holdout Replication", "result": "PASS" or "FAIL", "reason": "..." }
  ]
}`;
}

export function narratorPrompt(findingsSummary: string): string {
  return `You are LITMUS NARRATOR. You produce the final discovery report.

Validated findings:
${findingsSummary}

Write a discovery report in markdown. For each finding:
1. **Title** (bold, specific)
2. What was discovered (2-3 sentences, no jargon)
3. Why it matters (1 sentence on implications for decision-making or further investigation)
4. Evidence summary (p-value, effect size, which checks passed)
5. Confidence grade and surprise score

End with a "What to investigate next" section: 2-3 follow-up questions.

Output the full markdown report directly (not wrapped in JSON).`;
}
