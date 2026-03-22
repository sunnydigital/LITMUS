/**
 * prompts.ts - All 5 agent prompt templates for the LITMUS pipeline.
 *
 * Each prompt is a function that takes context (profile data, hypotheses,
 * experiment results) and returns a structured prompt for Claude.
 *
 * Prompt design principles:
 *   - Structured output (JSON schema) for programmatic parsing
 *   - Chain-of-thought reasoning visible in output
 *   - Domain-specific vocabulary (transformer architecture terms)
 *   - Explicit constraints on hallucination
 */

export interface ProfileContext {
  fileManifest: { name: string; type: string; size: number }[];
  schema?: Record<string, string>;
  summary?: string;
}

export interface HypothesisContext {
  profile: ProfileContext;
  priorHypotheses: { text: string; status: string; grade?: string }[];
  experimentResults: { hypothesisId: string; outcome: string }[];
}

export interface ExperimentContext {
  hypothesis: string;
  profileSummary: string;
  availableData: string[];
}

export interface ValidationContext {
  hypothesis: string;
  experimentCode: string;
  experimentResult: string;
  pValue: number;
  effectSize: number;
}

export interface NarrationContext {
  validatedFindings: {
    hypothesis: string;
    grade: "A" | "B" | "C";
    evidence: string;
    surpriseScore: number;
  }[];
}

export function profilerPrompt(ctx: ProfileContext): string {
  return `You are LITMUS PROFILER. You analyze transformer training artifacts.

Given these uploaded files:
${ctx.fileManifest.map((f) => `- ${f.name} (${f.type}, ${f.size} bytes)`).join("\n")}

Produce a structured profile:
1. Data inventory: what epochs/checkpoints are available?
2. Model architecture: layers, heads, embedding dim (from config or weight shapes)
3. Training trajectory: loss curve shape, gradient norm trends, convergence status
4. Attention statistics: entropy distribution per head, per layer, over time
5. Anomalies: gradient spikes, loss plateaus, sudden entropy changes, outlier epochs

Output JSON:
{
  "epochs_available": number[],
  "architecture": { "n_layer": number, "n_head": number, "n_embd": number },
  "trajectory": { "converged": boolean, "plateau_epochs": number[], "spike_epochs": number[] },
  "attention_summary": { "entropy_mean": number, "entropy_std": number, "bimodal": boolean },
  "anomalies": [{ "epoch": number, "type": string, "description": string }]
}`;
}

export function hypothesizerPrompt(ctx: HypothesisContext): string {
  return `You are LITMUS HYPOTHESIZER. You generate ranked hypotheses about transformer training dynamics.

Profile summary:
${ctx.profile.summary || "No profile yet."}

Prior hypotheses and outcomes:
${ctx.priorHypotheses.map((h) => `- [${h.status}${h.grade ? ` (${h.grade})` : ""}] ${h.text}`).join("\n") || "None yet."}

Recent experiment results:
${ctx.experimentResults.map((r) => `- Hypothesis ${r.hypothesisId}: ${r.outcome}`).join("\n") || "None yet."}

Generate 3-7 NEW hypotheses about what is happening in this model's training.
Focus on: phase transitions, head specialization, algorithm compilation, grokking, emergent representations.
Do NOT repeat prior hypotheses. Each must be TESTABLE with the available data.

Rank by expected information gain (how much would confirming/denying this teach us?).

Output JSON array:
[{
  "id": string,
  "text": string,
  "expected_info_gain": number (0-1),
  "test_strategy": string (1-2 sentences: what statistical test would validate this?)
}]`;
}

export function experimenterPrompt(ctx: ExperimentContext): string {
  return `You are LITMUS EXPERIMENTER. You write and execute statistical tests on transformer training data.

Hypothesis to test:
${ctx.hypothesis}

Available data:
${ctx.availableData.join(", ")}

Profile summary:
${ctx.profileSummary}

Write a Python script that:
1. Loads the relevant training artifacts
2. Runs an appropriate statistical test (KS test, changepoint detection, probing classifier, etc.)
3. Computes p-value and effect size (Cohen's d or correlation r)
4. Generates a Plotly figure showing the evidence
5. Returns structured results

Use: scipy, statsmodels, sklearn, torch, plotly, numpy, pandas.
Script must be self-contained (will run in E2B sandbox).

Output JSON:
{
  "code": string (full Python script),
  "test_name": string,
  "expected_output": { "p_value": "float", "effect_size": "float", "plot": "plotly JSON" }
}`;
}

export function skepticPrompt(ctx: ValidationContext): string {
  return `You are LITMUS SKEPTIC. Your job is to CHALLENGE findings. Try to kill this result.

Hypothesis: ${ctx.hypothesis}
p-value: ${ctx.pValue}
Effect size: ${ctx.effectSize}
Experiment code: ${ctx.experimentCode}
Result: ${ctx.experimentResult}

Run the 5-check gauntlet:

1. MULTIPLE TESTING: Given how many hypotheses were tested, does this survive Benjamini-Hochberg FDR correction?
2. CONFOUNDER SCAN: Could a confounding variable explain this? (e.g., learning rate schedule, batch size changes at that epoch)
3. TEMPORAL STABILITY: Does this pattern hold across different training windows, or is it an artifact of one snapshot?
4. HOLDOUT REPLICATION: If we split checkpoints into train/test, does the pattern replicate?
5. EFFECT SIZE: Is Cohen's d > 0.3? Is this practically meaningful, not just statistically significant?

For each check, output PASS or FAIL with 1-sentence reasoning.

Output JSON:
{
  "checks": [
    { "name": string, "result": "PASS" | "FAIL", "reason": string }
  ],
  "grade": "A" | "B" | "C",
  "overall": string (1 sentence summary)
}`;
}

export function narratorPrompt(ctx: NarrationContext): string {
  return `You are LITMUS NARRATOR. You produce the final discovery report.

Validated findings (sorted by surprise score):
${ctx.validatedFindings
  .sort((a, b) => b.surpriseScore - a.surpriseScore)
  .map(
    (f) =>
      `[Grade ${f.grade}] (surprise: ${f.surpriseScore.toFixed(2)}) ${f.hypothesis}\nEvidence: ${f.evidence}`,
  )
  .join("\n\n")}

Write a discovery report in plain English. For each finding:
1. Title (bold, specific)
2. What was discovered (2-3 sentences, no jargon)
3. Why it matters (1 sentence on implications for model design or training strategy)
4. Evidence summary (p-value, effect size, which checks passed)
5. Confidence grade and surprise score

End with a "What to investigate next" section: 2-3 follow-up questions this analysis opened up.

Format: Markdown. No code blocks. Embed Plotly chart references as [Figure N] placeholders.`;
}
