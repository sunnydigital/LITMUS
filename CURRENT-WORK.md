# LITMUS — Current Work in Progress

**Branch:** `main`
**Hackathon:** EmpireHacks 2026 — Track 1: The Operator
**Deadline:** Sunday 3/23, 3:00 PM

---

## Judging Rubric (Track 1: The Operator)

| Criteria | Weight | Status |
|---|---|---|
| Agentic Autonomy | 35% | Agentic loop: Claude decides tools, order, retries |
| Tool Use & Integration | 25% | 11 tools (stats, validation, charts, web search) |
| Multimodal & Unstructured | 25% | CSV, TSV, JSON, YAML, paste — auto-detected |
| State & Context Mgmt | 15% | Conversation history across 25-turn agentic loop |

---

## Architecture (Agentic Tool-Use)

LITMUS runs an **autonomous Claude agent** that:
1. **Receives** a dataset and pre-computed statistical overview
2. **Decides** which statistical tools to call and in what order
3. **Calls** tools via Anthropic tool_use API (Claude decides, not a fixed pipeline)
4. **Evaluates** results and decides next steps
5. **Validates** all findings through BH-FDR correction + effect size filtering
6. **Reports** validated discoveries in a structured markdown report

This is NOT a fixed pipeline. Claude autonomously orchestrates the investigation.

---

## What's Built

### Agentic Loop (`app/api/discover/route.ts`)
- **Claude tool_use agentic loop** with MAX_TURNS=25 safety limit
- **SSE streaming**: thinking, tool_call, tool_result, chart, stage, complete events
- Real-time progress via Server-Sent Events
- Model: claude-sonnet-4-6

### 11 Agent Tools (`lib/tools.ts`)
1. `describe_dataset` — Statistical overview (columns, types, distributions)
2. `run_ttest` — Welch's two-sample t-test with Cohen's d
3. `compute_correlation` — Pearson correlation with p-values
4. `detect_simpsons_paradox` — Confounder check with stratification
5. `detect_changepoints` — Structural breaks in time series
6. `detect_anomalies` — Z-score anomaly detection
7. `chi_square_test` — Goodness-of-fit for categorical distributions
8. `compute_entropy` — Shannon entropy of distributions
9. `validate_findings` — BH-FDR correction + effect size filtering (skeptic gauntlet)
10. `generate_chart` — Auto-detected visualizations
11. `web_search` — External research context (Brave/Tavily)

### Statistical Engine (`lib/analysis.ts` — 1,174 lines pure TypeScript)
- All statistical computations run locally (no external APIs for math)
- Real p-values, effect sizes, confidence intervals
- Wrapped as tools Claude can call autonomously

### Validation Gauntlet (`lib/skeptic.ts`)
- Benjamini-Hochberg FDR correction (local math)
- Cohen's d effect size filter (> 0.3 threshold)
- Grading: A (both pass), B (one pass), C (archived)

### Frontend
- **Agentic Timeline**: Shows Claude's reasoning, tool calls, results in real time
- **Collapsible tool results**: Click to expand raw data
- **Inline charts**: Recharts (grouped bar, line, multi-line, forest plot)
- **Final report**: Markdown with copy button
- **5 demo datasets** with distinct color-coded cards
- **File upload**: CSV, JSON, YAML, TSV, TXT
- **Landing page**: "Observe → Decide → Act → Challenge → Loop" flow

### Demo Datasets (5 total in `data/demo-datasets/`)
1. **Simpson's Paradox** — A/B test, 3100 users. B wins overall, A wins every segment.
2. **Startup Metrics** — 18mo SaaS data. Churn spike, enterprise outlier, hidden PMF.
3. **Clinical Trial** — 500 patients, 12 endpoints. 2 real, 3 spurious, multiple-testing trap.
4. **Feature Drift** — 90 days ML monitoring. Gradual drift + pipeline bug.
5. **Grokking Detection** — 100 epoch transformer training. Phase transition.

---

## File Map

```
app/
  page.tsx                        # Landing page + analysis view
  layout.tsx                      # Root layout
  globals.css                     # Tailwind v4 + CSS vars
  api/
    discover/route.ts             # Agentic loop orchestrator (SSE)
    discover-sources/route.ts     # Data source scanner
    export/csv/route.ts           # CSV export
    export/pdf/route.ts           # HTML report export
components/
  DataUpload.tsx                  # File upload + demo picker
  DiscoveryStream.tsx             # Agentic timeline + report
  DiscoveryChart.tsx              # Recharts: bar, line, forest
lib/
  tools.ts                       # 11 tool definitions + executor + system prompt
  analysis.ts                    # Full statistical engine (pure TS)
  skeptic.ts                     # BH-FDR + effect size (local math)
  surprise.ts                    # KL divergence + discovery score
  prompts.ts                     # (legacy, unused)
data/
  demo-datasets/                 # 5 curated datasets
scripts/
  generate-datasets.py           # Reproducible dataset generation (seed=42)
```

---

## Team

| Person | Focus |
|---|---|
| Amadeus | Pipeline architecture, prompts, skeptic gauntlet |
| Sunny | Frontend, visualization, upload flow, datasets |
| Kanishkha | Domain research, experiment design |
| Nirbhaya | Statistical validation, data handling |

---

## Timeline

- **Fri 3/21 (Day 1)**: Kickoff, repo scaffolded, pipeline built
- **Sat 3/22 (Day 2)**: Agentic refactor, tool_use, timeline UI, demo polish
- **Sun 3/23 (Day 3)**: Final polish, submissions due 3:00 PM, demos 4:00 PM
