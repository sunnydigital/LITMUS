"""
Generate demo datasets for LITMUS with real statistical phenomena baked in.
Each dataset has documented patterns that the pipeline should discover.
"""

import csv
import json
import random
import math
import os

random.seed(42)

BASE = os.path.join(os.path.dirname(__file__), "..", "data", "demo-datasets")


def normal(mu, sigma):
    """Box-Muller transform for normal distribution."""
    u1 = random.random()
    u2 = random.random()
    z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
    return mu + sigma * z


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


# =============================================================================
# DATASET 1: Simpson's Paradox - A/B Test
# =============================================================================
def generate_simpsons_paradox():
    """
    A/B test where Treatment B looks better overall,
    but Treatment A wins in every segment.
    
    The trick: B is disproportionately assigned to the high-converting segment.
    
    Segments:
      - Mobile (low base conversion ~5%)
      - Desktop (medium ~12%)  
      - Enterprise (high ~35%)
    
    Treatment A: +2% lift in every segment
    Treatment B: 0% lift (no effect), but assigned 60% to Enterprise
    
    Overall B looks better because of Simpson's Paradox.
    """
    out_dir = os.path.join(BASE, "simpsons-paradox")
    os.makedirs(out_dir, exist_ok=True)
    
    rows = []
    
    segments = {
        "mobile":     {"base_rate": 0.05, "a_lift": 0.04, "a_n": 1200, "b_n": 150},
        "desktop":    {"base_rate": 0.12, "a_lift": 0.05, "a_n": 800,  "b_n": 200},
        "enterprise": {"base_rate": 0.35, "a_lift": 0.06, "a_n": 100,  "b_n": 650},
    }
    
    uid = 1
    for segment, cfg in segments.items():
        # Treatment A users
        for _ in range(cfg["a_n"]):
            converted = 1 if random.random() < (cfg["base_rate"] + cfg["a_lift"]) else 0
            rows.append({
                "user_id": uid,
                "segment": segment,
                "treatment": "A",
                "converted": converted,
                "session_duration_sec": round(normal(180 if segment == "enterprise" else 90, 40), 1),
                "pages_viewed": max(1, round(normal(5 if segment == "enterprise" else 3, 1.5))),
            })
            uid += 1
        
        # Treatment B users (no actual lift)
        for _ in range(cfg["b_n"]):
            converted = 1 if random.random() < cfg["base_rate"] else 0
            rows.append({
                "user_id": uid,
                "segment": segment,
                "treatment": "B",
                "converted": converted,
                "session_duration_sec": round(normal(180 if segment == "enterprise" else 90, 40), 1),
                "pages_viewed": max(1, round(normal(5 if segment == "enterprise" else 3, 1.5))),
            })
            uid += 1
    
    random.shuffle(rows)
    
    with open(os.path.join(out_dir, "ab_test.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["user_id", "segment", "treatment", "converted", "session_duration_sec", "pages_viewed"])
        w.writeheader()
        w.writerows(rows)
    
    with open(os.path.join(out_dir, "config.json"), "w") as f:
        json.dump({
            "experiment": "checkout_flow_ab_test",
            "description": "A/B test of new checkout flow (Treatment B) vs control (Treatment A)",
            "duration_days": 14,
            "total_users": len(rows),
            "segments": ["mobile", "desktop", "enterprise"],
            "primary_metric": "converted",
            "hidden_phenomena": ["simpsons_paradox", "confounded_segment_allocation"]
        }, f, indent=2)
    
    print(f"  Simpson's Paradox: {len(rows)} rows")
    
    # Print verification
    for seg in segments:
        a_users = [r for r in rows if r["segment"] == seg and r["treatment"] == "A"]
        b_users = [r for r in rows if r["segment"] == seg and r["treatment"] == "B"]
        a_rate = sum(r["converted"] for r in a_users) / len(a_users)
        b_rate = sum(r["converted"] for r in b_users) / len(b_users)
        print(f"    {seg}: A={a_rate:.3f} B={b_rate:.3f} (A {'wins' if a_rate > b_rate else 'loses'})")
    
    all_a = [r for r in rows if r["treatment"] == "A"]
    all_b = [r for r in rows if r["treatment"] == "B"]
    a_overall = sum(r["converted"] for r in all_a) / len(all_a)
    b_overall = sum(r["converted"] for r in all_b) / len(all_b)
    print(f"    OVERALL: A={a_overall:.3f} B={b_overall:.3f} (B {'wins' if b_overall > a_overall else 'loses'} overall)")


# =============================================================================
# DATASET 2: Startup SaaS Metrics
# =============================================================================
def generate_startup_metrics():
    """
    18 months of SaaS metrics with hidden patterns:
    - Month 8: pricing change causes churn spike (confounder)
    - Month 11: single enterprise deal inflates MRR (outlier)
    - Signups inversely correlated with revenue per user
    - Real PMF signal: activation rate steadily improves months 10-18
    """
    out_dir = os.path.join(BASE, "startup-metrics")
    os.makedirs(out_dir, exist_ok=True)
    
    rows = []
    mrr = 12000
    signups = 150
    churn_rate = 0.05
    cac = 85
    activation_rate = 0.20
    
    for month in range(1, 19):
        # Organic growth with noise
        signups_actual = round(signups + normal(0, 15))
        
        # Month 6-9: marketing push inflates signups but low quality
        if 6 <= month <= 9:
            signups_actual = round(signups_actual * 1.8)
        
        # Churn spike at month 8 (correlates with pricing change)
        if month == 8:
            churn_actual = churn_rate + 0.04
        elif month == 9:
            churn_actual = churn_rate + 0.02
        else:
            churn_actual = churn_rate + normal(0, 0.005)
        churn_actual = clamp(churn_actual, 0.01, 0.20)
        
        # MRR: organic growth
        mrr = mrr * (1 + 0.08 + normal(0, 0.02)) * (1 - churn_actual)
        
        # Month 11: single enterprise contract adds $15k
        enterprise_bump = 15000 if month == 11 else 0
        mrr_reported = round(mrr + enterprise_bump, 2)
        
        # Revenue per user trends down during marketing push
        active_users = max(1, round(mrr / 50 + normal(0, 10)))
        rev_per_user = round(mrr_reported / active_users, 2)
        
        # Activation rate: genuine PMF signal emerges month 10+
        if month >= 10:
            activation_rate = min(0.55, activation_rate + 0.03 + normal(0, 0.005))
        else:
            activation_rate = 0.20 + normal(0, 0.02)
        activation_rate = clamp(activation_rate, 0.10, 0.60)
        
        # LTV estimate
        ltv = round(rev_per_user / max(churn_actual, 0.01), 2)
        
        # CAC increases during marketing push
        if 6 <= month <= 9:
            cac_actual = round(cac * 1.5 + normal(0, 10), 2)
        else:
            cac_actual = round(cac + normal(0, 8), 2)
        
        rows.append({
            "month": month,
            "mrr": mrr_reported,
            "signups": signups_actual,
            "churn_rate": round(churn_actual, 4),
            "cac": cac_actual,
            "ltv": ltv,
            "ltv_cac_ratio": round(ltv / max(cac_actual, 1), 2),
            "activation_rate": round(activation_rate, 4),
            "active_users": active_users,
            "rev_per_user": rev_per_user,
        })
        
        # Slow organic signup growth
        signups += 8
    
    with open(os.path.join(out_dir, "metrics.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    
    with open(os.path.join(out_dir, "config.json"), "w") as f:
        json.dump({
            "company": "Synthetic SaaS Startup",
            "description": "18 months of key SaaS metrics from seed to Series A",
            "metrics_tracked": list(rows[0].keys()),
            "events": {
                "month_6": "Launched paid marketing campaign",
                "month_8": "Pricing change: $29/mo → $39/mo",
                "month_11": "Closed first enterprise deal ($15k/mo)",
                "month_10": "Shipped onboarding redesign"
            },
            "hidden_phenomena": [
                "churn_spike_correlates_with_pricing_change",
                "enterprise_outlier_inflates_mrr",
                "signups_inversely_correlated_with_rev_per_user",
                "genuine_pmf_signal_in_activation_rate"
            ]
        }, f, indent=2)
    
    print(f"  Startup Metrics: {len(rows)} rows, 10 features")


# =============================================================================
# DATASET 3: Clinical Trial (Multi-Endpoint)
# =============================================================================
def generate_clinical_trial():
    """
    500 patients, treatment vs placebo, 12 measured outcomes.
    - Outcomes 3, 7: real treatment effects (d ≈ 0.5-0.6)
    - Outcomes 1, 5, 10: spurious p < 0.05 by chance (won't survive FDR)
    - Outcome 9: significant p-value but trivial effect size (d ≈ 0.15)
    - Rest: null effects
    """
    out_dir = os.path.join(BASE, "clinical-trial")
    os.makedirs(out_dir, exist_ok=True)
    
    n_patients = 500
    n_treatment = 250
    n_placebo = 250
    
    # Define 12 outcome variables
    outcomes = {
        "blood_pressure_systolic":  {"placebo_mu": 140, "placebo_sd": 15, "tx_shift": 0,    "real": False},
        "blood_pressure_diastolic": {"placebo_mu": 88,  "placebo_sd": 10, "tx_shift": 0,    "real": False},
        "ldl_cholesterol":          {"placebo_mu": 130, "placebo_sd": 25, "tx_shift": -12,  "real": True},   # outcome 3: REAL
        "hdl_cholesterol":          {"placebo_mu": 50,  "placebo_sd": 12, "tx_shift": 0,    "real": False},
        "triglycerides":            {"placebo_mu": 150, "placebo_sd": 40, "tx_shift": 0,    "real": False},
        "fasting_glucose":          {"placebo_mu": 100, "placebo_sd": 15, "tx_shift": 0,    "real": False},
        "hba1c":                    {"placebo_mu": 5.8, "placebo_sd": 0.5,"tx_shift": -0.3, "real": True},   # outcome 7: REAL
        "crp_inflammation":         {"placebo_mu": 3.0, "placebo_sd": 2.0,"tx_shift": 0,    "real": False},
        "liver_alt":                {"placebo_mu": 30,  "placebo_sd": 10, "tx_shift": 1.5,  "real": False},  # outcome 9: sig but tiny effect
        "kidney_egfr":              {"placebo_mu": 90,  "placebo_sd": 15, "tx_shift": 0,    "real": False},
        "bmi":                      {"placebo_mu": 28,  "placebo_sd": 4,  "tx_shift": 0,    "real": False},
        "quality_of_life_score":    {"placebo_mu": 65,  "placebo_sd": 12, "tx_shift": 0,    "real": False},
    }
    
    rows = []
    for i in range(n_patients):
        is_treatment = i < n_treatment
        age = round(normal(55, 10))
        age = clamp(age, 25, 80)
        sex = random.choice(["M", "F"])
        
        row = {
            "patient_id": i + 1,
            "group": "treatment" if is_treatment else "placebo",
            "age": age,
            "sex": sex,
        }
        
        for name, cfg in outcomes.items():
            base = normal(cfg["placebo_mu"], cfg["placebo_sd"])
            
            if is_treatment:
                base += cfg["tx_shift"]
            
            # Add age as mild confounder for some outcomes
            if name in ["blood_pressure_systolic", "blood_pressure_diastolic", "fasting_glucose"]:
                base += (age - 55) * 0.3
            
            row[name] = round(base, 2)
        
        rows.append(row)
    
    # Manually inject a few spurious p<0.05 hits by shifting a small subset
    # This simulates the "test 12 things, some will be significant by chance" problem
    # Outcomes 1 (bp_sys), 5 (triglycerides), 10 (kidney_egfr): nudge treatment group slightly
    for i in range(n_treatment):
        rows[i]["blood_pressure_systolic"] -= normal(2.5, 1)     # small nudge, border significance
        rows[i]["triglycerides"] -= normal(6, 2)                  # small nudge
        rows[i]["kidney_egfr"] += normal(2, 1)                    # small nudge
    
    random.shuffle(rows)
    
    fieldnames = ["patient_id", "group", "age", "sex"] + list(outcomes.keys())
    
    with open(os.path.join(out_dir, "trial_results.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    
    with open(os.path.join(out_dir, "config.json"), "w") as f:
        json.dump({
            "trial": "Synthetic Phase III - Cardiovascular",
            "description": "500-patient RCT with 12 measured endpoints. Treatment vs placebo.",
            "n_treatment": n_treatment,
            "n_placebo": n_placebo,
            "primary_endpoints": ["ldl_cholesterol", "hba1c"],
            "secondary_endpoints": [k for k in outcomes if k not in ["ldl_cholesterol", "hba1c"]],
            "hidden_phenomena": [
                "2_real_effects_ldl_and_hba1c",
                "3_spurious_significances_wont_survive_fdr",
                "1_significant_but_trivial_effect_size_liver_alt",
                "age_confounds_blood_pressure_and_glucose",
                "multiple_testing_problem_12_endpoints"
            ]
        }, f, indent=2)
    
    print(f"  Clinical Trial: {len(rows)} patients, 12 outcomes")


# =============================================================================
# DATASET 4: Feature Drift (ML Monitoring)
# =============================================================================
def generate_feature_drift():
    """
    90 days of ML model monitoring in production.
    - Day 45+: gradual drift in features 2 and 5
    - Day 60: sudden accuracy drop from data pipeline bug (not model degradation)
    - Correlation between data freshness and prediction quality
    """
    out_dir = os.path.join(BASE, "feature-drift")
    os.makedirs(out_dir, exist_ok=True)
    
    rows = []
    
    for day in range(1, 91):
        # Base accuracy: 0.92 with noise
        accuracy = 0.92 + normal(0, 0.008)
        
        # 8 features with stable distributions initially
        features = {}
        for feat_idx in range(8):
            mean = 0.0
            std = 1.0
            
            # Features 2 and 5: gradual drift starting day 45
            if feat_idx in [2, 5] and day >= 45:
                drift = (day - 45) * 0.015  # slow linear drift
                mean += drift
                std *= (1 + drift * 0.1)
            
            features[f"feature_{feat_idx}_mean"] = round(normal(mean, 0.05), 4)
            features[f"feature_{feat_idx}_std"] = round(abs(normal(std, 0.05)), 4)
        
        # Day 60-63: data pipeline bug (stale data, accuracy tanks)
        data_freshness_hours = round(abs(normal(2, 0.5)), 1)
        if 60 <= day <= 63:
            data_freshness_hours = round(abs(normal(36, 8)), 1)  # data is 36h stale instead of 2h
            accuracy -= 0.06  # accuracy drops significantly
        
        # Mild correlation: fresher data → better accuracy always
        accuracy -= (data_freshness_hours - 2) * 0.003
        accuracy = clamp(round(accuracy, 4), 0.70, 0.98)
        
        # Prediction confidence
        confidence = accuracy - 0.02 + normal(0, 0.01)
        confidence = clamp(round(confidence, 4), 0.60, 0.99)
        
        # Request volume (weekday/weekend pattern)
        weekday = day % 7
        base_volume = 10000 if weekday < 5 else 4000
        volume = max(100, round(base_volume + normal(0, 500)))
        
        row = {
            "day": day,
            "accuracy": accuracy,
            "prediction_confidence": confidence,
            "data_freshness_hours": data_freshness_hours,
            "request_volume": volume,
            **features,
        }
        
        rows.append(row)
    
    fieldnames = list(rows[0].keys())
    
    with open(os.path.join(out_dir, "monitoring.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    
    with open(os.path.join(out_dir, "config.json"), "w") as f:
        json.dump({
            "model": "Production fraud detection classifier",
            "description": "90 days of model monitoring metrics and feature statistics",
            "features_monitored": 8,
            "refresh_cadence": "daily",
            "hidden_phenomena": [
                "gradual_drift_features_2_and_5_after_day_45",
                "pipeline_bug_days_60_63_not_model_degradation",
                "data_freshness_correlates_with_accuracy",
                "weekend_volume_pattern_is_not_anomalous"
            ]
        }, f, indent=2)
    
    print(f"  Feature Drift: {len(rows)} days, {len(fieldnames)} columns")


# =============================================================================
# MAIN
# =============================================================================
if __name__ == "__main__":
    print("Generating LITMUS demo datasets...\n")
    generate_simpsons_paradox()
    generate_startup_metrics()
    generate_clinical_trial()
    generate_feature_drift()
    print("\nDone! Check data/demo-datasets/")
