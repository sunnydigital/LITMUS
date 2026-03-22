# LITMUS

**Autonomous data research agent that challenges its own findings.**

Upload any dataset. LITMUS autonomously decides what to investigate, runs statistical tests, then validates everything through Benjamini-Hochberg FDR correction and effect size filtering. Only what survives gets reported.

> "13 tools called. 6 findings generated. 1 killed by FDR correction. 5 survived Grade A. Here's the proof."

## Track: The Operator (EmpireHacks 2026)

## Quick Start

```bash
git clone https://github.com/sunnydigital/litmus.git
cd litmus
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
npm run dev
```

Open http://localhost:3000. Pick a demo dataset or upload your own.

One API key, one command, full autonomous agent.

## How It Works

LITMUS runs a Claude agentic loop with 11 statistical tools. Claude **decides** what to investigate — not a fixed pipeline.

```
Upload data (CSV, JSON, TSV, paste)
     |
     v
  ┌─────────────────────────────────────┐
  │         AGENTIC LOOP                │
  │                                     │
  │  OBSERVE  → describe_dataset        │
  │  DECIDE   → form hypotheses         │
  │  ACT      → run_ttest               │
  │            → compute_correlation    │
  │            → detect_simpsons_paradox│
  │            → detect_changepoints    │
  │            → detect_anomalies       │
  │            → chi_square_test        │
  │            → compute_entropy        │
  │  VALIDATE → validate_findings       │
  │  VISUALIZE→ generate_chart          │
  │  RESEARCH → web_search              │
  │                                     │
  │  Claude decides tools + order.      │
  │  Max 25 turns. Real-time SSE.       │
  └─────────────────────────────────────┘
     |
     v
  Discovery Report (validated findings only)
```

The agent streams its reasoning, tool calls, and results to the frontend in real time via SSE.

## What Runs Locally vs Claude

| Component | Where | What |
|---|---|---|
| Statistical tests | Local (`lib/analysis.ts`) | t-test, correlation, chi-square, entropy, changepoints, anomalies, Simpson's paradox |
| BH-FDR correction | Local (`lib/skeptic.ts`) | Multiple testing correction |
| Effect size filter | Local (`lib/skeptic.ts`) | Cohen's d > 0.3 threshold |
| KL divergence | Local (`lib/surprise.ts`) | Surprise scoring |
| Chart generation | Local (`lib/analysis.ts`) | Auto-detect chart type from data |
| Investigation strategy | Claude (tool_use) | Decides what to test, in what order |
| Hypothesis generation | Claude (tool_use) | Forms and explains hypotheses |
| Result interpretation | Claude (tool_use) | Explains what findings mean |
| Report writing | Claude (tool_use) | Structured markdown report |

All statistics are **real math** — Claude interprets results, it doesn't fabricate numbers.

## Demo Datasets

5 curated datasets with real statistical traps:

| Dataset | What It Tests |
|---|---|
| **Simpson's Paradox** | A/B test where treatment wins overall but loses in every segment |
| **Startup Metrics** | 18-month SaaS data with churn spikes, enterprise outliers, hidden PMF |
| **Clinical Trial** | 12-endpoint RCT with 2 real effects, 3 spurious, multiple-testing trap |
| **Feature Drift** | 90 days ML monitoring with gradual drift and pipeline bug |
| **Grokking** | Transformer training with phase transitions and gradient spikes |

## Stack

| Layer | Tool |
|---|---|
| Agent | Claude Sonnet 4.6 via tool_use API |
| Statistics | 1,174 lines pure TypeScript (no external math libs) |
| Validation | BH-FDR correction + Cohen's d (local) |
| Frontend | Next.js 16 + Tailwind v4 + Recharts |
| Streaming | Server-Sent Events (SSE) |

## Team

| Person | Focus |
|---|---|
| Amadeus | Architecture, agentic loop, skeptic gauntlet |
| Sunny | Frontend, visualization, upload flow |
| Kanishkha | Domain research, experiment design |
| Nirbhaya | Statistical validation, data handling |
