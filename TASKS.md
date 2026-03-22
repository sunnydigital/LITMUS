# LITMUS - Open Tasks

**EmpireHacks 2026 | Operator Track | Team: Amadeus, Sunny, Kanishkha, Nirbhaya**

## Concept Pivot (READ FIRST)

The original LITMUS pitch targeted generic tabular data (CSVs, hospital readmissions, etc.). We've pivoted the domain to **transformer training dynamics**. Same 5-stage pipeline, radically more interesting target.

**What changed from the HTML pitch:**
- Input is now training artifacts (weight snapshots, loss CSVs, attention maps, gradient logs) instead of generic CSVs
- Hypotheses are about transformer internals (phase transitions, head specialization, grokking, emergent algorithms) instead of generic correlations
- Experimenter runs torch probing classifiers and ablation studies instead of just scipy tests
- Demo uses NanoGPT training artifacts instead of hospital data

**What stayed the same:**
- 5-stage pipeline: Profiler > Hypothesizer > Experimenter > Skeptic > Narrator
- Skeptic gauntlet (5 checks, A/B/C grading)
- Surprise score ranking (KL x significance x effect_size)
- Google Sheets push (Operator track requirement)
- SSE streaming for real-time reasoning display

---

## Task Breakdown

### P0: Must Ship (blocks demo)

#### 1. Wire Profiler agent [Amadeus]
- Connect `/api/profile` to Anthropic SDK
- SSE streaming response
- Parse uploaded training artifacts (loss CSVs, config JSONs)
- Return structured profile (epochs, architecture, trajectory, anomalies)
- **Acceptance:** Upload a loss.csv, get back JSON profile with epoch count and anomaly detection

#### 2. Wire Hypothesizer agent [Amadeus]
- Connect `/api/hypothesize` to Anthropic SDK
- Takes profile output + prior experiment results
- Returns ranked hypotheses with surprise scores
- Implements feedback loop (experiment results feed back in)
- **Acceptance:** Given a profile, returns 3-7 testable hypotheses ranked by info gain

#### 3. Wire Experimenter agent [Kanishkha or TBD]
- Connect `/api/experiment` to Anthropic SDK + E2B sandbox
- Claude generates Python test script
- Script executes in E2B (scipy, torch, statsmodels, plotly)
- Parse p-value, effect size, plot from output
- **Acceptance:** Given a hypothesis, generates and runs a statistical test, returns structured result with Plotly chart

#### 4. Wire Skeptic gauntlet [Amadeus]
- Connect `/api/validate` to Anthropic SDK for checks 2-4
- Checks 1 (FDR) and 5 (effect size) already implemented in `lib/skeptic.ts`
- Claude evaluates confounders, temporal stability, holdout design
- Assign A/B/C grade
- **Acceptance:** Given experiment results, returns 5 check results and a grade

#### 5. Wire Narrator agent [Sunny]
- Connect `/api/narrate` to Anthropic SDK
- SSE streaming markdown report
- Include Plotly figure references
- Push summary to Google Sheets
- **Acceptance:** Validated findings in, markdown report out, pushed to Sheets

#### 6. Frontend: Discovery stream UI [Sunny]
- Real-time display of pipeline stages (profiling... hypothesizing... experimenting...)
- Show hypothesis tree (active branches, dead branches grayed out)
- Embed Plotly charts from experiment results
- Show skeptic gauntlet results (pass/fail badges)
- **Acceptance:** User sees live pipeline progress and can follow reasoning

#### 7. Demo data: NanoGPT training artifacts [Kanishkha or TBD]
- Generate or source training artifacts from a small NanoGPT run:
  - loss.csv (train_loss, val_loss, epoch)
  - Gradient norm log
  - Attention entropy per head per epoch (can be synthetic/simulated)
  - Model config JSON
- Does NOT need to be real training data. Synthetic is fine for demo.
- **Acceptance:** A complete set of artifacts that produces interesting discoveries when fed to LITMUS

### P1: Should Ship (makes demo compelling)

#### 8. Plotly chart rendering in frontend [Sunny]
- Parse Plotly JSON from experiment results
- Render interactive charts in ExperimentResult component
- **Acceptance:** Charts visible and interactive in browser

#### 9. Google Sheets integration [TBD]
- Wire googleapis SDK
- Push discovery summaries (title, grade, surprise score, p-value) to a Google Sheet
- Satisfies Operator track requirement for external system integration
- **Acceptance:** After pipeline runs, a Google Sheet populates with findings

#### 10. Feedback loop visualization [Sunny]
- Show how experiment results feed back into hypothesizer
- Animate hypothesis tree growth/pruning
- **Acceptance:** Visible feedback loop in UI

### P2: Nice to Have

#### 11. Multi-round discovery
- Run pipeline for 2-3 rounds (each round generates new hypotheses from prior results)
- Show convergence: hypothesis quality improves each round

#### 12. Directed testing mode
- User provides a specific hypothesis ("Is there a phase transition at epoch X?")
- Pipeline skips hypothesizer, goes straight to experimenter

#### 13. Training artifact parsing
- Auto-detect .pt file structure (weight shapes, layer count)
- Extract attention patterns from saved model checkpoints
- This is hard and may not be needed for demo (synthetic data works)

---

## Architecture Notes for Team

### How the pipeline flows (code path):

```
1. User uploads files -> DataUpload.tsx -> FormData POST to /api/profile
2. /api/profile -> profilerPrompt() -> Claude -> structured profile JSON
3. Profile JSON -> POST to /api/hypothesize
4. /api/hypothesize -> hypothesizerPrompt() -> Claude -> ranked hypotheses
5. Top hypothesis -> POST to /api/experiment
6. /api/experiment -> experimenterPrompt() -> Claude generates Python code -> E2B executes -> results
7. Results -> POST to /api/validate
8. /api/validate -> skepticPrompt() + runGauntlet() -> grade
9. All graded findings -> POST to /api/narrate
10. /api/narrate -> narratorPrompt() -> Claude -> markdown report + Google Sheets push
11. Steps 3-8 repeat (feedback loop): experiment results feed back into hypothesizer
```

### Key files to understand:

- `lib/prompts.ts` - All 5 agent prompts. Read these first.
- `lib/skeptic.ts` - BH-FDR correction and gauntlet runner. Check 1 and 5 are implemented.
- `lib/surprise.ts` - Scoring and ranking. Fully implemented.
- `lib/sandbox.ts` - E2B stub. Needs to be wired to real SDK.
- `app/page.tsx` - Main UI state management. All components wired here.

### ENV vars needed:
```
ANTHROPIC_API_KEY    - Claude API (Amadeus has this)
E2B_API_KEY          - Code interpreter sandbox
GOOGLE_SHEETS_API_KEY - For output push
GOOGLE_SHEETS_SPREADSHEET_ID - Target sheet
```

---

## Communication

Amadeus will be at Grayscale (Fordham) working on Lunatic Eyes. Available async via Discord/text. Push to main freely. Tag in Discord if blocked.
