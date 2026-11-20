
import { useCallback, useEffect, useMemo, useState } from 'react';
import citiesJson from './data/cities.json';
import citySummaryJson from './data/city-summary.json';
import modelComparisonJson from './data/model-comparison.json';
import islandComparisonJson from './data/island-comparison.json';
import reliabilityBinsJson from './data/reliability-bins.json';
import { fetchAllLive, isCacheStale, readCache, windowFrom, type LiveData } from './live';
import type { City, CitySummary, IslandComparison, ModelComparison, ReliabilityBins } from './types';

const cityData = citiesJson as City[];
const results = citySummaryJson as CitySummary[];
const comps = modelComparisonJson as ModelComparison[];
const regions = islandComparisonJson as IslandComparison[];
const reliability = (reliabilityBinsJson as ReliabilityBins).cities;

const fmt = (n: number) => n.toFixed(3);
const signed = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(3)}`;
const pct = (n: number | null) => (n === null || n === undefined ? '–' : `${Math.round(n)}%`);

type Tab = 'live' | 'research' | 'method';

const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: 'Live Forecast' },
  { id: 'research', label: 'Research Lab' },
  { id: 'method', label: 'Methodology' },
];

/* ------------------------------------------------------------------ LIVE */

type LiveState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: LiveData; stale: boolean };

function LiveTab() {
  const [state, setState] = useState<LiveState>({ kind: 'loading' });
  const [region, setRegion] = useState('All regions');
  const [selected, setSelected] = useState('Manila');
  const [horizon, setHorizon] = useState(24);

  const load = useCallback(async () => {
    setState((s) => (s.kind === 'ready' ? { kind: 'ready', data: s.data, stale: true } : { kind: 'loading' }));
    try {
      const data = await fetchAllLive(cityData);
      setState({ kind: 'ready', data, stale: false });
    } catch (e) {
      setState((s) =>
        s.kind === 'ready'
          ? { kind: 'ready', data: s.data, stale: true }
          : { kind: 'error', message: e instanceof Error ? e.message : 'Unknown error' }
      );
    }
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached) setState({ kind: 'ready', data: cached, stale: isCacheStale(cached) });
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => cityData.filter((c) => region === 'All regions' || c.island === region),
    [region]
  );
  const currentCity = selected && filtered.some((c) => c.city === selected)
    ? selected
    : filtered[0].city;

  const chosen = state.kind === 'ready' ? state.data.cities.find((c) => c.city === currentCity) : undefined;
  const timeline = chosen ? windowFrom(chosen, horizon) : [];
  const nowPoint = chosen ? chosen.hourly.find((p) => p.time === chosen.currentTime) : undefined;

  const regionalMean =
    state.kind === 'ready'
      ? (() => {
          const vals = filtered
            .map((c) => state.data.cities.find((d) => d.city === c.city))
            .map((d) => d?.hourly.find((p) => p.time === d?.currentTime)?.probability ?? null)
            .filter((v): v is number => v !== null);
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        })()
      : null;

  return (
    <section className="live-wrap">
      <div className="live-banner">
        <span aria-hidden="true">⚠</span>
        <div>
          <strong>Live data — unverified, not part of the research evaluation.</strong>
          <span>
            These probabilities come directly from the Open-Meteo live forecast API and are displayed as served.
            They are separate from the frozen research results in the Research Lab.
          </span>
        </div>
      </div>

      <div className="live-toolbar">
        <label className="live-region">
          REGION
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option>All regions</option>
            <option>Luzon</option>
            <option>Visayas</option>
            <option>Mindanao</option>
          </select>
        </label>
        <div className="live-status">
          {state.kind === 'ready' && (
            <span className="live-updated">
              Updated {new Date(state.data.fetchedAt).toLocaleTimeString()} · {state.stale ? 'cache stale — refresh suggested' : 'fresh'}
            </span>
          )}
          <button className="live-refresh" onClick={() => void load()} disabled={state.kind === 'loading'}>
            {state.kind === 'loading' ? 'Fetching…' : 'Refresh'}
          </button>
        </div>
      </div>

      {state.kind === 'error' && (
        <div className="live-error" role="alert">
          <strong>Live data unavailable</strong>
          <span>Open-Meteo could not be reached ({state.message}). Check your connection, then retry. The frozen research results remain available in the Research Lab.</span>
          <button className="live-refresh" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {state.kind === 'loading' && (
        <div className="live-loading" role="status" aria-live="polite">
          Retrieving live forecasts for all 19 cities (one batched request)…
        </div>
      )}

      {state.kind === 'ready' && (
        <>
          <div className="live-grid">
            {filtered.map((c) => {
              const d = state.data.cities.find((x) => x.city === c.city)!;
              const p = d.hourly.find((x) => x.time === d.currentTime)?.probability ?? null;
              return (
                <button
                  key={c.city}
                  className={`live-city ${c.city === currentCity ? 'active' : ''}`}
                  onClick={() => setSelected(c.city)}
                  aria-pressed={c.city === currentCity}
                  aria-label={`${c.city}, current rainfall probability ${pct(p)}, ${c.island}`}
                >
                  <span className="live-city-name">{c.city}</span>
                  <span className={`live-pct ${p === null ? 'na' : p >= 60 ? 'wet' : p >= 30 ? 'mid' : 'dry'}`}>{pct(p)}</span>
                  <span className="live-island">{c.island}</span>
                </button>
              );
            })}
          </div>

          <div className="live-mean">
            Mean current probability across {filtered.length} {region === 'All regions' ? 'cities' : `cities (${region})`}:{' '}
            <b>{regionalMean === null ? '–' : `${fmt(regionalMean)}%`}</b>
          </div>

          {chosen && (
            <div className="panel detail-panel live-detail">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">LIVE HOURLY PROBABILITY</span>
                  <h3>{currentCity}</h3>
                </div>
                <div className="live-horizon">
                  <button className={horizon === 24 ? 'active' : ''} onClick={() => setHorizon(24)}>24 h</button>
                  <button className={horizon === 48 ? 'active' : ''} onClick={() => setHorizon(48)}>48 h</button>
                </div>
              </div>

              <div className="live-now">
                <div className="live-now-big">
                  <span>NOW (as served)</span>
                  <strong>{pct(nowPoint?.probability ?? null)}</strong>
                  <span className="live-now-time">{chosen.currentTime.replace('T', ' · ')}</span>
                </div>
                <div className="live-now-side">
                  <div><span>TEMPERATURE</span><b>{nowPoint?.temperature !== null && nowPoint?.temperature !== undefined ? `${nowPoint.temperature.toFixed(1)} °C` : '–'}</b></div>
                  <div><span>HUMIDITY</span><b>{nowPoint?.humidity !== null && nowPoint?.humidity !== undefined ? `${Math.round(nowPoint.humidity)}%` : '–'}</b></div>
                  <div><span>CLOUD COVER</span><b>{nowPoint?.cloud !== null && nowPoint?.cloud !== undefined ? `${Math.round(nowPoint.cloud)}%` : '–'}</b></div>
                  <div><span>EXPECTED RAIN NOW</span><b>{nowPoint?.precip !== null && nowPoint?.precip !== undefined ? `${nowPoint.precip.toFixed(1)} mm` : '–'}</b></div>
                </div>
              </div>

              <div className="live-timeline" role="img" aria-label={`Hourly rainfall probability timeline for ${currentCity}, next ${horizon} hours`}>
                {timeline.map((p) => (
                  <div key={p.time} className="live-tl-col" title={`${p.time.replace('T', ' ')} · ${pct(p.probability)}`}>
                    <div className="live-tl-bar-wrap">
                      <div
                        className={`live-tl-bar ${p.probability === null ? 'na' : p.probability >= 60 ? 'wet' : p.probability >= 30 ? 'mid' : 'dry'}`}
                        style={{ height: `${Math.max(p.probability ?? 0, 2)}%` }}
                      />
                    </div>
                    <span className="live-tl-hour">{p.time.slice(11, 13)}</span>
                  </div>
                ))}
              </div>
              <div className="live-legend">
                <span><i className="dot wet"/> 60%+</span>
                <span><i className="dot mid"/> 30–59%</span>
                <span><i className="dot dry"/> 0–29%</span>
                <span><i className="dot na"/> no data</span>
              </div>

              <div className="live-source">
                Source: Open-Meteo live forecast API · {chosen.currentTime.slice(0, 10)} · retrieved{' '}
                {new Date(state.data.fetchedAt).toLocaleTimeString()} · Coordinates{' '}
                {cityData.find((c) => c.city === currentCity)?.lat.toFixed(4)}, {cityData.find((c) => c.city === currentCity)?.lon.toFixed(4)}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- RESEARCH */

function ResearchTab() {
  const [region, setRegion] = useState('All regions');
  const [metric, setMetric] = useState<'brier' | 'logloss'>('brier');
  const [selected, setSelected] = useState('Davao City');
  const [sort, setSort] = useState('Model C Brier');

  const joined = useMemo(
    () => results.map((r) => ({ ...r, ...cityData.find((c) => c.city === r.city) })).filter((r) => region === 'All regions' || r.island === region),
    [region]
  );
  const ordered = [...joined].sort((a, b) =>
    sort === 'Model C Brier' ? a.brier_C - b.brier_C : sort === 'Largest C gain' ? a.delta_C_minus_A - b.delta_C_minus_A : a.city.localeCompare(b.city)
  );
  const chosen = results.find((r) => r.city === selected && (region === 'All regions' || cityData.find((c) => c.city === r.city)?.island === region)) ?? results.find((r) => region === 'All regions' || cityData.find((c) => c.city === r.city)?.island === region) ?? results[0];
  const selectedRegion = cityData.find((c) => c.city === chosen.city)?.island ?? 'Luzon';
  const best = results.reduce((a, b) => (a.brier_C < b.brier_C ? a : b));
  const worst = results.reduce((a, b) => (a.brier_C > b.brier_C ? a : b));
  const cB = comps.find((c) => c.comparison === 'C_minus_B')!;
  const cA = comps.find((c) => c.comparison === 'C_minus_A')!;
  // Bar scale spans all three models (audit fix: previously Model C only).
  const max = Math.max(
    ...ordered.flatMap((r) => (metric === 'brier' ? [r.brier_A, r.brier_B, r.brier_C] : [r.logloss_A, r.logloss_B, r.logloss_C])),
    0.01
  );

  return (
    <>
      <div className="frozen-banner">
        <span aria-hidden="true">🔒</span>
        <div>
          <strong>Research results — frozen, exploratory (May 2024 – Aug 2025).</strong>
          <span>
            These are the archived results of the model-comparison study. They are independent of the live forecast
            tab and never update automatically.
          </span>
        </div>
      </div>

      <div className="research-toolbar">
        <label>
          REGION
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option>All regions</option>
            <option>Luzon</option>
            <option>Visayas</option>
            <option>Mindanao</option>
          </select>
        </label>
        <label>
          METRIC
          <select value={metric} onChange={(e) => setMetric(e.target.value as 'brier' | 'logloss')}>
            <option value="brier">Brier score</option>
            <option value="logloss">Log loss</option>
          </select>
        </label>
        <label>
          SORT BY
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option>Model C Brier</option>
            <option>Largest C gain</option>
            <option>City name</option>
          </select>
        </label>
      </div>

      <div className="research-grid">
        {ordered.map((r) => (
          <button
            key={r.city}
            className={`research-city ${chosen.city === r.city ? 'active' : ''}`}
            onClick={() => setSelected(r.city)}
            aria-pressed={chosen.city === r.city}
          >
            <span className="research-city-name">{r.city}</span>
            <span className="research-city-score">{fmt(metric === 'brier' ? r.brier_C : r.logloss_C)}</span>
            <span className="research-city-region">{r.island}</span>
          </button>
        ))}
      </div>

      <div className="research-legend">
        <span>Selected city: <b>{chosen.city}</b> · {selectedRegion}</span>
        <span>Lower scores indicate better probabilistic accuracy.</span>
      </div>

      <div className="panel detail-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">CITY MODEL COMPARISON</span>
            <h3>{chosen.city}</h3>
          </div>
          <span className="panel-kicker">EXPLORATORY</span>
        </div>

        <div className="model-bars">
          {(['A', 'B', 'C'] as const).map((m) => {
            const value = metric === 'brier' ? chosen[`brier_${m}`] : chosen[`logloss_${m}`];
            return (
              <div className="model-bar-row" key={m}>
                <span>Model {m}</span>
                <div className="model-bar-track">
                  <div className={`model-bar model-${m.toLowerCase()}`} style={{ width: `${(value / max) * 100}%` }} />
                </div>
                <b>{fmt(value)}</b>
              </div>
            );
          })}
        </div>

        <div className="city-results">
          <div><span>Model C vs A</span><b>{signed(chosen.delta_C_minus_A)}</b></div>
          <div><span>Model C vs B</span><b>{signed(chosen.delta_C_minus_B)}</b></div>
          <div><span>City hourly observations</span><b>{chosen.n_hours.toLocaleString()}</b></div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">CROSS-CITY SUMMARY</span>
            <h3>Model C performance</h3>
          </div>
        </div>
        <div className="summary-stats">
          <div><span>Best city</span><b>{best.city}</b><small>{fmt(best.brier_C)} Brier</small></div>
          <div><span>Highest city score</span><b>{worst.city}</b><small>{fmt(worst.brier_C)} Brier</small></div>
          <div><span>Model C − B</span><b>{signed(cB.mean_delta)}</b><small>{cB.cities_improved} of {cB.n_cities} cities improved</small></div>
          <div><span>Model C − A</span><b>{signed(cA.mean_delta)}</b><small>{cA.cities_improved} of {cA.n_cities} cities improved</small></div>
        </div>
      </div>

      <div className="panel reliability-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">PROBABILITY RELIABILITY</span>
            <h3>{chosen.city}: forecast vs observed frequency</h3>
          </div>
          <span className="panel-kicker">ARCHIVED HOURLY BINS</span>
        </div>
        <p className="panel-note">
          Each bin groups hourly forecasts by predicted probability. The observed frequency is the share of
          those hours in which rain occurred. A perfectly calibrated forecast would have observed frequency
          close to the predicted probability.
        </p>
        <div className="reliability-chart">
          <div className="reliability-axis">
            <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
          </div>
          <div className="reliability-plot">
            <div className="reliability-gridlines">
              {[0, 25, 50, 75, 100].map((v) => <i key={v} style={{ bottom: `${v}%` }} />)}
            </div>
            <div className="reliability-diagonal" />
            {reliability[chosen.city]?.bins.map((bin) => (
              <div
                className="reliability-point"
                key={bin.range}
                title={`${bin.range}: predicted midpoint ${bin.midpoint_pct}%, observed ${bin.observed_freq === null ? 'not available' : `${(bin.observed_freq * 100).toFixed(1)}%`}, n=${bin.n.toLocaleString()}`}
                style={{
                  left: `${bin.midpoint_pct}%`,
                  bottom: `${(bin.observed_freq ?? 0) * 100}%`,
                  opacity: bin.n === 0 || bin.observed_freq === null ? 0.2 : 1,
                }}
              />
            ))}
          </div>
        </div>
        <div className="reliability-axis-labels">
          <span>Predicted rainfall probability</span>
          <span>Observed rainfall frequency</span>
        </div>
        <div className="reliability-table-wrap">
          <table className="reliability-table">
            <thead>
              <tr><th>Forecast bin</th><th>Hours</th><th>Observed frequency</th></tr>
            </thead>
            <tbody>
              {reliability[chosen.city]?.bins.map((bin) => (
                <tr key={bin.range}>
                  <td>{bin.range}</td>
                  <td>{bin.n.toLocaleString()}</td>
                  <td>{bin.observed_freq === null ? '–' : `${(bin.observed_freq * 100).toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-note">
          Source: archived Open-Meteo historical forecast/reanalysis comparison. Bins are pass-through
          summaries from the frozen reliability artifact; no values are recomputed in this interface.
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- METHODOLOGY */

function MethodTab() {
  return (
    <div className="method-grid">
      <div className="panel">
        <span className="panel-kicker">STUDY DESIGN</span>
        <h3>What was evaluated?</h3>
        <p>
          This exploratory study examines the reliability of hourly rainfall-probability forecasts across
          19 Philippine cities in Luzon, Visayas, and Mindanao. The archived evaluation window runs from
          May 2024 through August 2025.
        </p>
        <p>
          The unit of analysis is the city-hour forecast. Each forecast is compared with the corresponding
          observed rainfall outcome. The research results are frozen and do not change when live forecasts
          refresh.
        </p>
      </div>

      <div className="panel">
        <span className="panel-kicker">MODEL COMPARISON</span>
        <h3>Three forecast configurations</h3>
        <p>
          Models A, B, and C are compared using Brier score and log loss. Both are proper scoring rules:
          lower values indicate better probabilistic accuracy.
        </p>
        <p>
          Model comparisons are descriptive and exploratory. Differences should not be interpreted as
          causal effects or proof that one configuration will perform better in future periods.
        </p>
      </div>

      <div className="panel">
        <span className="panel-kicker">CALIBRATION</span>
        <h3>Forecast probability vs observed frequency</h3>
        <p>
          Reliability bins group forecasts by their predicted probability. For example, forecasts in the
          60–69% bin should be followed by rainfall approximately 60–69% of the time if they are well
          calibrated over the evaluation sample.
        </p>
        <p>
          The chart compares each bin's predicted midpoint with its archived observed rainfall frequency.
          Bins with no observations or unavailable frequencies are shown with reduced opacity.
        </p>
      </div>

      <div className="panel">
        <span className="panel-kicker">INTERPRETATION</span>
        <h3>What this does—and does not—show</h3>
        <p>
          The results describe performance within the archived evaluation period and selected cities.
          They do not establish performance in other locations, seasons, or future forecast periods.
        </p>
        <p>
          Live forecasts are displayed separately for practical exploration. They are not part of the frozen
          evaluation and should not be treated as validated predictions.
        </p>
      </div>

      <div className="panel">
        <span className="panel-kicker">DATA PROVENANCE</span>
        <h3>Archived and live data are separated</h3>
        <p>
          Research Lab metrics and reliability bins are loaded from local, version-controlled JSON
          artifacts. Live forecasts are retrieved separately from the Open-Meteo API.
        </p>
        <p>
          This separation preserves the research record: refreshing the live forecast cannot alter the
          archived model-comparison results.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- APP */

export default function App() {
  const [active, setActive] = useState<Tab>('live');

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">◉</span>
            <div>
              <p className="eyebrow">PHILIPPINE WEATHER PROBABILITY OBSERVATORY</p>
              <h1>Rainfall Forecasts, Explained</h1>
              <p className="header-subtitle">
                Explore live city forecasts and the research behind probability reliability.
              </p>
            </div>
          </div>
          <span className="version-tag">V3 · CITY CARDS</span>
        </div>
      </header>

      <nav className="tab-nav" aria-label="Main navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={active === tab.id ? 'active' : ''}
            onClick={() => setActive(tab.id)}
            aria-current={active === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="content-wrap">
        {active === 'live' && <LiveTab />}
        {active === 'research' && <ResearchTab />}
        {active === 'method' && <MethodTab />}
      </div>

      <footer className="app-footer">
        <p>Philippine Weather Probability Observatory · V3 City Cards</p>
        <p>Research results are exploratory and frozen. Live forecasts are unverified and separate from the research evaluation.</p>
      </footer>
    </main>
  );
}
