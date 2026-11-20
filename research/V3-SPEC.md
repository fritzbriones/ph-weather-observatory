
# Version 3 Specification — Philippine Weather Probability Observatory

> **Status:** APPROVED SCOPE (Fritz, Nov 20, 2026)  
> **V3 Priority:** Communicating findings to non-technical users (decided Nov 20, 2026).  
> **Scope Governance:** This document is the binding scope for V3. Any feature not listed here is **OUT OF SCOPE**. Deviations require updating this spec first, with dated rationale, before any code is written.

---

## 0. Workstream Separation (Governing Structure)

**V3 = three separate workstreams, never confused:**

| Workstream | Purpose | Status |
| :--- | :--- | :--- |
| **V3 software upgrade** | Make EXISTING science easier to inspect, understand, and use; priority = non-technical communication scoped in this doc | Scoped in this doc |
| **Prospective validation** | A NEW preregistered scientific study on newly collected observations; own preregistration, data protocol, evaluation window, decision criteria — examined before observations arrive | Separate; P0 prereg must exist before any display code ships; **NOT** presented as a completed V3 result |
| **Stanford edition** | Preserve the existing frozen research artifact without modification | Immutable, forever |

---

## 1. Governing Principles (Non-Negotiable)

1. **One repo, one science.** V3 is an upgrade of `fritzbriones/ph-weather-observatory`, not a fork. No separate "Version 3 project."
2. **The Stanford edition stays frozen forever.** It has been submitted; no file in the submission package is ever touched.
3. **Frozen research record does not change.** All V3 numbers must come from the existing frozen artifacts (`src/data/*.json`, workbook, OOF CSVs), SHA-256 verified. No new analysis of the May 2024–Aug 2025 window, no re-runs, no result-shaped edits.
4. **Pre-registration before display.** The prospective validation feature may not go live publicly until its pre-registration doc is committed (dated) and optionally registered on OSF with embargo.
5. **No invented numbers.** Any AI-assisted artifact must pass SHA-256 / byte-match verification against the research record before appearing on the site. *(Precedent: the "illustrative" rebuild with fabricated island CIs was detected and excluded from the Stanford package. Same policy applies here.)*

---

## 2. Version Control Plan

| Step | Action |
| :--- | :--- |
| **1** | Verify `git tag V2.0` on the baseline deployed commit (baseline preserved, revert-able) |
| **2** | All V3 work in feature branches, squash-merged with descriptive messages |
| **3** | Each shipped increment tagged: `v3.0`, `v3.1`, ... |
| **4** | GitHub Actions auto-deploy *(known quirk: `vscode.dev` commits need manual `workflow_dispatch`)* |
| **5** | Maintain the GitHub Release for `V2.0`: attached source archive + SHA-256 manifest of the shipped files. Tags are release objects in GitHub; the repo's branch-protection / tag-protection rules should prevent rewriting protected tags. |

---

## 3. IN Scope — V3 Feature List

### 3.0 PRIORITY: Non-Technical Communication Layer (The Reason V3 Exists)

Chosen by Fritz, Nov 20, 2026, as the most important problem: the science is strong, but its impact is capped by translation. **Every value below must come from the frozen JSONs (byte-matched), never recomputed.**

* **Plain-language city cards:** Per city, one plain-English sentence at the top of its scorecard (e.g., *"When the forecast says 90–99% rain here, rain actually falls about 8 times out of 10."*). Probability bins and observed frequencies pulled directly from the frozen reliability record.
* **"What does this mean for me?" glossary:** Plain definitions beside every technical term on screen (`Brier score` = punishment score for wrong confidence, lower = better; `calibration` = whether stated percentages are honest; `reliability curve` = promise vs reality). Never removing technical labels—adding translation beside them.
* **Three-sentence takeaway at the top of the Research Lab:** Probabilities are skillful, overconfident at the top, and correctable. Followed by the evidence.
* **Interpretation rails (tone discipline):** No overclaiming (*"more accurate than PAGASA"*), no deterministic misreading of probabilities, no implying live numbers are personally verified. Fact-check every sentence against the frozen record.
* **Optional:** A one-page *"How to read this observatory"* guide (site + repo docs).

### 3.1 UX Deepening (Frozen Record Only)

* **Plain-language tooltip per city:** E.g., *"In Calbayog: when the forecast says 90–99%, rain actually occurs about X% of the time"*, values pulled from the frozen reliability JSONs, never recomputed.
* **Reliability-bin visual:** Observed vs forecast frequency per 10-point bin, per city.
* **Downloads:** Link the 9-sheet canonical workbook, key CSVs, and pre-registration PDFs from the site with proper attribution (Open-Meteo terms, ERA5/CDS attribution, NOAA GHCN).
* **Accessibility pass:** Current `aria` labels maintained; add plain-English summary sentence per Lab panel.

### 3.2 SEPARATE WORKSTREAM: Prospective Validation (Own Study, NOT a V3 Release Feature)

May **not** be presented as an already-completed V3 result. Only its software hook (the badged parallel display) ships as a V3 increment, and **only after Phase P0 exists**.

* **Phase P0 (must precede code) — Pre-registration:**
  * New doc `research/PROSPECTIVE-PRE-REGISTRATION.md`, containing:
    * Coefficient snapshot (source: `rolling_origin_coefficients.csv` — state which fold set: `final-fold` or `fold-averaged`, chosen and justified before seeing results)
    * Evaluation window start/end dates
    * Daily-block paired Brier metric and pass/fail criteria (CI vs zero)
    * Archive-pipeline scoring (Open-Meteo Historical Forecast API + ERA5 seamless hourly, `0.1 mm` hourly event, Dec 4–6 2024 exclusions)
    * Variable-parity check between live API and archive variables
    * Dated and committed to repository
  * *Optional external timestamp:* OSF Registries with embargo, DOI linked both ways.
* **Phase P1 — Parallel display:** Live tab adds a badged section *"Prospective validation in progress, unverified"* showing raw probability and adjusted probability side by side, per city. **NO claim of superiority until the window closes.**
* **Phase P2 — Verdict:** When the window closes, compute paired daily-block Brier CI and publish the verdict page in the Research Lab as a **THIRD, separately badged section**. Either outcome is publishable; pre-registration wins either way.

### 3.3 Documentation

* **README:** Add a short V3 roadmap section pointing at this spec.
* **Decision log:** Time-stamped decision log for every V3 change (continuation of the repo's transparency practice).

---

## 4. OUT OF Scope — Explicit Prohibitions

1. **NO Forecast Horizon / lead-time analysis.** Frozen decision (Nov 19, 2026): the Historical Forecast API stitches hours of successive runs; archived probabilities at fixed lead **DO NOT EXIST** (`precipitation_probability_previous_dayN` is null for all dates). Horizon analysis would require inventing lead times and violates the frozen protocol. Do not build it; do not "approximate" it.
2. **NO re-analysis of the May 2024–Aug 2025 window.** All A/B/C results stay as shipped.
3. **NO new cities, NO new data sources into the frozen sections.** *(IMERG remains a separate robustness extension, deferred until NASA Earthdata credentials provided; it is analysis-side work, not a site feature.)*
4. **NO merging of the three sections' badges.** Frozen research, live forecast, and prospective validation remain visually and verbally separate, as established.
5. **NO forked "Version 3 project"**, no second source of truth.
6. **NO already-existing features re-marketed as new.** Regional dashboard, calibration explorer, A/B/C model comparison, and transparency already exist in the Research Lab and Methodology tabs. V3 proposals that duplicate them are rejected by default.

---

## 5. Definition of Done (`v3.0` = The Communication Release)

- [ ] `V2.0` tag verified on the baseline commit; GitHub Release with archive + SHA-256 manifest confirmed
- [ ] Plain-language city cards live on all 19 cities, values byte-matched to frozen JSONs
- [ ] Glossary / *"What does this mean for me?"* layer live beside technical labels
- [ ] Three-sentence takeaway at the top of the Research Lab
- [ ] Plain-language tooltips, reliability-bin visual, downloads with attributions
- [ ] Every new sentence fact-checked against the frozen record (no overclaiming)
- [ ] `README.md` updated; tag `v3.0` cut
- [ ] Knowledge Base updated with V3 outcome record *(Prospective validation has its OWN definition of done, gated on its own P0 preregistration; it is not part of the `v3.0` release checklist.)*
