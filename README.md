# 🌧️ Philippine Weather Probability Observatory — Live Edition (v2.0)

> 🌐 **Try the live app: [fritzbriones.github.io/ph-weather-observatory](https://fritzbriones.github.io/ph-weather-observatory)**

A live research observatory for rainfall forecast probabilities across **19 Philippine cities** in **Luzon, Visayas, and Mindanao**, with two strictly separated layers:

| Layer | What it shows | Status |
|---|---|---|
| **Live Forecast** | Current + next 24/48 h rainfall probabilities from the Open-Meteo live forecast API | Unverified, timestamped, cached, manual refresh |
| **Research Lab** | Frozen exploratory results of the Model A/B/C recalibration study (May 2024 – Aug 2025) | Frozen, never auto-updates |

The two layers are never merged. Live data is clearly badged as **not part of any research evaluation**; research results are clearly badged as **frozen and exploratory**.

## Research summary (frozen)

- **Question:** Are rainfall forecast probabilities equally reliable across Luzon, Visayas, and Mindanao?
- **Design:** Hourly Open-Meteo archived forecast probabilities for 19 cities, verified against ERA5 (seamless) hourly precipitation (event = > 0.1 mm/h), May 2024 – Aug 2025; rolling-origin out-of-fold evaluation (243 OOF days, 5,832 OOF hours per city).
- **Models:**
  - **A** — raw archived probability, as served
  - **B** — city-specific logistic recalibration on logit(A)
  - **C** — L2 logistic recalibration + forecast-side temperature, relative humidity, cloud cover
- **Headline results (exploratory):**
  - C − A macro daily Brier: **−0.0157** [−0.0189, −0.0124]
  - C − B macro daily Brier: **−0.0044** [−0.0052, −0.0036]
  - C improves on A in **19/19** cities; on B in **18/19** (Cotabato City the exception)
  - 2,000-replicate paired daily-block bootstrap, common calendar days
- **Interpretation guardrails (verbatim from the study):**
  - All results are exploratory; the historical period was previously inspected. A future untouched period is reserved for confirmatory validation.
  - ERA5 is a gridded verification reference, not ground truth.
  - The archived probability series is stitched; lead-time provenance cannot be verified; no fixed-lead claim is made.
  - Model improvement within island groups does **not** establish differences in regional forecast reliability.

The frozen data files in `src/data/` are checksum-verified (`src/data/SHA256SUMS.txt`).

## Run locally

```bash
npm install
npm run dev     # local dev server
npm run build   # production build (dist/)
npm run preview # serve the production build
```

## Deploy on GitHub Pages (automatic)

1. Create a repository named **`ph-weather-observatory`** (the `base` path in `vite.config.ts` must match the repo name; change it if you rename).
2. Push this folder's contents to the repo.
3. In the repo: **Settings → Pages → Source: GitHub Actions**.
4. Every push now builds and deploys via `.github/workflows/deploy.yml`.

The live layer calls the public Open-Meteo API **directly from the visitor's browser** (one batched request for all 19 cities) — no server, no API key, no backend to maintain.

## Data sources and attribution

- **Live forecasts:** [Open-Meteo Forecast API](https://open-meteo.com/en/docs) — retrieved client-side at page load; displayed as served and never mixed with research data.
- **Historical forecasts (research):** [Open-Meteo Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api).
- **Verification reference (research):** [ERA5 seamless reanalysis](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels) (ECMWF, via CopernicusClimate Data Store), ~0.25° grid.
- ERA5 is a gridded reference dataset, **not** ground-truth station observation.

## Prospective validation (pre-registered, data collection under way)

The frozen results above are exploratory. A confirmatory test on new data is now **locked and pre-registered**:

- **Protocol:** [`research/PROSPECTIVE-PRE-REGISTRATION.md`](research/PROSPECTIVE-PRE-REGISTRATION.md), status *LOCKED P0, preregistered 2026-11-20*. It is also registered on OSF: [doi:10.17605/OSF.IO/HYS58](https://doi.org/10.17605/OSF.IO/HYS58).
- **Frozen models:** final-fold coefficients from `research/rolling_origin_coefficients.csv` and `research/model_c_coefficients.csv`, with checksums in `research/FROZEN-SHA256-MANIFEST.json` (`python research/verify_frozen_artifacts.py verify`).
- **Evaluation window:** 2026-12-01 00:00 to 2027-05-29 23:00 Asia/Manila (180 days). A GitHub Action (`.github/workflows/prospect-archive.yml`) records issued forecasts to `prospect-archive/snapshots/` twice a day (a main run plus a backup). It automatically backfills any missed day and keeps itself enabled, so it runs unattended for the whole window.
- **Success criterion (declared in advance):** the 95% CI of the C-live − A-live macro daily Brier difference lies entirely below zero at window close.

Until the window closes and is scored, **no claim of live forecast improvement is made or implied**, and the app does not display research-adjusted probabilities.
(`research/PRE-REGISTRATION.md` is the earlier draft template, superseded by the locked protocol.)

## AI use

The original study and Stanford submission documented AI assistance openly (assembly, review, packaging, under the author's direction and verification). This GitHub edition was scaffolded with AI assistance and reviewed by the author. The scientific design, modeling decisions, and interpretation belong to the author.

## License

Code: MIT. Data credits follow the upstream providers (Open-Meteo, ECMWF/Copernicus) — see links above.
