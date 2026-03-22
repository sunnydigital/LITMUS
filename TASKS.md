# LITMUS - Task Board

**EmpireHacks 2026 | Team: Amadeus, Sunny, Kanishkha, Nirbhaya**

## Current Pipeline

1. Click "Run Demo" (or upload CSVs)
2. Claude profiles the data (JSON output)
3. Claude generates 3-5 hypotheses about training dynamics
4. For each hypothesis: run numerical analysis locally, Claude interprets results
5. Validation: BH-FDR correction + effect size threshold (local) + Claude reasoning checks
6. Claude writes final discovery report in markdown
7. Everything streams to frontend via SSE

Step 4 needs `lib/analysis.ts` built (Task #2) to run real computations.

## Tasks

### P0: Must Ship (blocks demo)

#### 1. Test full demo pipeline end-to-end
- Run demo mode, verify all 5 stages stream correctly
- Check that JSON parsing works for each Claude response
- Verify SSE events arrive in correct order on frontend
- **Acceptance:** Click "Run Demo", see all 5 stages complete, report renders
- **File:** `app/api/discover/route.ts` (read the whole thing, it's the core)

#### 2. Add real numerical analysis (THE critical upgrade)
This is what separates "Claude writes a story about statistics" from "tool discovers, then Claude explains."

Create `lib/analysis.ts` with these functions. All operate on parsed CSV data (arrays of numbers):

- **`detectChangepoints(series: number[], threshold?: number)`** - Find where loss curve or gradient norms shift sharply. Simple approach: sliding window of std dev, flag where ratio of adjacent windows exceeds threshold. Returns epoch indices.
- **`zScoreAnomalies(series: number[], window?: number)`** - Rolling z-score. Flag epochs where |z| > 2.5. For gradient spike detection.
- **`computeEntropy(distribution: number[])`** - Shannon entropy of attention weights per head. Track over epochs to detect specialization.
- **`pearsonCorrelation(x: number[], y: number[])`** - Correlation between two time series. For testing "does X predict Y?"
- **`twoSampleTTest(a: number[], b: number[])`** - Compare distributions before/after a suspected transition point. Returns real p-value and Cohen's d.

Then update `app/api/discover/route.ts` to:
1. Parse the CSV data into typed arrays before calling Claude
2. Run these functions on the parsed data during the EXPERIMENTER stage
3. Pass real numbers (changepoints, z-scores, p-values, correlations) to Claude
4. Let Claude interpret and narrate the real results instead of inventing them

**Acceptance:** The experimenter stage produces p-values computed from actual data, not Claude's estimates. The BH-FDR correction runs on real p-values.

**Files:**
- Create: `lib/analysis.ts`
- Modify: `app/api/discover/route.ts` (experimenter section, ~lines 120-175)
- Modify: `lib/prompts.ts` (experimenterPrompt needs to receive real test results)

#### 3. Make the skeptic kill at least one finding
A system that validates everything validates nothing. During demo, at least one hypothesis should fail validation and get archived with a Grade C.

Options:
- Tune the effect size threshold in `lib/skeptic.ts` so marginal findings fail
- Add a hypothesis in the demo flow that's designed to be debunked (e.g., "weight norms predict loss independently of gradient norms" - they don't in the synthetic data, they're correlated)
- Make the BH-FDR stricter (lower q value)

**Acceptance:** Demo run produces at least one Grade C finding with a clear "FAIL" badge visible on screen. The narrator explains why it failed.

**Files:**
- `lib/skeptic.ts` (thresholds)
- `lib/prompts.ts` (hypothesizerPrompt - could bias toward generating one weak hypothesis)
- `app/api/discover/route.ts` (validation section)

#### 4. Handle API key missing gracefully
- Check for ANTHROPIC_API_KEY on server startup
- Return clear error message if missing
- Show setup instructions on frontend
- **Acceptance:** Clone, forget .env, see helpful error instead of crash

#### 5. Add timeout/error handling for Claude calls
- Wrap each Claude call in try/catch with timeout
- Stream error events to frontend on failure
- Allow partial results (if profile works but hypothesize fails, show profile)
- **Acceptance:** Kill network mid-pipeline, see error message not blank screen

### P1: Should Ship (makes demo compelling)

#### 6. Loss curve visualization
- Parse loss.csv from demo data
- Render a chart (Recharts, SVG, or CSS-based) showing train/val loss over epochs
- Highlight the grokking phase transition region (epoch 45-50)
- Mark gradient spike epochs with vertical lines
- **Acceptance:** Visual loss curve appears after profiling stage completes
- **File:** New component, imported into `DiscoveryStream.tsx`

#### 7. Streaming within Claude calls
- Use Anthropic streaming API to show tokens as they arrive
- Especially important for the narration stage (longest Claude call)
- **Acceptance:** See text appear word-by-word during narration
- **File:** `app/api/discover/route.ts` (change `client.messages.create` to `client.messages.stream`)

#### 8. Loading skeleton states
- Show skeleton/shimmer during each Claude call (they take 5-15 seconds)
- Show stage duration after completion
- **Acceptance:** No blank gaps between stage transitions
- **File:** `components/DiscoveryStream.tsx`

#### 9. Drag-and-drop file upload
- Add drag-and-drop zone to DataUpload component
- Visual feedback on drag over
- **Acceptance:** Drag CSV files onto page, pipeline starts
- **File:** `components/DataUpload.tsx`

### P2: Nice to Have

#### 10. PDF export of discovery report
- Generate downloadable PDF from final markdown report
- **Acceptance:** Click export, get PDF

#### 11. Mobile responsive layout
- **Acceptance:** Usable on phone screens

---

## Key Files (read these first)

| File | What It Does | Lines |
|---|---|---|
| `app/api/discover/route.ts` | **THE core file.** Single orchestrator, all 5 stages, SSE streaming. | ~330 |
| `lib/prompts.ts` | All 5 Claude prompt templates. This is where domain knowledge lives. | ~130 |
| `lib/skeptic.ts` | BH-FDR correction + effect size check. Real math. | ~80 |
| `lib/surprise.ts` | KL divergence + discovery score ranking. Real math. | ~80 |
| `components/DiscoveryStream.tsx` | Renders SSE events: timeline, hypotheses, experiments, validation, report. | ~310 |
| `components/DataUpload.tsx` | File picker + "Run Demo" button. Simple. | ~small |
| `app/page.tsx` | SSE client, state management, layout. | ~180 |
| `data/demo/loss.csv` | 100 epochs of synthetic training loss with grokking. | CSV |
| `data/demo/metrics.csv` | Gradient norms, attention entropy, weight norms per epoch. | CSV |

## Domain Context

LITMUS analyzes what happens during transformer model training. Key phenomena:

- **Grokking:** Model memorizes training data first, then suddenly generalizes much later. Train loss drops early, val loss stays flat, then drops sharply.
- **Phase transitions:** Sudden capability jumps. Loss curve has plateaus that break abruptly.
- **Head specialization:** Attention heads start uniform, then specialize. Visible as entropy divergence across heads.
- **Gradient spikes:** Gradient norm jumps, often 2-3 epochs before a phase transition.

Our synthetic demo data has all four patterns baked in.
