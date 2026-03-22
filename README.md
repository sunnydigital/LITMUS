# LITMUS

**Autonomous discovery agent for transformer training dynamics.**

Upload training artifacts from any NanoGPT-scale run. LITMUS profiles the data, generates hypotheses about emergent behavior, runs statistical experiments, tries to kill its own findings, and reports only what survives.

> "Your model compiled a binary adder into heads 3 and 7 at epoch 47. Here's the proof."

## Track: The Operator (EmpireHacks 2026)

## Quick Start

```bash
git clone https://github.com/sunnydigital/empirehacks.git
cd empirehacks
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
npm run dev
```

Open http://localhost:3000. Click **Run Demo** to use built-in synthetic training data.

That is it. One API key, one command, full pipeline.

## How It Works

One API route (`/api/discover`) runs 5 pipeline stages sequentially, streaming progress via SSE:

```
Upload files (or click "Run Demo")
     |
     v
[1. PROFILER]       Analyze training artifacts: loss curves, gradient norms, attention entropy
     |
     v
[2. HYPOTHESIZER]   Generate ranked hypotheses about training dynamics
     |
     v
[3. EXPERIMENTER]   Claude reasons through statistical tests on the data
     |
     v
[4. SKEPTIC]        5-check validation gauntlet (BH-FDR, confounders, temporal, holdout, effect size)
     |
     v
[5. NARRATOR]       Final discovery report in markdown
```

## What It Discovers

| Discovery Type | Example |
|---|---|
| Phase transitions | "Loss plateau breaks at epoch 47 with 40% entropy drop" |
| Head specialization | "Heads diverge from uniform entropy after epoch 30" |
| Grokking | "Val loss plateaus 15 epochs after train converges, then drops sharply" |
| Gradient events | "Gradient norm spikes precede phase transitions by 2-3 epochs" |

## Surprise Score

Findings ranked by unexpectedness, not just significance:

```
discovery_score = surprise x significance x effect_size

surprise     = KL divergence from expected distribution
significance = -log10(adjusted_p_value)
effect_size  = |Cohen's d| or |r|
```

## Demo Data

The `data/demo/` directory contains synthetic nanoGPT training data with baked-in patterns:

- **loss.csv** - 100 epochs with a grokking phase transition at epoch 45-50
- **metrics.csv** - Gradient norm spikes, attention head divergence, weight norm acceleration
- **config.json** - 6-layer, 6-head, 384-dim model on shakespeare_char

## Stack

| Layer | Tool |
|---|---|
| Reasoning | Claude claude-sonnet-4-5-20250929 (Anthropic) |
| Validation | BH-FDR correction + effect size checks (local) |
| Scoring | KL divergence surprise ranking |
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
  prompts.ts                   # 5 agent prompt templates (simplified)
  skeptic.ts                   # BH-FDR correction + effect size check
  surprise.ts                  # Discovery score ranking
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
