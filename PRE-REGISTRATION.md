# Pre-registration: Prospective application of Models B/C to live forecasts

**Status: DRAFT — NOT YET ACTIVATED.**
This document must be completed, dated, and committed **before** any public display
of research-adjusted probabilities begins. Once the application goes live, the
prospective clock starts and this document is frozen (edits only via dated addenda).

## 1. Objective

Test whether the previously fitted recalibration models (B: logistic on logit(A);
C: logistic + forecast-side covariates) improve live rainfall probability forecasts,
relative to raw live probabilities, on a genuinely new evaluation period.

## 2. Frozen model specification (to be completed before activation)

- [ ] Exact coefficient snapshot selected from `rolling_origin_coefficients.csv`
      (choice: final fold / averaged across folds / other — specify one):
      ______________________
- [ ] Exact preprocessing rules (variable encodings, scaling, clipping) recorded and
      verified identical between the archive pipeline (historical-forecast API) and
      the live forecast API (parity check attached to this doc before activation):
      ______________________
- [ ] Verified parity evidence (variables compared side by side, dated):
      ______________________

## 3. Evaluation design

- **Outcome:** ERA5 seamless hourly precipitation, event = precipitation > 0.1 mm/h,
  same grid point extraction as the training study.
- **Eligible observations:** hours where both the live forecast record and the ERA5
  value are available; documented API gap days excluded by a uniform rule.
- **Metrics:** hourly Brier score (primary) for A-live vs B-live vs C-live; paired
  daily-block bootstrap (2,000 replicates, common calendar days, seed recorded in
  the analysis script) for differences, reported with 95% CIs.
- **Endpoint:** the evaluation window closes at a pre-declared date (at least 90
  days after activation; specify exact date before activation): ____________.
- **Success criterion (declared now):** C-live − A-live macro daily Brier difference
  with a 95% CI entirely below zero, computed once at window close on the full window.

## 4. Interpretation rules (declared now)

- During the window, the app must display the research-adjusted probability with the
  badge "Prospective validation in progress — unverified".
- No superiority claim may be made before window close.
- After window close, the single pre-declared analysis is reported, whatever it shows.
- The exploratory historical results remain frozen and are never re-stated as
  confirmatory, regardless of this prospective outcome.

## 5. Data handling

- Live retrieved forecasts are displayed as served and cached in the visitor's browser
  only (no server-side logging by this app).
- The prospective evaluation is scored through the **archive pipeline** (Open-Meteo
  Historical Forecast API + ERA5), not through self-reported or app-collected data.

## Activation record

| Date | Event |
|---|---|
| (pending) | Document completed and coefficients frozen |
| (pending) | Prospective display activated; window start date recorded |
| (pending) | Window close; pre-declared analysis run; result recorded here |
