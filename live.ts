// Live Open-Meteo fetch layer.
// Design decisions (pre-committed, see research/PRE-REGISTRATION.md):
//  - ONE batched multi-location request for all 19 cities (comma-separated
//    coordinates), NOT 19 separate requests.
//  - Responses cached in sessionStorage; manual refresh only (no polling).
//  - Retrieved data is displayed as UNVERIFIED live information and is never
//    mixed with the frozen research results.

import type { City } from './types';

export interface HourlyPoint {
  time: string;              // ISO local (Asia/Manila), e.g. "2026-11-20T14:00"
  probability: number | null; // precipitation_probability (%)
  precip: number | null;      // precipitation (mm)
  temperature: number | null;
  humidity: number | null;
  cloud: number | null;
}

export interface CityLive {
  city: string;
  hourly: HourlyPoint[];
  currentTime: string;
}

export interface LiveData {
  fetchedAt: string; // ISO UTC timestamp of the successful fetch
  cities: CityLive[];
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: { time: string; temperature_2m: number; relative_humidity_2m: number; cloud_cover: number; precipitation: number; precipitation_probability: number };
  hourly?: {
    time: string[];
    precipitation_probability: (number | null)[];
    precipitation: (number | null)[];
    temperature_2m: (number | null)[];
    relative_humidity_2m: (number | null)[];
    cloud_cover: (number | null)[];
  };
}

const CACHE_KEY = 'phwpo-live-v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // treat cache older than 10 min as stale (still shown, but refresh suggested)

export function isCacheStale(data: LiveData): boolean {
  return Date.now() - new Date(data.fetchedAt).getTime() > CACHE_TTL_MS;
}

export function readCache(): LiveData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveData;
    if (!parsed || !Array.isArray(parsed.cities) || parsed.cities.length !== 19) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: LiveData) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* storage may be full or blocked; live data still shown in memory */
  }
}

/**
 * Fetch live hourly forecasts for ALL cities in a single batched request.
 * Open-Meteo supports multiple coordinates per request, so 19 cities = 1 call.
 */
export async function fetchAllLive(cities: City[]): Promise<LiveData> {
  const lat = cities.map((c) => c.lat).join(',');
  const lon = cities.map((c) => c.lon).join(',');
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lon}` +
    '&hourly=precipitation_probability,precipitation,temperature_2m,relative_humidity_2m,cloud_cover' +
    '&forecast_days=2&timezone=Asia%2FManila';

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo request failed (HTTP ${res.status})`);
  const json = (await res.json()) as OpenMeteoResponse | OpenMeteoResponse[];
  const arr = Array.isArray(json) ? json : [json];
  if (arr.length !== cities.length) {
    throw new Error(`Open-Meteo returned ${arr.length} locations, expected ${cities.length}`);
  }

  const out: CityLive[] = cities.map((c, i) => {
    const r = arr[i];
    const h = r.hourly;
    if (!h || !h.time || h.time.length === 0) {
      throw new Error(`Open-Meteo returned no hourly data for ${c.city}`);
    }
    const hourly: HourlyPoint[] = h.time.map((t, k) => ({
      time: t,
      probability: h.precipitation_probability?.[k] ?? null,
      precip: h.precipitation?.[k] ?? null,
      temperature: h.temperature_2m?.[k] ?? null,
      humidity: h.relative_humidity_2m?.[k] ?? null,
      cloud: h.cloud_cover?.[k] ?? null,
    }));
    // The "current" hour: use the API's current time if present, else the
    // latest hour not in the future.
    const nowIso = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 13) + ':00';
    let currentTime = r.current?.time ?? hourly[hourly.length - 1].time;
    if (!hourly.some((p) => p.time === currentTime)) {
      const lastPast = [...hourly].reverse().find((p) => p.time <= nowIso);
      currentTime = lastPast?.time ?? hourly[hourly.length - 1].time;
    }
    return { city: c.city, hourly, currentTime };
  });

  const data: LiveData = { fetchedAt: new Date().toISOString(), cities: out };
  writeCache(data);
  return data;
}

/** Hourly points from the current hour, up to `horizon` hours ahead (inclusive). */
export function windowFrom(data: CityLive, horizon: number): HourlyPoint[] {
  const start = data.hourly.findIndex((p) => p.time === data.currentTime);
  const s = start >= 0 ? start : 0;
  return data.hourly.slice(s, s + horizon);
}
