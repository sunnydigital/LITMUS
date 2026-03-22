# Demo Datasets

Each dataset is designed to showcase specific LITMUS capabilities. They contain real statistical phenomena that LITMUS should detect, validate, and in some cases debunk.

## 1. Simpson's Paradox (`simpsons-paradox/`)
**Showcases: Skeptic Gauntlet Check #3 (Simpson's Paradox), Confounder Scan**

A/B test results for a product feature. Overall, Treatment B looks better. But when you stratify by user segment, Treatment A wins in every single group. Classic Simpson's Paradox caused by unequal group sizes.

- LITMUS should initially find "B is better" → then the Skeptic should catch the paradox → Grade C
- A second finding (the real one) should emerge from stratified analysis → Grade A
- **This is the "killer demo"** — it shows LITMUS catching something most analysts miss

## 2. Startup Metrics (`startup-metrics/`)
**Showcases: Changepoint Detection, Surprise Scoring, Temporal Stability**

18 months of startup SaaS metrics: MRR, churn, CAC, LTV, signups. Contains:
- A hidden churn spike that correlates with a pricing change (confounder)
- MRR growth that looks organic but is actually driven by a single enterprise contract (outlier)
- A "vanity metric" (signups) that's inversely correlated with actual revenue per user
- Genuine product-market fit signal buried in the noise

## 3. Clinical Trial (`clinical-trial/`)
**Showcases: Multiple Testing Correction (BH-FDR), Effect Size Filter, Holdout Replication**

Simulated multi-endpoint clinical trial data. 500 patients, treatment vs placebo, 12 measured outcomes. Contains:
- 2 real treatment effects (genuine drug response)
- 3 spurious correlations that won't survive FDR correction
- 1 finding with statistical significance (p < 0.01) but trivially small effect size (Cohen's d = 0.15) — should fail Check #5
- Perfect for showing "we tested 12 things, only 2 are real, here's the math"

## 4. Feature Drift (`feature-drift/`)
**Showcases: Z-Score Anomalies, Temporal Windows, the full pipeline on ML-adjacent data**

ML model monitoring data: prediction confidence, feature distributions, accuracy metrics over 90 days in production. Contains:
- Gradual feature drift starting day 45 (distribution shift in 2 of 8 features)
- A sudden accuracy drop at day 60 that's actually caused by a data pipeline bug, not model degradation
- Correlation between upstream data freshness and prediction quality
- Shows LITMUS working on the "ops" side of data science, not just analysis
