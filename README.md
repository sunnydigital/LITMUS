# LITMUS

**Autonomous discovery agent for transformer training dynamics.**

Upload training artifacts from any NanoGPT-scale run. LITMUS profiles the data, generates hypotheses about emergent behavior, runs statistical experiments, tries to kill its own findings, and reports only what survives.

> "Your model compiled a binary adder into heads 3 and 7 at epoch 47. Here's the proof."

## Track: The Operator (EmpireHacks 2026)

## Why Transformers, Not Tabular Data

Every "upload a CSV, get insights" tool exists already. None of them answer the question researchers actually care about: **what is my model learning, and when?**

Training a transformer is an opaque process. Loss goes down. Perplexity improves. But inside the weights, algorithms are being compiled, attention heads are specializing, phase transitions are firing. Nobody has a tool that autonomously discovers these phenomena and validates them.

LITMUS applies a rigorous scientific discovery loop to transformer internals. Inspired by [Mentat](https://github.com/quantbagel/mentat) (compiled computation in transformer weights), we treat model training as an archaeological site. The artifacts: weight snapshots, attention maps, gradient norms, loss curves. The discoveries: emergent algorithms, phase transitions, head specialization, grokking.

## 5-Stage Discovery Pipeline

```
TRAINING ARTIFACTS (weight snapshots, attention maps, loss curves, gradient norms)
     |
     v
[1. PROFILER]
     Schema inference, distribution analysis, temporal patterns
     Weight norm trajectories, attention entropy over time
     Outlier epochs, gradient explosion/vanishing census
     |
     v
[2. HYPOTHESIZER]
     Ranked by expected information gain x surprise score
     "Phase transition at epoch 47: attention entropy drops 40%"
     "Heads 3+7 specialize for positional encoding after epoch 20"
     "Grokking: test loss plateaus 30 epochs before sudden improvement"
     |
     v                    <-- feedback loop
[3. EXPERIMENTER]         |
     Writes + executes statistical tests in E2B sandbox     |
     scipy, statsmodels, sklearn, torch probing             |
     Ablation studies, probing classifiers, synthetic inputs |
     Results update belief state ------>------>------>-------+
     |
     v
[4. SKEPTIC] (5-check gauntlet)
     1. Multiple testing correction (Benjamini-Hochberg FDR)
     2. Confounder scan (partial correlations)
     3. Temporal stability (does pattern hold across training windows?)
     4. Holdout replication (validate on held-out weight snapshots)
     5. Effect size filter (Cohen's d > 0.3)
     |
     Confidence: A (5/5) | B (4/5) | C (failed, archived with reasoning)
     |
     v
[5. NARRATOR]
     Plain-English findings with cited evidence
     Embedded Plotly visualizations
     Surprise-ranked: discovery_score = surprise x significance x effect_size
     Push to Google Sheets (Operator requirement)
```

## What It Discovers

| Discovery Type | Example | How |
|---|---|---|
| Phase transitions | "Loss plateau breaks at epoch 47 with 40% entropy drop" | Changepoint detection on attention entropy time series |
| Head specialization | "Head 3 becomes positional, head 7 becomes content after epoch 20" | Probing classifiers on attention patterns per head |
| Compiled algorithms | "Binary addition circuit in layers 4-6, matching Mentat reference" | Weight pattern matching against compiled kernels |
| Grokking | "Test generalization delayed 30 epochs after train convergence" | Train/test divergence analysis with temporal lag correlation |
| Emergent notation | "Model invents intermediate token types not in training data" | Embedding cluster analysis over training time |

## Stack

| Layer | Tool | Purpose |
|---|---|---|
| Reasoning | Claude (Anthropic) | Hypothesis generation, code generation, narration |
| Vision | Claude Vision | Parse training plots, architecture diagrams |
| Execution | E2B Sandbox | Safe Python execution (scipy, torch, statsmodels) |
| Statistics | scipy, statsmodels, pingouin | KS tests, partial correlations, FDR, changepoint |
| Probing | torch, sklearn | Probing classifiers, ablation, synthetic inputs |
| Visualization | Plotly | Interactive charts in discovery reports |
| Frontend | Next.js 16 + Tailwind | Upload UI, reasoning stream, dashboard |
| Output | Google Sheets API | Push discoveries to external systems |
| State | In-memory | Belief state, hypothesis tree, experiment log |
| Deploy | Vercel | One-click |

## Surprise Score (Ranking)

Findings ranked by unexpectedness, not just significance:

```
discovery_score = surprise x significance x effect_size

surprise    = KL divergence from expected distribution
significance = -log10(adjusted_p_value)
effect_size  = |Cohen's d| or |r|
```

Obvious confirmations deprioritized even at p < 0.001.

## Demo Flow (3 min)

1. Upload training artifacts from a NanoGPT run (weight snapshots every 10 epochs, loss CSV, attention maps)
2. Profiler: "23 layers, 8 heads, 50 epochs. Gradient norm spike at epoch 12. Attention entropy bimodal."
3. Hypothesizer generates 7 ranked hypotheses. Top: "Phase transition at epoch 12 triggered by gradient spike."
4. Experimenter: runs changepoint detection, KS test on pre/post weight distributions, probing classifier on head activations
5. Skeptic gauntlet: 4/5 pass (temporal stability marginal). Grade B.
6. Narrator: "Your model underwent a phase transition at epoch 12. Heads 3 and 7 specialized for positional encoding. Effect size: d=1.4. Gradient norm spike preceded the transition by 2 epochs, suggesting instability triggers reorganization."
7. Push to Google Sheets.

## Setup

```bash
git clone https://github.com/sunnydigital/empirehacks.git
cd empirehacks
npm install
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, E2B_API_KEY, GOOGLE_SHEETS_API_KEY
npm run dev
```

## Team

| Role | Person | Focus |
|---|---|---|
| Agent architecture + prompts | Amadeus | 5-stage pipeline, Claude integration, skeptic gauntlet |
| Frontend + viz | Sunny | Next.js UI, Plotly charts, upload flow, dashboard |
| Execution sandbox + probing | TBD | E2B integration, torch probing classifiers, statistical tests |

## File Structure

```
app/
  page.tsx                    # Main UI: upload + discovery stream
  layout.tsx                  # Root layout
  globals.css                 # Base styles
  api/
    profile/route.ts          # Profiler agent endpoint
    hypothesize/route.ts      # Hypothesizer agent endpoint
    experiment/route.ts       # Experimenter agent endpoint
    validate/route.ts         # Skeptic agent endpoint
    narrate/route.ts          # Narrator agent endpoint
components/
  DataUpload.tsx              # Training artifact upload (weight snapshots, CSVs)
  HypothesisList.tsx          # Ranked hypotheses with surprise scores
  ExperimentResult.tsx        # Statistical test results + Plotly charts
  ValidationBadge.tsx         # A/B/C grade per skeptic check
  DiscoveryReport.tsx         # Final narrated findings
lib/
  prompts.ts                  # All 5 agent prompt templates
  skeptic.ts                  # 5-check validation gauntlet
  surprise.ts                 # Surprise score ranking
  sandbox.ts                  # E2B sandbox integration
```

## References

- [Mentat: Compiled Computation in Transformers](https://github.com/quantbagel/mentat)
- [NanoChat](https://github.com/karpathy/nanochat) (NanoGPT successor)
- [Mechanistic Interpretability](https://transformer-circuits.pub/)
