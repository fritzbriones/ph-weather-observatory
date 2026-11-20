import { useCallback, useEffect, useMemo, useState } from 'react';
import citiesJson from './data/cities.json';
import citySummaryJson from './data/city-summary.json';
import modelComparisonJson from './data/model-comparison.json';
import islandComparisonJson from './data/island-comparison.json';
import { fetchAllLive, isCacheStale, readCache, windowFrom, type LiveData } from './live';
import type { City, CitySummary, IslandComparison, ModelComparison } from './types';

const cityData = citiesJson as City[];
const results = citySummaryJson as CitySummary[];
const comps = modelComparisonJson as ModelComparison[];
const regions = islandComparisonJson as IslandComparison[];

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
            tab and never update automatically. No confirmatory claim is made: a future untouched period is
            reserved for validation.
          </span>
        </div>
      </div>

      <section className="section-head">
        <div><span className="section-index">01 / PERFORMANCE SNAPSHOT</span><h2>What the models show</h2></div>
        <p>Lower Brier score and log loss indicate better probabilistic performance.</p>
      </section>
      <section className="stat-grid">
        <div className="stat-card"><span className="stat-label">MODEL C vs. RAW MODEL A</span><strong>{signed(cA.macro_mean_daily_brier_difference)}</strong><span className="stat-foot">Macro daily Brier difference · 95% CI [{fmt(cA.ci_low)}, {fmt(cA.ci_high)}]</span></div>
        <div className="stat-card"><span className="stat-label">MODEL C vs. MODEL B</span><strong>{signed(cB.macro_mean_daily_brier_difference)}</strong><span className="stat-foot">Incremental daily Brier difference · 95% CI [{fmt(cB.ci_low)}, {fmt(cB.ci_high)}]</span></div>
        <div className="stat-card"><span className="stat-label">CITIES IMPROVED BY MODEL C</span><strong>18 <small>/ 19</small></strong><span className="stat-foot">Compared with logistic recalibration (Model B)</span></div>
        <div className="stat-card"><span className="stat-label">BEST / HIGHEST MODEL C BRIER</span><strong>{best.city}</strong><span className="stat-foot">Lowest: {fmt(best.brier_C)} · Highest: {worst.city} ({fmt(worst.brier_C)})</span></div>
      </section>

      <section className="section-head section-gap">
        <div><span className="section-index">02 / EXPLORE BY ISLAND GROUP</span><h2>Compare city-level results</h2></div>
        <div className="filters">
          <label>REGION<select value={region} onChange={(e) => setRegion(e.target.value)}><option>All regions</option><option>Luzon</option><option>Visayas</option><option>Mindanao</option></select><span aria-hidden="true">⌄</span></label>
          <label>RANK BY<select value={sort} onChange={(e) => setSort(e.target.value)}><option>Model C Brier</option><option>Largest C gain</option><option>City name</option></select><span aria-hidden="true">⌄</span></label>
        </div>
      </section>
      <section className="explore-grid">
        <div className="panel city-panel">
          <div className="panel-head">
            <div><span className="panel-kicker">CITY SCORECARD</span><h3>{region === 'All regions' ? 'All 19 cities' : region}</h3></div>
            <span className="count-pill">{ordered.length} CITIES</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>CITY</th><th>ISLAND GROUP</th><th>MODEL A</th><th>MODEL B</th><th>MODEL C</th><th>Δ C−A</th></tr></thead>
              <tbody>
                {ordered.map((r) => (
                  <tr key={r.city} className={chosen.city === r.city ? 'selected' : ''}>
                    <td><button className="city-link" aria-pressed={chosen.city === r.city} onClick={() => setSelected(r.city)}>{r.city}</button></td>
                    <td><span className={`region-tag ${String(r.island ?? '').toLowerCase()}`}>{r.island ?? '—'}</span></td>
                    <td>{fmt(r.brier_A)}</td><td>{fmt(r.brier_B)}</td><td className="strong-cell">{fmt(r.brier_C)}</td>
                    <td className={r.delta_C_minus_A < 0 ? 'improve' : 'decline'}>{signed(r.delta_C_minus_A)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-note">Select a city to inspect its scores. Δ is Model C minus Model A; negative values indicate lower loss.</div>
        </div>
        <div className="panel detail-panel">
          <div className="panel-head">
            <div><span className="panel-kicker">CITY DETAIL</span><h3>{chosen.city}</h3></div>
            <span className={`region-tag ${selectedRegion.toLowerCase()}`}>{selectedRegion}</span>
          </div>
          <div className="metric-switch">
            <button className={metric === 'brier' ? 'active' : ''} onClick={() => setMetric('brier')}>Brier score</button>
            <button className={metric === 'logloss' ? 'active' : ''} onClick={() => setMetric('logloss')}>Log loss</button>
          </div>
          <div className="bar-chart">
            {(['A', 'B', 'C'] as const).map((m) => {
              const v = metric === 'brier' ? chosen[`brier_${m}` as 'brier_A'] : chosen[`logloss_${m}` as 'logloss_A'];
              return (
                <div className="bar-row" key={m}>
                  <span className="bar-name">MODEL {m}</span>
                  <div className="bar-track"><div className={`bar-fill bar-${m.toLowerCase()}`} style={{ width: `${Math.min(v / max, 1) * 100}%` }} /></div>
                  <b>{fmt(v)}</b>
                </div>
              );
            })}
          </div>
          <div className="detail-foot">
            <div><span>OUT-OF-FOLD HOURS</span><strong>{chosen.oof_hours.toLocaleString()}</strong></div>
            <div><span>OUT-OF-FOLD DAYS</span><strong>{chosen.oof_days}</strong></div>
          </div>
          <div className="insight"><span aria-hidden="true">ⓘ</span><span>Model C {chosen.delta_C_minus_A < 0 ? 'reduced' : 'did not reduce'} {metric === 'brier' ? 'Brier score' : 'log loss'} versus Model A by {fmt(Math.abs(metric === 'brier' ? chosen.delta_C_minus_A : chosen.logloss_C - chosen.logloss_A))}.</span></div>
        </div>
      </section>

      <section className="section-head section-gap">
        <div><span className="section-index">03 / REGIONAL CONTEXT</span><h2>Model gains by island group</h2></div>
        <p>These are within-region model improvements, not tests of differences in regional reliability.</p>
      </section>
      <section className="region-grid">
        {(['Luzon', 'Visayas', 'Mindanao'] as const).map((name, i) => {
          const a = regions.find((r) => r.island === name && r.comparison === 'C_minus_A')!;
          const b = regions.find((r) => r.island === name && r.comparison === 'C_minus_B')!;
          return (
            <div className="region-card" key={name}>
              <div className="region-card-top"><span className={`region-mark mark-${i}`} /><h3>{name}</h3><span>{a.cities} CITIES</span></div>
              <div className="region-number">{signed(a.island_macro_mean_daily_brier_diff)}</div>
              <div className="region-caption">Model C − Model A · daily Brier difference</div>
              <div className="region-ci">95% CI [{fmt(a.ci_low)}, {fmt(a.ci_high)}]</div>
              <div className="region-rule" />
              <div className="region-sub">Incremental C − B: <b>{signed(b.island_macro_mean_daily_brier_diff)}</b></div>
            </div>
          );
        })}
      </section>
    </>
  );
}

/* ------------------------------------------------------------ METHOD */

function MethodTab() {
  return (
    <>
      <section className="section-head"><div><span className="section-index">04 / HOW TO READ THIS OBSERVATORY</span><h2>Transparent by design.</h2></div><p>Two data regimes coexist in this application and are never merged.</p></section>
      <section className="method-section">
        <div className="method-copy">
          <p><strong>Live forecast tab.</strong> Current probabilities retrieved from the Open-Meteo live forecast API at page load, in a single batched request for all 19 cities. Shown as served, unverified, with a retrieval timestamp. Not part of any research evaluation.</p>
          <p><strong>Research Lab tab.</strong> Frozen results of an exploratory model comparison over May 2024 – Aug 2025: hourly precipitation probabilities evaluated against ERA5 (seamless) hourly precipitation, with an event defined as precipitation greater than 0.1 mm in the hour. The archived probability series is stitched; individual forecast-run and lead-time provenance cannot be verified.</p>
          <a className="text-link" href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Open-Meteo API documentation <span aria-hidden="true">↗</span></a>
          <a className="text-link" href="https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview" target="_blank" rel="noreferrer">ERA5 (Copernicus CDS) <span aria-hidden="true">↗</span></a>
        </div>
        <div className="method-cards">
          <div><span className="model-badge a">A</span><div><strong>Raw forecast</strong><p>Archived hourly precipitation probability, as served.</p></div></div>
          <div><span className="model-badge b">B</span><div><strong>Logistic recalibration</strong><p>City-specific logistic model using logit(Model A) only.</p></div></div>
          <div><span className="model-badge c">C</span><div><strong>Recalibration + covariates</strong><p>L2 logistic model adding forecast-side temperature, humidity, and cloud cover.</p></div></div>
        </div>
      </section>
      <section className="limitations">
        <div className="limit-title"><span aria-hidden="true">⚠</span><h3>Interpretation guardrails</h3></div>
        <ul>
          <li>The full historical period was previously inspected; these results are exploratory, not a locked independent test.</li>
          <li>ERA5 is a gridded reference dataset, not ground-truth station observation.</li>
          <li>Forecast probability lead-time provenance is not verified; no fixed-lead claim is made.</li>
          <li>Model C covariates come from the same forecast product, not independent observations.</li>
          <li>Model improvement does not establish whether regional forecast reliability differs. That requires a separate direct regional test.</li>
          <li>Live forecasts displayed on this site are unverified and are not research output.</li>
        </ul>
      </section>
    </>
  );
}

/* ----------------------------------------------------------------- APP */

export default function App() {
  const [tab, setTab] = useState<Tab>('live');

  // Takeaway values are computed at runtime from the frozen research JSONs bundled
  // with this app (city-summary.json, model-comparison.json). No number is typed
  // by hand, so the copy cannot drift from the frozen record.
  const citiesImproved = results.filter((r) => r.delta_C_minus_A < 0).length;
  const cACompare = comps.find((c) => c.comparison === 'C_minus_A')!;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><span aria-hidden="true">☔</span></div>
          <div><span className="eyebrow">RESEARCH OBSERVATORY</span><strong>PH WEATHER <i>PROBABILITY</i></strong></div>
        </div>
        <div className="top-meta"><span className="live-dot" /> LIVE EDITION · 19 CITIES</div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="kicker"><span /> PHILIPPINES · LUZON / VISAYAS / MINDANAO</div>
          <h1>How reliable are<br /><em>rainfall probabilities?</em></h1>
          <p className="hero-lede">A live look at rainfall forecast probabilities across 19 Philippine cities — beside a frozen exploratory study of whether recalibration improves them.</p>
          <div className="hero-tags">
            <span><span aria-hidden="true">◉</span> Live Open-Meteo data</span>
            <span><span aria-hidden="true">⌖</span> 3 island groups</span>
            <span><span aria-hidden="true">▤</span> Frozen research: May 2024 – Aug 2025</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orb orb-one" /><div className="orb orb-two" />
          <div className="rain-card">
            <div className="rain-card-top"><span>HOURLY VERIFICATION</span><span className="pulse" /></div>
            <div className="rain-prob">70<span>%</span></div>
            <div className="rain-label">Illustrative probability</div>
            <div className="rain-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="rain-card-bottom"><span>FORECAST</span><span>PRECIPITATION</span></div>
          </div>
          <div className="floating-chip"><span className="chip-dot" /> Model comparison</div>
        </div>
      </section>

      <section className="takeaway" aria-label="Research summary">
        <p>
          In the frozen exploratory study (May 2024 – Aug 2025), statistical recalibration lowered the
          Brier score versus raw forecasts in <b>{citiesImproved} of {results.length}</b> cities, with a national macro
          improvement of <b>{signed(cACompare.macro_mean_daily_brier_difference)}</b> (95% CI&nbsp;
          [{fmt(cACompare.ci_low)}, {fmt(cACompare.ci_high)}]).
          These are archived exploratory findings, not a promise about tomorrow's forecast.
          Live probabilities on this site are served unverified; a validation on a new, untouched period is planned.
        </p>
        <button className="takeaway-link" onClick={() => setTab('research')}>
          Explore the Research Lab <span aria-hidden="true">→</span>
        </button>
      </section>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'live' && <LiveTab />}
        {tab === 'research' && <ResearchTab />}
        {tab === 'method' && <MethodTab />}
      </main>

      <footer>
        <div className="footer-brand"><span aria-hidden="true">☔</span> PH WEATHER PROBABILITY OBSERVATORY</div>
        <span>Live data: Open-Meteo forecast API · Research data: Open-Meteo Historical Forecast API and ERA5 (seamless) · ERA5 is a gridded reference, not ground truth.</span>
        <span>Research results exploratory · Live forecasts unverified · GitHub Edition v2.0</span>
      </footer>
    </>
  );
}
