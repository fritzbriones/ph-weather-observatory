
# Prospective Validation Pre-Registration (Phase P0)
## Philippine Weather Probability Observatory

> **DOCUMENT STATUS: LOCKED P0 — PREREGISTERED (2026-11-20, Asia/Manila; authoritative registration timestamp is this commit's git history)**  
> **Gate Rule:** Phase P1 parallel display code (`"Prospective validation in progress, unverified"`) is strictly prohibited until every `[ ]` item below is filled in, verified, dated, and committed to `main`.

---

## Phase P0 Pre-Approval Gate Checklist

- [x] **P0-1:** `rolling_origin_coefficients.csv` SHA-256 `2e671d738bc853a39c3d5658f549eb63d3cceb67fd8ec46dd6f45b7d5ef8bb53` recorded in `research/FROZEN-SHA256-MANIFEST.json`; regenerated 2026-11-20 from the frozen V2.0 inputs by `research/rolling_origin_calibration.py` and verified (Brier columns match the step-1/2 reproduction to 1e-12 for all 19 cities; Manila slope 0.4166 -> 0.4883 across folds)
- [x] **P0-2:** Coefficient aggregation rule selected: **Final-Fold** (see Section 2)
- [x] **P0-3:** Window locked: 2026-12-01 00:00 to 2027-05-29 23:00 `Asia/Manila` (180 calendar days; see Section 3)
- [x] **P0-4:** Minimum sample: N_days >= 90, N_hours >= 2,160 valid city-hours per city (Section 3)
- [x] **P0-5:** Seed fixed: 20261120 (Section 5.3)
- [x] **P0-6:** Hypothesis structure finalized as written in Section 5 (H1: B vs A and H2: C vs A co-primary; H3: C vs B secondary; Holm-Bonferroni across H1/H2 at family-wise alpha = 0.05)
- [x] **P0-7:** Covariates mapped 1-to-1 (`research/model_c_coefficients.csv`, verified against archived V2.0 fold-5 predictions to 2.22e-16); live-vs-archive parity verified 2026-11-20 by `research/parity_check.py`: 19/19 cities, all variables, zero schema drift, worst value discrepancy 0.0000 (`research/parity_report_2026-11-20.json`)
- [x] **P0-8:** Status header updated to `LOCKED P0 — PREREGISTERED` with this commit's timestamp (2026-11-20)

---

## 1. Study Governance & Metadata

* **Project:** Philippine Weather Probability Observatory (`fritzbriones/ph-weather-observatory`)
* **Investigator:** Fritz Briones
* **Baseline Release:** `V2.0` (Frozen May 2024–Aug 2025 Research Record)
* **Prospective Registration Status:** `LOCKED P0 — PREREGISTERED` (locked 2026-11-20, prior to the 2026-12-01 window opening and prior to any prospective observation collection)
* **Optional External Timestamp (OSF):** `[PENDING — Insert OSF DOI & Embargo End Date if registered]`

---

## 2. Frozen Model & Coefficient Snapshot (Locked Prior to Observations)

All prospective probability adjustments use frozen parameters derived strictly from the `V2.0` historical study without refitting on prospective data.

* **Source Artifact:** `research/rolling_origin_coefficients.csv` (committed 2026-11-20)
* **Source Artifact SHA-256:** `2e671d738bc853a39c3d5658f549eb63d3cceb67fd8ec46dd6f45b7d5ef8bb53`
* **Fold Snapshot (Model B):** For each city, the prospective adjustment uses the **fold 5 row** (`fold = 5`) of `research/rolling_origin_coefficients.csv`: `logit(p_B) = intercept + slope_logit_p * logit(p_A)`, with each city's fold-5 row the last row for that city (e.g., Manila: `-0.9753692663630276 + 0.48834530122138414 * logit(p_A)`). No refitting on prospective data.
* **Selected Fold Set (Choose ONE before locking):**
  * [x] **Option 1 — Final-Fold Coefficients** (trained on the latest expanding window ending Aug 2025)
  * [ ] **Option 2 — Fold-Averaged Coefficients** (mean parameter vector across all rolling-origin folds)
* **Pre-Specified Justification for Selected Fold Set:**  
  Final-fold coefficients are selected for recency adaptation: they are trained on the full expanding window (10,416 hours per city) ending Aug 2025, the closest possible fit to current forecast behavior. The committed coefficient history shows smooth, monotone parameter drift (e.g., Manila slope 0.4166 -> 0.4883 across folds), so fold-averaging would mix in stale early-window fits without meaningful variance reduction; each city's two-parameter MLE has no variance problem that joint fold-averaging needs to solve. This choice was made and recorded before any prospective outcome was observed.

### Model Definitions
* **Model A (Raw Baseline):** Unadjusted hourly precipitation probability (`precipitation_probability`) from Open-Meteo.
* **Model B (City-Level Logistic Recalibration):** City-specific intercept and logit-transformed Model A probability:
  $$\text{logit}(\hat{p}_{B,c,t}) = \beta_{0,c} + \beta_{1,c} \cdot \text{logit}(p_{A,c,t})$$
* **Model C (Weather-Covariate Logistic Recalibration):** City-specific logistic recalibration incorporating forecast-side atmospheric covariates defined in Section 4:
  $$\text{logit}(\hat{p}_{C,c,t}) = \gamma_{0,c} + \gamma_{1,c} \cdot \text{logit}(p_{A,c,t}) + \sum_{k=1}^{K} \gamma_{k+1,c} \cdot X_{k,c,t}$$

*(Note: Probabilities $p_{A,c,t}$ are clipped to $[\epsilon, 1-\epsilon]$ with the exact $\epsilon = 10^{-4}$ used by the `V2.0` scripts (`rolling_origin_calibration.py`, `run_model_c.py`) before applying $\text{logit}(p) = \ln(p / (1 - p))$. The $10^{-6}$ clip appearing in those scripts applies to log-loss evaluation only, not to coefficient application. Model A raw probabilities enter the metric uncalibrated and unclipped, matching the V2.0 evaluation convention.)*

---

## 3. Evaluation Window & Sample Size Rules

* **Target Geography:** All 19 Philippine cities evaluated in `V2.0` (Luzon, Visayas, Mindanao).
* **Timezone Standard:** `Asia/Manila` (`UTC+8`).
* **Evaluation Window Start:** `2026-12-01 00:00 Asia/Manila`
* **Evaluation Window End:** `2027-05-29 23:00 Asia/Manila` (exactly 180 calendar days)
* **Minimum Sample-Size Gate:**
  * Each city $c$ must accrue at least **$N_{\text{days}} \ge 90$ valid calendar days** (minimum **$N_{\text{hours}} \ge 2{,}160$ valid city-hours**) after applying Section 4 exclusions before Phase P2 verdict computation is permitted.
  * If missingness delays completion, the window extends solely until the minimum valid day count is reached; early stopping based on interim Brier scores is prohibited.

---

## 4. Verification Ground Truth & Live-vs-Archive Parity Protocol

### 4.1 Ground Truth & Scoring Pipeline
* **Verification Reference:** ERA5 seamless hourly precipitation (`total_precipitation` / `precipitation`) via Open-Meteo Archive / Copernicus CDS.
* **Binary Rain Event Definition:**
  $$Y_{c,t} = \mathbb{I}(\text{ERA5\_precip}_{c,t} \ge 0.1\text{ mm})$$
* **Archive Forecast Scoring Source:** Open-Meteo Historical Forecast API (matching the exact stitched archive pipeline used in `V2.0`—no fixed lead-time horizon extraction).
* **Historical Exclusion Rule Reference:** Consistent with `V2.0` protocol (where Dec 4–6, 2024 outage dates were excluded), prospective hours with missing Open-Meteo archive forecasts or unfinalized ERA5 reanalysis values are logged in an exclusion manifest prior to unblinding scores.

### 4.2 Model C Covariate Parity Lock
Every covariate $X_{k,c,t}$ used by Model C must match the exact column name, unit, and transformation in `rolling_origin_coefficients.csv`:

| Feature (from `run_model_c.py`) | Live API Parameter Name | Historical Forecast API Parameter Name | Unit | Transform / Scaling | Parity Verified? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `logit(clipped p_A)` | `precipitation_probability` | `precipitation_probability` | % (0-100, divided by 100) | `logit(clip(p, 1e-4, 1-1e-4))` | `[x]` |
| `temperature_2m` | `temperature_2m` | `temperature_2m` | degrees C | Frozen final-fold StandardScaler (mean/std in `research/model_c_coefficients.csv`) | `[x]` |
| `relative_humidity_2m` | `relative_humidity_2m` | `relative_humidity_2m` | % | Frozen final-fold StandardScaler (mean/std in `research/model_c_coefficients.csv`) | `[x]` |
| `cloud_cover` | `cloud_cover` | `cloud_cover` | % | Frozen final-fold StandardScaler (mean/std in `research/model_c_coefficients.csv`) | `[x]` |

* **RESOLVED (2026-11-20):** The frozen Model C snapshot now exists and is committed: `research/model_c_coefficients.csv` (per-city final-fold intercept + slopes for `logit_p`, `temperature_2m`, `relative_humidity_2m`, `cloud_cover`, plus frozen StandardScaler mean_/scale_ per feature and an explicit raw-space application formula), generated by `research/export_model_c_snapshot.py` and recorded in `research/FROZEN-SHA256-MANIFEST.json`. Verification: fold-5 probabilities recomputed from the exported parameters alone match the archived V2.0 `model_c_oof_predictions.csv` to 2.22e-16 (machine epsilon) for all 19 cities. Live-vs-archive parity verified 2026-11-20 by `research/parity_check.py` across all 19 city coordinates: identical schema, units, timezone, timestamps, and missing-value flags; worst value discrepancy 0.0000. Evidence: `research/parity_report_2026-11-20.json`. Covariate names are taken verbatim from the V2.0 script and `openmeteo_hourly_covariates_2024-05_2025-08.csv`.

* **Pre-P1 Parity Check:** Automated test confirms zero schema drift, identical units, and identical missing-value flags between the live Open-Meteo forecast endpoint and the Historical Forecast API for all 19 city coordinates.

---

## 5. Primary Hypotheses & Statistical Decision Criteria

### 5.1 Primary Comparisons (Tested Separately Against Model A)
To avoid ambiguity between recalibration tiers, **Model B** and **Model C** are each evaluated independently against **Model A (Raw Forecast)** as co-primary tests, with a secondary comparison between Model C and Model B:

1. **Hypothesis H1 (City Recalibration vs. Raw):** Model B achieves a lower daily-block Brier Score than Model A ($\Delta \text{BS}_{B - A} < 0$).
2. **Hypothesis H2 (Weather-Covariate Recalibration vs. Raw):** Model C achieves a lower daily-block Brier Score than Model A ($\Delta \text{BS}_{C - A} < 0$).
3. **Secondary Comparison (H3 — Covariate Added Value):** Model C achieves a lower daily-block Brier Score than Model B ($\Delta \text{BS}_{C - B} < 0$).

### 5.2 Daily-Block Paired Brier Metric
For city $c$ on calendar day $d$ (`Asia/Manila`) with $H_{d,c}$ valid hours ($1 \le H_{d,c} \le 24$), the daily-block Brier Score for model $m \in \{A, B, C\}$ is:

$$\text{BS}_{d,c,m} = \frac{1}{H_{d,c}} \sum_{t \in d} \left( \hat{p}_{m,c,t} - Y_{c,t} \right)^2$$

The paired daily-block Brier difference comparing candidate model $m \in \{B, C\}$ against Model A is:

$$\Delta \text{BS}_{d,c}^{(m - A)} = \text{BS}_{d,c,m} - \text{BS}_{d,c,A}$$

*(Negative values $\Delta \text{BS} < 0$ indicate improved probabilistic accuracy over raw forecasts.)*

### 5.3 Confidence Interval & Verdict Rules
* **Resampling Method:** Non-parametric paired daily-block bootstrap with **$B = 10,000$ resamples** (resampling calendar days with replacement to preserve intra-day autocorrelation).
* **Random Seed:** `20261120`
* **Confidence Level:** Two-sided **95% percentile confidence interval** $[\text{CI}_{2.5\%}, \text{CI}_{97.5\%}]$ (with Holm–Bonferroni adjustment across the two co-primary hypotheses H1 and H2 at family-wise $\alpha = 0.05$, i.e., 97.5% individual CIs for formal family-wise claim, alongside unadjusted 95% CIs).

| Outcome Category | Formal Criterion (Pooled Across 19 Cities) | Permitted Public Verdict Claim |
| :--- | :--- | :--- |
| **PASS (Validated Improvement)** | Upper bound of adjusted CI $< 0$ | *"Prospective out-of-sample evaluation confirmed statistically significant Brier Score improvement over raw forecasts."* |
| **INCONCLUSIVE (No Significant Gain)** | Adjusted CI spans $0$ ($\text{CI}_{\text{low}} \le 0 \le \text{CI}_{\text{high}}$) | *"Prospective evaluation found no statistically significant difference between recalibrated and raw probabilities."* |
| **FAIL (Degradation)** | Lower bound of adjusted CI $> 0$ | *"Prospective evaluation showed worse Brier Scores than raw forecasts; recalibration parameters require revision."* |

*City-level 95% CIs for all 19 cities will also be published in full in the Phase P2 Research Lab verdict panel regardless of outcome.*

---

## 6. Execution Phases & Badging Rules

1. **Phase P0 (COMPLETED 2026-11-20):** All `[REQUIRED]` fields completed, parity check passed (zero drift, worst difference 0.0000), status changed to `LOCKED P0 — PREREGISTERED`, and committed to Git. Phase P1 is now authorized.
2. **Phase P1 (Parallel Display):** Add badged section to Live tab labeled **`"Prospective validation in progress, unverified"`** displaying Model A, Model B, and Model C probabilities side by side. Zero superiority claims permitted.
3. **Phase P2 (Verdict):** Once Section 3 sample size is met and ERA5 final data is retrieved, run the locked scoring script and publish the **third, separately badged** Research Lab verdict section.
