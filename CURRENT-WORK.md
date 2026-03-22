# LITMUS — Current Work in Progress

**Branch:** `sunny`  
**Hackathon:** EmpireHacks 2026 — Track 1: The Operator  
**Deadline:** Sunday 3/23, 3:00 PM  

---

## Judging Rubric (Track 1: The Operator)

| Criteria | Weight | Status |
|---|---|---|
| Agentic Autonomy | 35% | 🟡 Pipeline works, needs error recovery + replanning |
| Tool Use & Integration | 25% | 🟡 Real stats work, needs export + external system push |
| Multimodal & Unstructured | 25% | 🔴 Only clean CSVs, needs messy input + multi-source |
| State & Context Mgmt | 15% | 🟢 Pipeline passes context across all 5 stages |

---

## What's Built ✅

### Core Pipeline
- **5-stage discovery loop**: Profiler → Hypothesizer → Experimenter → Skeptic → Narrator
- **SSE streaming**: All stages stream progress to the frontend in real time
- **Single API route**: `/api/discover` orchestrates everything

### Statistical Engine (`lib/analysis.ts`)
- Changepoint detection (sliding window std-dev ratio)
- Z-score anomaly detection (rolling window)
- Shannon entropy
- Pearson correlation with p-values (t-distribution)
- Welch's two-sample t-test with Cohen's d
- Chi-square goodness-of-fit
- Simpson's Paradox detection (auto-stratification)
- Full analysis suite: runs all tests, passes real numbers to Claude

### Computed Surprise Scores (`lib/surprise.ts`)
- KL divergence between observed vs expected distributions
- Group comparison surprise (binned histogram KL)
- Correlation surprise (vs dataset median)
- Simpson's Paradox gets automatic 0.8+ surprise
- Changepoint surprise (pre/post distribution KL)
- Overrides Claude's subjective guess when matched

### Validation Gauntlet (`lib/skeptic.ts`)
- Check 1: Benjamini-Hochberg FDR correction (local math)
- Check 2: Confounder Scan (Claude reasoning)
- Check 3: Temporal Stability (Claude reasoning)
- Check 4: Holdout Replication (Claude reasoning)
- Check 5: Effect Size filter, Cohen's d > 0.3 (local math)
- Grading: A (5/5), B (4/5), C (< 4, archived)

### Inline Charts (`components/DiscoveryChart.tsx`)
- Grouped bar charts (A/B test conversion by segment)
- Time-series line charts with changepoint markers + anomaly dots
- Multi-line charts (dual train/val loss curves for grokking)
- Forest plots (effect sizes across endpoints, color-coded)
- Dark theme, Recharts, responsive

### Demo Datasets (5 total in `data/demo-datasets/`)
1. **Simpson's Paradox** — A/B test, 3100 users. B wins overall, A wins every segment.
2. **Startup Metrics** — 18mo SaaS data. Churn spike, enterprise outlier, hidden PMF signal.
3. **Clinical Trial** — 500 patients, 12 endpoints. 2 real effects, 3 spurious, 1 tiny.
4. **Feature Drift** — 90 days ML monitoring. Gradual drift + pipeline bug.
5. **Grokking Detection** — 100 epoch transformer training. Phase transition, head specialization.

### Prompts (`lib/prompts.ts`)
- All 5 prompts domain-agnostic (work on any structured CSV)
- Anti-hallucination guardrails: "report ONLY what you can verify from the data"
- Experimenter uses real computed stats, not Claude guesses
- Skeptic calibrated: "FAIL only with concrete evidence"

### Frontend
- Dataset picker with 5 clickable cards
- File upload (CSV, JSON, YAML, TSV)
- Pipeline timeline with stage indicators
- Hypothesis cards, experiment results, validation badges
- Final markdown report with copy button

---

## Currently Building 🔨

### Feature 1: Export (CSV + Styled Report)
**Why:** Rubric says "produces a finished deliverable within an external system"

- `app/api/export/csv/route.ts` — Download findings as clean CSV
- `app/api/export/pdf/route.ts` — Download styled HTML report with LITMUS branding
- Export buttons in DiscoveryStream after report renders
- Columns: Rank, Finding, Grade, Surprise, P-Value, Effect Size, Checks, Interpretation

### Feature 2: Sub-Agent Error Recovery + Dynamic Replanning
**Why:** Rubric says "unblocks itself appropriately" (Agentic Autonomy, 35%)

- Retry wrapper on Claude calls (2 retries, exponential backoff)
- Graceful fallbacks when JSON parsing fails
- **Dynamic replanning**: If first round finds nothing (all p > 0.1), auto-trigger second hypothesis round with "generate more creative hypotheses exploring interactions, non-linear patterns, subgroup effects"
- SSE events for sub-agent spawning: "spawning targeted analysis..."
- Shows the agent adapting, not just running a fixed script

### Feature 3: Paste Input + Better Format Handling
**Why:** Rubric says "handles messy real-world edge cases" (Multimodal, 25%)

- Text area in DataUpload: "Or paste your data"
- Auto-detect CSV, TSV, JSON, space-delimited
- Accept JSON files, auto-flatten to tabular
- Better NaN/missing value handling in analysis.ts
- Handle CSVs with mixed types

### Feature 4: Data Source Discovery (Virtual MCP)
**Why:** Rubric says "integrates different sources or formats of information"

- `app/api/discover-sources/route.ts` — Scan available data sources
- `lib/mcp-discovery.ts` — Schema explorer, auto-sampler, cross-dataset hypotheses
- Virtual MCP mode: treats `data/demo-datasets/` as a connected database
- "Discover Data Sources" button in UI
- Select multiple datasets for cross-dataset analysis
- Find common columns, correlations between different datasets
- Demonstrates autonomous exploration of an environment

### Feature 5: Google Sheets Push
**Why:** Original pitch doc feature. Shows external system integration.

- `lib/sheets.ts` — Push findings + report to Google Sheets
- Auto-creates sheet with Findings tab + Report tab
- Runs after narrator stage, sends SSE event with sheet URL
- Graceful skip if no credentials configured
- Env vars: `GOOGLE_SHEETS_CREDENTIALS`, `GOOGLE_SHEET_ID`

---

## Known Issues 🐛

- **p = 0.5 on some findings**: Stats flow improved but Claude sometimes ignores computed values
- **Hallucinated data quality issues**: Guardrails added but Claude may still invent patterns
- **Gauntlet calibration**: May still kill valid findings (all Grade C on some runs)
- **No mobile responsive layout**: Desktop only for now
- **No streaming within Claude calls**: Tokens arrive all at once, not word-by-word
- **Grokking prompts**: General prompts work but don't have ML-specific analysis depth

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
- **Sat 3/22 (Day 2)**: Features build, demo datasets, charts, exports
- **Sun 3/23 (Day 3)**: Final polish, submissions due 3:00 PM, demos 4:00 PM

---

## File Map

```
app/
  page.tsx                        # Single page: upload → stream results
  layout.tsx                      # Root layout
  globals.css                     # Tailwind + CSS vars
  api/
    discover/route.ts             # Core orchestrator: 5 stages via SSE
    discover-sources/route.ts     # [BUILDING] Data source scanner
    export/csv/route.ts           # [BUILDING] CSV export
    export/pdf/route.ts           # [BUILDING] HTML report export
components/
  DataUpload.tsx                  # File upload + demo picker + paste area
  DiscoveryStream.tsx             # Pipeline timeline + results + report
  DiscoveryChart.tsx              # Recharts: bar, line, multi-line, forest
lib/
  prompts.ts                      # 5 Claude prompt templates
  skeptic.ts                      # BH-FDR + effect size (local math)
  surprise.ts                     # KL divergence + discovery score
  analysis.ts                     # Full statistical engine (pure TS)
  sheets.ts                       # [BUILDING] Google Sheets push
  mcp-discovery.ts                # [BUILDING] Data source discovery
data/
  demo/                           # Legacy transformer training data
  demo-datasets/
    simpsons-paradox/             # A/B test with Simpson's Paradox
    startup-metrics/              # SaaS growth data
    clinical-trial/               # Multi-endpoint RCT
    feature-drift/                # ML monitoring data
    grokking/                     # Transformer training run
scripts/
  generate-datasets.py            # Reproducible dataset generation (seed=42)
```
