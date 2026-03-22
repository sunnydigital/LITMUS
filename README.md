# LITMUS

**Find hidden dynamics in your transformer training runs.**

Upload loss curves, gradient norms, and attention entropy from a NanoGPT-scale run. LITMUS profiles the data, generates hypotheses about emergent behavior, validates them, and reports what it finds.

## Track: The Operator (EmpireHacks 2026)

## Quick Start

```bash
git clone https://github.com/sunnydigital/LITMUS.git
cd LITMUS
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
npm run dev
```

Open http://localhost:3000. Click **Run Demo** to use built-in synthetic training data.

One API key, one command, full pipeline.

## What It Does

LITMUS is a transformer interpretability tool built on an autonomous agent pipeline. You give it training artifacts. It tells you what happened during training.

| Discovery Type | Example |
|---|---|
| Phase transitions | "Loss plateau breaks at epoch 47 with 40% entropy drop" |
| Head specialization | "Heads diverge from uniform entropy after epoch 30" |
| Grokking | "Val loss plateaus 15 epochs after train converges, then drops sharply" |
| Gradient events | "Gradient norm spikes precede phase transitions by 2-3 epochs" |

## Architecture

One API route (`/api/discover`) runs 5 pipeline stages sequentially, streaming progress via SSE:

```
Upload files (or click "Run Demo")
     |
     v
[1. PROFILER]       Claude reads the CSVs, identifies patterns, outputs structured JSON
     |
     v
[2. HYPOTHESIZER]   Claude generates ranked hypotheses about training dynamics
     |
     v
[3. EXPERIMENTER]   Runs real numerical analysis on parsed data, Claude interprets results
     |                ** needs lib/analysis.ts built - see TASKS.md #2 **
     |
     v
[4. SKEPTIC]        2 local checks (BH-FDR, effect size) + 3 Claude reasoning checks
     |
     v
[5. NARRATOR]       Final discovery report in markdown
```

### What runs locally vs what's Claude

| Component | Local | Claude |
|---|---|---|
| BH-FDR correction | `lib/skeptic.ts` | - |
| Effect size threshold | `lib/skeptic.ts` | - |
| KL divergence scoring | `lib/surprise.ts` | - |
| Numerical analysis | `lib/analysis.ts` **(needs building)** | - |
| Data profiling | - | Reads raw CSVs |
| Hypothesis generation | - | Generates and ranks |
| Result interpretation | - | Narrates real numbers |
| Confounder/temporal/holdout | - | Reasons about validity |

The critical task is building `lib/analysis.ts` so the experimenter stage runs real computations (changepoint detection, z-scores, correlations, t-tests) and passes those numbers to Claude for interpretation. See TASKS.md #2.

## Demo Data

`data/demo/` contains synthetic NanoGPT training data with documented phenomena baked in:

- **loss.csv** - 100 epochs, grokking phase transition at epoch 45-50
- **metrics.csv** - Gradient norm spikes at epoch 12 and 47, attention head divergence after epoch 30
- **config.json** - 6-layer, 6-head, 384-dim model on shakespeare_char

## Surprise Score

Findings ranked by unexpectedness, not just significance:

```
discovery_score = surprise x significance x effect_size

surprise     = KL divergence from expected distribution (lib/surprise.ts)
significance = -log10(adjusted_p_value)
effect_size  = |Cohen's d| or |r|
```

## Stack

| Layer | Tool |
|---|---|
| Reasoning | Claude Sonnet 4.5 (Anthropic) |
| Validation | BH-FDR correction + effect size (local) |
| Scoring | KL divergence surprise ranking (local) |
| Frontend | Next.js 16 + Tailwind 4 |
| Deploy | Vercel |

## File Structure

```
app/
  page.tsx                     # Single page: upload or stream results
  layout.tsx                   # Root layout
  globals.css                  # Tailwind + CSS vars
  api/
    discover/route.ts          # Single orchestrator: all 5 stages via SSE
components/
  DataUpload.tsx               # File upload + "Run Demo" button
  DiscoveryStream.tsx          # Renders pipeline timeline + results + report
lib/
  prompts.ts                   # 5 agent prompt templates
  skeptic.ts                   # BH-FDR correction + effect size check (REAL MATH)
  surprise.ts                  # Discovery score ranking (REAL MATH)
  analysis.ts                  # ** NEEDS BUILDING ** Real numerical analysis
data/
  demo/
    loss.csv                   # Synthetic training loss (grokking pattern)
    metrics.csv                # Gradient norms, attention entropy, weight norms
    config.json                # Model architecture config
```

## Team

| Person | Focus |
|---|---|
| Amadeus | Pipeline architecture, prompts, skeptic gauntlet |
| Sunny | Frontend, visualization, upload flow |
| Kanishkha | Domain research, experiment design |
| Nirbhaya | Statistical validation, data handling |

## References

- [Mechanistic Interpretability](https://transformer-circuits.pub/)
- [A Mathematical Framework for Transformer Circuits](https://transformer-circuits.pub/2021/framework/index.html)
- [Grokking: Generalization Beyond Overfitting](https://arxiv.org/abs/2201.02177)
