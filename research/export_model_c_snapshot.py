"""Generate the FROZEN Model C coefficient snapshot for prospective validation (P0-7).

Replicates the exact V2.0 Model C fit (run_model_c.py) restricted to the
FINAL (fold 5) expanding-window training set (days 0..433, 10,416 hours/city),
and exports, per city: the logistic intercept + 4 standardized-space slopes,
the StandardScaler mean_ and scale_ per feature, and the equivalent raw-space
formula coefficients. No test-fold data is used in the fit.

Verification built in: fold-5 out-of-fold probabilities recomputed with the
exported parameters are compared to the archived model_c_oof_predictions.csv.
"""
from pathlib import Path
import numpy as np, pandas as pd
from scipy.special import logit
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

SRC = Path('/home/user/tool-results/data-analysis/ph-abc')
ROOT = Path('/home/user/tool-results/data-analysis/ph-p0/model-c')
FEATS = ['logit_p', 'temperature_2m', 'relative_humidity_2m', 'cloud_cover']

P = pd.read_csv(SRC/'om_hourly_prob_2024-05_2025-08.csv', parse_dates=['time']).set_index('time')
R = pd.read_csv(SRC/'era5_hourly_precip_2024-05_2025-08.csv', parse_dates=['time']).set_index('time')
X = pd.read_csv(SRC/'openmeteo_hourly_covariates_2024-05_2025-08.csv', parse_dates=['time'])
EXCL = pd.to_datetime(['2024-12-04','2024-12-05','2024-12-06'])
P = P[~P.index.normalize().isin(EXCL)]
R = R[~R.index.normalize().isin(EXCL)]
X = X[~X.time.dt.normalize().isin(EXCL)]
X = X.set_index(['time','city']).sort_index()
DAYS = P.index.normalize().unique(); assert len(DAYS) == 485
assert P.index.equals(R.index)

archived = pd.read_csv(SRC/'model_c_oof_predictions.csv', parse_dates=['time'])
arch5 = archived[archived.fold == 5].set_index(['city','time']).sort_index()

rows = []
pred_checks = {c: [] for c in P.columns}
for city in P.columns:
    p = P[city].astype(float).to_numpy()/100
    y = (R[city].astype(float).to_numpy() > 0.1).astype(int)
    cov = X.xs(city, level='city').reindex(P.index)
    assert cov.index.equals(P.index)
    x = np.column_stack([
        logit(np.clip(p, 1e-4, 1-1e-4)),
        cov.temperature_2m.to_numpy(float),
        cov.relative_humidity_2m.to_numpy(float),
        cov.cloud_cover.to_numpy(float)])
    tr = np.arange(434*24)          # fold 5 training window (days 0..433)
    te = np.arange(434*24, 485*24)  # fold 5 test window (days 434..484)
    sc = StandardScaler().fit(x[tr])
    xs = sc.transform(x[tr])
    m = LogisticRegression(C=1.0, penalty='l2', solver='lbfgs', max_iter=3000)
    m.fit(xs, y[tr])
    # Recompute fold-5 test probabilities from exported params alone
    xs_te = (x[te]-sc.mean_)/sc.scale_
    z = m.intercept_[0] + xs_te @ m.coef_[0]
    pc = 1/(1+np.exp(-z))
    rows.append({
        'city': city,
        'intercept': float(m.intercept_[0]),
        'slope_logit_p': float(m.coef_[0][0]),
        'slope_temperature_2m': float(m.coef_[0][1]),
        'slope_relative_humidity_2m': float(m.coef_[0][2]),
        'slope_cloud_cover': float(m.coef_[0][3]),
        'scaler_mean_logit_p': float(sc.mean_[0]), 'scaler_scale_logit_p': float(sc.scale_[0]),
        'scaler_mean_temperature_2m': float(sc.mean_[1]), 'scaler_scale_temperature_2m': float(sc.scale_[1]),
        'scaler_mean_relative_humidity_2m': float(sc.mean_[2]), 'scaler_scale_relative_humidity_2m': float(sc.scale_[2]),
        'scaler_mean_cloud_cover': float(sc.mean_[3]), 'scaler_scale_cloud_cover': float(sc.scale_[3]),
        'raw_intercept': float(m.intercept_[0] - np.sum(m.coef_[0]*sc.mean_/sc.scale_)),
        'raw_slope_logit_p': float(m.coef_[0][0]/sc.scale_[0]),
        'raw_slope_temperature_2m': float(m.coef_[0][1]/sc.scale_[1]),
        'raw_slope_relative_humidity_2m': float(m.coef_[0][2]/sc.scale_[2]),
        'raw_slope_cloud_cover': float(m.coef_[0][3]/sc.scale_[3]),
        'train_hours': int(len(tr)), 'train_start': str(P.index[0]),
        'train_end': str(P.index[tr[-1]]),
        'formula': 'logit(p_C) = raw_intercept + raw_slope_logit_p*logit(clip(p_A,1e-4,1-1e-4)) '
                   '+ raw_slope_temperature_2m*temperature_2m + raw_slope_relative_humidity_2m*relative_humidity_2m '
                   '+ raw_slope_cloud_cover*cloud_cover'})
    a = arch5.loc[city].sort_index()
    assert (a.index == P.index[te]).all(), city
    pred_checks[city] = float(np.max(np.abs(pc - a.p_model_c.to_numpy())))

out = pd.DataFrame(rows)
out.to_csv(ROOT/'model_c_coefficients.csv', index=False)
mx = max(pred_checks.values()); worst = max(pred_checks, key=pred_checks.get)
print('Wrote model_c_coefficients.csv:', len(out), 'cities')
print(f'Max |recomputed - archived| fold-5 p_model_c diff: {mx:.3e} (worst city: {worst})')
if mx < 1e-9:
    print('VERIFIED: exported parameters reproduce archived V2.0 fold-5 Model C predictions exactly')
else:
    print('WARNING: diff above 1e-9 threshold')
