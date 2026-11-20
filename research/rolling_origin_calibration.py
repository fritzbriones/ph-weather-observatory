"""Exploratory rolling-origin calibration comparison for the PH Weather Observatory.

This is NOT a confirmatory locked test: the full period was previously inspected.
Model A: raw Open-Meteo hourly precipitation probability.
Model B: city-specific logistic recalibration using logit(raw probability) only.
Forward-chaining folds: first 50% train; next five consecutive 10% blocks tested
with expanding training windows. No future observations enter a fold's fit.
ERA5 hourly event: precipitation > 0.1 mm in the corresponding hour.
"""
from pathlib import Path
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss
from scipy.special import logit

ROOT=Path(__file__).resolve().parent
P=pd.read_csv(ROOT/'om_hourly_prob_2024-05_2025-08.csv',parse_dates=['time']).set_index('time')
R=pd.read_csv(ROOT/'era5_hourly_precip_2024-05_2025-08.csv',parse_dates=['time']).set_index('time')
EXCL=pd.to_datetime(['2024-12-04','2024-12-05','2024-12-06'])
keep=~P.index.normalize().isin(EXCL)
P,R=P.loc[keep],R.loc[keep]
assert P.index.equals(R.index) and P.shape==(11640,19)
assert P.notna().all().all() and R.notna().all().all()
# 485 daily blocks; forward-chaining evaluation covers blocks 243..484 in five test folds.
N=len(P); fold_size= N//10
# Split by complete day, not by individual hours.
days=P.index.normalize().unique(); assert len(days)==485
folds=[]
start_train=242
for k in range(5):
    tr_end=start_train+k*48
    te_start=tr_end
    te_end=min(te_start+48,N//24)
    if k==4: te_end=len(days)
    folds.append((0,tr_end,te_start,te_end))

rows=[]; coefrows=[]
for city in P.columns:
    p=P[city].to_numpy(float)/100
    y=(R[city].to_numpy(float)>0.1).astype(int)
    raw_oof=[]; cal_oof=[]; y_oof=[]; dates_oof=[]
    for k,(a,b,c,d) in enumerate(folds,1):
        tr_idx=np.arange(b*24)
        te_idx=np.arange(c*24,d*24)
        xtr=logit(np.clip(p[tr_idx],1e-4,1-1e-4)).reshape(-1,1)
        xte=logit(np.clip(p[te_idx],1e-4,1-1e-4)).reshape(-1,1)
        # Near-unpenalized logistic MLE; high iteration cap for convergence.
        model=LogisticRegression(C=1e6,solver='lbfgs',max_iter=3000)
        model.fit(xtr,y[tr_idx])
        pc=model.predict_proba(xte)[:,1]
        raw_oof.extend(p[te_idx]); cal_oof.extend(pc); y_oof.extend(y[te_idx]); dates_oof.extend(P.index[te_idx])
        coefrows.append({'city':city,'fold':k,'train_hours':len(tr_idx),'test_hours':len(te_idx),
                         'intercept':float(model.intercept_[0]),'slope_logit_p':float(model.coef_[0,0]),
                         'train_start':str(P.index[0]),'train_end':str(P.index[b*24-1]),
                         'test_start':str(P.index[c*24]),'test_end':str(P.index[d*24-1])})
    raw=np.asarray(raw_oof); cal=np.asarray(cal_oof); yy=np.asarray(y_oof)
    rows.append({'city':city,'oof_hours':len(yy),'oof_days':len(yy)//24,
                 'ModelA_raw_Brier':brier_score_loss(yy,raw),'ModelB_logistic_recal_Brier':brier_score_loss(yy,cal),
                 'Brier_change_B_minus_A':brier_score_loss(yy,cal)-brier_score_loss(yy,raw),
                 'ModelA_raw_logloss':log_loss(yy,np.clip(raw,1e-6,1-1e-6)),
                 'ModelB_logistic_recal_logloss':log_loss(yy,np.clip(cal,1e-6,1-1e-6)),
                 'event_rate_oof':float(yy.mean()),'mean_raw_probability_oof':float(raw.mean()),
                 'mean_calibrated_probability_oof':float(cal.mean()),
                 'status':'EXPLORATORY_ROLLING_ORIGIN_CV_NOT_LOCKED_TEST'})

out=pd.DataFrame(rows); out.to_csv(ROOT/'rolling_origin_model_comparison.csv',index=False)
pd.DataFrame(coefrows).to_csv(ROOT/'rolling_origin_coefficients.csv',index=False)
print(out.to_string(index=False))
print('\nMean Brier A:',out.ModelA_raw_Brier.mean(),'B:',out.ModelB_logistic_recal_Brier.mean())
print('Cities B improved:',int((out.Brier_change_B_minus_A<0).sum()),'of',len(out))
