# LITMUS - Task Board

**EmpireHacks 2026 | Team: Amadeus, Sunny, Kanishkha, Nirbhaya**

## Architecture (v0.2)
Single route (`/api/discover`) streams all 5 pipeline stages via SSE.
Single page app with two components: DataUpload + DiscoveryStream.
No E2B sandbox. No Google Sheets. Claude reasons through everything.

## Tasks

### P0: Must Ship (blocks demo)

#### 1. Test full demo pipeline end-to-end
- Run demo mode, verify all 5 stages stream correctly
- Check that JSON parsing works for each Claude response
- Verify SSE events arrive in correct order on frontend
- **Acceptance:** Click "Run Demo", see all 5 stages complete, report renders

#### 2. Handle API key missing gracefully
- Check for ANTHROPIC_API_KEY on server startup
- Return clear error message if missing
- Show setup instructions on frontend
- **Acceptance:** Clone, forget .env, see helpful error instead of crash

#### 3. Add timeout/error handling for Claude calls
- Wrap each Claude call in try/catch with timeout
- Stream error events to frontend on failure
- Allow partial results (if profile works but hypothesize fails, show profile)
- **Acceptance:** Kill network mid-pipeline, see error message not blank screen

### P1: Should Ship (makes demo compelling)

#### 4. Streaming within Claude calls
- Use Anthropic streaming API to show reasoning tokens as they arrive
- Stream partial text for narration stage
- **Acceptance:** See text appear word-by-word during narration

#### 5. Loss curve visualization
- Parse loss.csv from demo data
- Render a simple chart (CSS-based or SVG) showing train/val loss
- Highlight the grokking phase transition
- **Acceptance:** Visual loss curve visible after profiling stage

#### 6. Loading skeleton states
- Show skeleton/shimmer during each Claude call
- Show stage duration after completion
- **Acceptance:** No blank gaps between stage transitions

#### 7. Drag-and-drop file upload
- Add drag-and-drop zone to DataUpload component
- Visual feedback on drag over
- **Acceptance:** Drag CSV files onto page, pipeline starts

### P2: Nice to Have

#### 8. Multi-round hypothesis refinement
- Re-run hypothesizer with experiment results as context
- Show how hypotheses evolve across rounds
- **Acceptance:** 2+ rounds visible, hypotheses get more specific

#### 9. PDF export of report
- Generate downloadable PDF from final markdown report
- Include validation badges and scores
- **Acceptance:** Click export, get PDF

#### 10. Mobile responsive layout
- Test and fix layout on phone screens
- **Acceptance:** Usable on iPhone Safari

---

## Key Files

- `app/api/discover/route.ts` - Single orchestrator. All 5 stages here.
- `lib/prompts.ts` - All 5 agent prompts. Simplified interfaces.
- `lib/skeptic.ts` - BH-FDR correction + effect size check. Local validation.
- `lib/surprise.ts` - Discovery score ranking. Fully implemented.
- `components/DiscoveryStream.tsx` - Renders the full SSE event stream.
- `components/DataUpload.tsx` - File upload + demo button.
- `data/demo/` - Synthetic nanoGPT training data.

## ENV

```
ANTHROPIC_API_KEY=sk-ant-...
```

That is it. One key.
