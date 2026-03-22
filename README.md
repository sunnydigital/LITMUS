# LITMUS

**Autonomous research agent that tries to debunk itself.**

Upload any structured dataset. LITMUS profiles it, generates hypotheses ranked by surprise, runs experiments, then attempts to kill its own findings through a 5-check validation gauntlet. Only what survives gets reported.

> "Three findings generated. One killed by confounder scan. Two survived with Grade A. Here's the proof."

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

Open http://localhost:3000. Click **Run Demo** to use built-in demo data.

One API key, one command, full pipeline.

## What It Does

Upload a dataset. LITMUS finds what you missed, then tries to prove itself wrong.

| Step | What happens |
|---|---|
| Profile | Reads your data. Identifies structure, distributions, anomalies. |
| Hypothesize | Generates ranked hypotheses by expected information gain. |
| Experiment | Runs statistical tests. Real numbers, not narration. |
| Validate | 5-check skeptic gauntlet tries to kill each finding. |
| Report | Survivors get graded (A/B/C), ranked by surprise, narrated. |

The system that validates everything validates nothing. LITMUS shows you the corpses alongside the survivors.

## Architecture

One API route (`/api/discover`) runs 5 pipeline stages sequentially, streaming progress via SSE:

```
Upload files (or click "Run Demo")
     |
     v
[1. PROFILER]       Reads data, identifies structure and anomalies
     |
     v
[2. HYPOTHESIZER]   Generates ranked hypotheses by information gain
     |
     v
[3. EXPERIMENTER]   Runs numerical analysis, Claude interprets results
     |                ** needs lib/analysis.ts built - see TASKS.md #2 **
     |
     v
[4. SKEPTIC]        5-check gauntlet: BH-FDR, confounders, temporal, holdout, effect size
     |
     v
[5. NARRATOR]       Final discovery report with grades and surprise scores
```

### What runs locally vs what's Claude

| Component | Local | Claude |
|---|---|---|
| BH-FDR correction | `lib/skeptic.ts` | - |
| Effect size threshold | `lib/skeptic.ts` | - |
| KL divergence scoring | `lib/surprise.ts` | - |
| Numerical analysis | `lib/analysis.ts` **(needs building)** | - |
| Data profiling | - | Reads raw data |
| Hypothesis generation | - | Generates and ranks |
| Result interpretation | - | Narrates real numbers |
| Confounder/temporal/holdout | - | Reasons about validity |

The critical task is building `lib/analysis.ts` so the experimenter runs real computations and passes those numbers to Claude for interpretation. See TASKS.md #2.

## The Skeptic Gauntlet

Every finding passes 5 checks before being reported:

1. **Multiple Testing** - Benjamini-Hochberg FDR correction (local)
2. **Confounder Scan** - Could a third variable explain this? (Claude)
3. **Temporal Stability** - Does it hold across different data windows? (Claude)
4. **Holdout Replication** - Does it replicate on held-out data? (Claude)
5. **Effect Size Filter** - Cohen's d > 0.3, practically meaningful? (local)

Grades: **A** = 5/5 pass | **B** = 4/5 pass | **C** = archived (< 4 pass)

## Surprise Score

Findings ranked by unexpectedness, not just significance:

```
discovery_score = surprise x significance x effect_size

surprise     = KL divergence from expected distribution (lib/surprise.ts)
significance = -log10(adjusted_p_value)
effect_size  = |Cohen's d| or |r|
```

Obvious confirmations get deprioritized even at p < 0.001.

## Demo Data

`data/demo/` contains synthetic ML training data with patterns baked in for demonstration. Click "Run Demo" to see the full pipeline in action. Upload your own CSVs to discover patterns in any structured dataset.

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
  demo/                        # Demo dataset for showcase
```

## Team

| Person | Focus |
|---|---|
| Amadeus | Pipeline architecture, prompts, skeptic gauntlet |
| Sunny | Frontend, visualization, upload flow |
| Kanishkha | Domain research, experiment design |
| Nirbhaya | Statistical validation, data handling |
