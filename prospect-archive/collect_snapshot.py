#!/usr/bin/env python3
"""Prospective-window daily forecast snapshot collector (P1 archival layer).

Each day shortly after midnight Asia/Manila, pulls the completed Manila day
from the Open-Meteo HISTORICAL FORECAST API (the archived record of the
forecast as issued) for all 19 study cities, and appends one dated CSV under
prospect-archive/snapshots/.

Governance rules, by design:
  * Writes ONLY under prospect-archive/. Never reads or modifies anything
    under research/ except running verify_frozen_artifacts.py as a guard.
  * Records INPUT data (issued forecasts) only: precipitation_probability,
    temperature_2m, relative_humidity_2m, cloud_cover. It never joins
    outcomes, never computes scores, and never compares models.
  * Refuses to run if the frozen-artifact manifest verification fails, so a
    tampered frozen state can never be silently archived around.
  * The authoritative scoring dataset remains a FRESH pull of the archive
    API plus final ERA5 at P2 (per the locked pre-registration,
    OSF DOI 10.17605/OSF.IO/HYS58). These snapshots are supplementary
    field evidence of what the API served, and a hedge against upstream
    archive revisions.
"""
import csv, json, os, subprocess, sys, time, datetime, urllib.parse

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CITIES_FILE = os.path.join(REPO_ROOT, "src", "data", "cities.json")
OUT_DIR = os.path.join(REPO_ROOT, "prospect-archive", "snapshots")
VARS = "precipitation_probability,temperature_2m,relative_humidity_2m,cloud_cover"
ARCHIVE_API = "https://historical-forecast-api.open-meteo.com/v1/forecast"
MANILA = datetime.timezone(datetime.timedelta(hours=8))

def verify_frozen():
    """Hash guard: refuse to archive anything unless frozen state is intact."""
    r = subprocess.run([sys.executable, "research/verify_frozen_artifacts.py", "verify"],
                       cwd=REPO_ROOT, capture_output=True, text=True)
    if r.returncode != 0 or "[OK]" not in r.stdout:
        print("FROZEN MANIFEST VERIFICATION FAILED - aborting snapshot.", file=sys.stderr)
        print(r.stdout[-2000:], file=sys.stderr)
        sys.exit(2)

def fetch(lat, lon):
    url = (f"{ARCHIVE_API}?latitude={lat}&longitude={lon}&hourly={VARS}"
           f"&past_days=1&timezone=Asia%2FManila")
    for attempt in range(5):
        r = subprocess.run(["curl", "-s", "--max-time", "60", url],
                           capture_output=True, text=True)
        try:
            return json.loads(r.stdout)
        except (json.JSONDecodeError, TypeError):
            time.sleep(6 + attempt * 6)
    raise RuntimeError(f"fetch failed after retries for {lat},{lon}")

def main():
    verify_frozen()
    cities = json.load(open(CITIES_FILE))
    assert len(cities) == 19, f"expected 19 cities, found {len(cities)}"
    fetched_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
    # Target day = the Manila calendar day that just completed at run time.
    day = (datetime.datetime.now(MANILA) - datetime.timedelta(days=1)).date()
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{day.isoformat()}.csv")
    if os.path.exists(out_path):
        print(f"snapshot for {day} already exists - nothing to do")
        return
    rows, seen = [], set()
    for c in cities:
        d = fetch(c["lat"], c["lon"])
        h = d.get("hourly", {})
        times = h.get("time", [])
        for i, t in enumerate(times):
            if not t.startswith(day.isoformat()):
                continue
            row = {"forecast_valid_time_local": t, "city": c["city"],
                   "lat": c["lat"], "lon": c["lon"],
                   "fetched_at_utc": fetched_utc, "source_api": ARCHIVE_API}
            for v in VARS.split(","):
                row[v] = h.get(v, [None]*len(times))[i]
            key = (c["city"], t)
            assert key not in seen, f"duplicate row {key}"
            seen.add(key)
            rows.append(row)
    assert len(rows) == 19 * 24, f"expected 456 rows, got {len(rows)}"
    with open(out_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {out_path}: {len(rows)} rows for {day}")

if __name__ == "__main__":
    main()
