
# Prospective Validation Pre-Registration (Phase P0)
## Philippine Weather Probability Observatory

> **DOCUMENT STATUS: DRAFT — DO NOT COMMIT AS LOCKED P0**  
> **Gate Rule:** Phase P1 parallel display code (`"Prospective validation in progress, unverified"`) is strictly prohibited until every `[ ]` item below is filled in, verified, dated, and committed to `main`.

---

## Phase P0 Pre-Approval Gate Checklist

- [ ] **P0-1:** `rolling_origin_coefficients.csv` SHA-256 hash recorded and verified against `V2.0` baseline
- [ ] **P0-2:** Coefficient aggregation rule selected (`Final-Fold` vs. `Fold-Averaged`) with written justification
- [ ] **P0-3:** Exact prospective evaluation start/end dates (`Asia/Manila`) locked prior to observation collection
- [ ] **P0-4:** Minimum sample size rule (`N_days` and `N_hours`) finalized (no placeholder values)
- [ ] **P0-5:** Block bootstrap random seed fixed and recorded
- [ ] **P0-6:** Primary hypothesis structure (Model B vs. Model A and Model C vs. Model A) finalized
- [ ] **P0-7:** Model C covariates mapped 1-to-1 to exact `rolling_origin_coefficients.csv` column names and verified for live-vs-archive parity
- [ ] **P0-8:** Status header updated from `DRAFT` to `LOCKED P0 — PREREGISTERED` with commit timestamp

---

## 1. Study Governance & Metadata

* **Project:** Philippine Weather Probability Observatory (`fritzbriones/ph-weather-observatory`)
* **Investigator:** Fritz Briones
* **Baseline Release:** `V2.0` (Frozen May 2024–Aug 2025 Research Record)
* **Prospective Registration Status:** `DRAFT` *(Must be locked prior to Phase P1 UI deployment)*
* **Optional External Timestamp (OSF):** `[PENDING — Insert OSF DOI & Embargo End Date if registered]`

---

## 2. Frozen Model & Coefficient Snapshot (Locked Prior to Observations)

All prospective probability adjustments use frozen parameters derived strictly from the `V2.0` historical study without refitting on prospective data.

* **Source Artifact:** `research/rolling_origin_coefficients.csv` *(confirm exact repo path)*
* **Source Artifact SHA-256:** `[REQUIRED: Paste exact 64-character SHA-256 hash]`
* **Selected Fold Set (Choose ONE before locking):**
  * `[ ]` **Option 1 — Final-Fold Coefficients** (trained on the latest expanding window ending Aug 2025)
  * `[ ]` **Option 2 — Fold-Averaged Coefficients** (mean parameter vector across all rolling-origin folds)
* **Pre-Specified Justification for Selected Fold Set:**  
  `[REQUIRED: Write 2–3 sentences explaining why the chosen fold set is selected prior to seeing prospective outcomes—e.g., variance reduction via fold averaging vs. recency adaptation via final fold.]`

### Model Definitions
* **Model A (Raw Baseline):** Unadjusted hourly precipitation probability (`precipitation_probability`) from Open-Meteo.
* **Model B (City-Level Logistic Recalibration):** City-specific intercept and logit-transformed Model A probability:
  $$\text{logit}(\hat{p}_{B,c,t}) = \beta_{0,c} + \beta_{1,c} \cdot \text{logit}(p_{A,c,t})$$
* **Model C (Weather-Covariate Logistic Recalibration):** City-specific logistic recalibration incorporating forecast-side atmospheric covariates defined in Section 4:
  $$\text{logit}(\hat{p}_{C,c,t}) = \gamma_{0,c} + \gamma_{1,c} \cdot \text{logit}(p_{A,c,t}) + \sum_{k=1}^{K} \gamma_{k+1,c} \cdot X_{k,c,t}$$

*(Note: Probabilities $p_{A,c,t} \in \{0, 1\}$ are clipped to $[\epsilon, 1-\epsilon]$ using the exact $\epsilon =$ `[REQUIRED: e.g., 1e-6]` from the `V2.0` training script before applying $\text{logit}(p) = \ln(p / (1 - p))$.)*

---

## 3. Evaluation Window & Sample Size Rules

* **Target Geography:** All 19 Philippine cities evaluated in `V2.0` (Luzon, Visayas, Mindanao).
* **Timezone Standard:** `Asia/Manila` (`UTC+8`).
* **Evaluation Window Start:** `[REQUIRED: YYYY-MM-DD 00:00 Asia/Manila]`
* **Evaluation Window End:** `[REQUIRED: YYYY-MM-DD 23:00 Asia/Manila]`
* **Minimum Sample-Size Gate:**
  * Each city $c$ must accrue at least **$N_{\text{days}} \ge$ `[REQUIRED: e.g., 90]` valid calendar days** (minimum **$N_{\text{hours}} \ge$ `[REQUIRED: e.g., 2,160]` valid city-hours**) after applying Section 4 exclusions before Phase P2 verdict computation is permitted.
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

| Coefficient Column in CSV | Live API Parameter Name | Historical Forecast API Parameter Name | Unit | Transform / Scaling | Parity Verified? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `[REQUIRED: col_1]` | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED: e.g., raw / z-score]` | `[ ]` |
| `[REQUIRED: col_2]` | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED]` | `[ ]` |
| `[REQUIRED: col_3]` | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED]` | `[ ]` |
| `[REQUIRED: col_4]` | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED]` | `[ ]` |

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
* **Random Seed:** `[REQUIRED: Fixed integer seed, e.g., 20261120]`
* **Confidence Level:** Two-sided **95% percentile confidence interval** $[\text{CI}_{2.5\%}, \text{CI}_{97.5\%}]$ (with Holm–Bonferroni adjustment across the two co-primary hypotheses H1 and H2 at family-wise $\alpha = 0.05$, i.e., 97.5% individual CIs for formal family-wise claim, alongside unadjusted 95% CIs).

| Outcome Category | Formal Criterion (Pooled Across 19 Cities) | Permitted Public Verdict Claim |
| :--- | :--- | :--- |
| **PASS (Validated Improvement)** | Upper bound of adjusted CI $< 0$ | *"Prospective out-of-sample evaluation confirmed statistically significant Brier Score improvement over raw forecasts."* |
| **INCONCLUSIVE (No Significant Gain)** | Adjusted CI spans $0$ ($\text{CI}_{\text{low}} \le 0 \le \text{CI}_{\text{high}}$) | *"Prospective evaluation found no statistically significant difference between recalibrated and raw probabilities."* |
| **FAIL (Degradation)** | Lower bound of adjusted CI $> 0$ | *"Prospective evaluation showed worse Brier Scores than raw forecasts; recalibration parameters require revision."* |

*City-level 95% CIs for all 19 cities will also be published in full in the Phase P2 Research Lab verdict panel regardless of outcome.*

---

## 6. Execution Phases & Badging Rules

1. **Phase P0 (Current — Draft):** Complete all `[REQUIRED]` fields above, run parity checks, change status to `LOCKED P0`, and commit to Git.
2. **Phase P1 (Parallel Display):** Add badged section to Live tab labeled **`"Prospective validation in progress, unverified"`** displaying Model A, Model B, and Model C probabilities side by side. Zero superiority claims permitted.
3. **Phase P2 (Verdict):** Once Section 3 sample size is met and ERA5 final data is retrieved, run the locked scoring script and publish the **third, separately badged** Research Lab verdict section.
