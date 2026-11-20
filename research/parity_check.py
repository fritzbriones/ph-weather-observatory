"""P0-7 live-vs-archive parity check: 19 cities, Model C variables.

Compares the live Open-Meteo forecast API against the Historical Forecast API:
schema presence, units, timezone, timestamps, missing-value flags, and
value agreement on the overlapping near-term hours. Produces a dated parity
report JSON as pre-registration evidence. Purely observational; changes nothing.
"""
import json, time, subprocess, datetime

VARS = "precipitation_probability,temperature_2m,relative_humidity_2m,cloud_cover"
cities = json.load(open("/tmp/pn/src/data/cities.json"))
WINDOW_DAYS = 2

def fetch(base, lat, lon):
    url = (f"{base}?latitude={lat}&longitude={lon}&hourly={VARS}"
           f"&forecast_days={WINDOW_DAYS}&timezone=Asia%2FManila")
    last = None
    for attempt in range(4):
        r = subprocess.run(["curl", "-s", "--max-time", "60", url],
                           capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return json.loads(r.stdout)
        last = r.returncode
        time.sleep(6 + attempt * 6)
    raise RuntimeError(f"fetch failed after retries (curl exit {last})")

report = {"checked_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "live_api": "https://api.open-meteo.com/v1/forecast",
          "archive_api": "https://historical-forecast-api.open-meteo.com/v1/forecast",
          "variables": VARS.split(","), "cities": {}}
overall = {"schema_ok": True, "units_ok": True, "timestamps_ok": True, "missing_flags_ok": True, "ok": True}
for c in cities:
    lat, lon, name = c["lat"], c["lon"], c["city"]
    live = fetch("https://api.open-meteo.com/v1/forecast", lat, lon)
    arch = fetch("https://historical-forecast-api.open-meteo.com/v1/forecast", lat, lon)
    u_l, u_a = live["hourly_units"], arch["hourly_units"]
    units_ok = all(u_l.get(v) == u_a.get(v) for v in VARS.split(","))
    schema_ok = all(v in live["hourly"] and v in arch["hourly"] for v in VARS.split(","))
    tz_ok = live.get("timezone_abbreviation") == arch.get("timezone_abbreviation") == "GMT+8" and \
            live.get("utc_offset_seconds") == arch.get("utc_offset_seconds") == 28800
    ts_ok = live["hourly"]["time"] == arch["hourly"]["time"]
    miss_ok = True; diffs = {}
    for v in VARS.split(","):
        lv, av = live["hourly"][v], arch["hourly"][v]
        if (any(x is None for x in lv)) != (any(x is None for x in av)):
            miss_ok = False
        pairs = [(l, a) for l, a in zip(lv, av) if l is not None and a is not None]
        d = max(abs(l - a) for l, a in pairs)
        diffs[v] = {"n_compared": len(pairs), "max_abs_diff": d,
                    "missing_live": sum(x is None for x in lv),
                    "missing_archive": sum(x is None for x in av)}
        if miss_ok is False:
            break
    ok = schema_ok and units_ok and ts_ok and miss_ok
    report["cities"][name] = {"lat": lat, "lon": lon, "schema_ok": schema_ok,
        "units_ok": units_ok, "timezone_ok": tz_ok, "timestamps_ok": ts_ok,
        "missing_flags_ok": miss_ok, "ok": ok, "variable_diffs": diffs}
    overall["ok"] &= ok; overall["schema_ok"] &= schema_ok; overall["units_ok"] &= units_ok
    overall["timestamps_ok"] &= ts_ok; overall["missing_flags_ok"] &= miss_ok
    time.sleep(1.2)  # rate-limit courtesy

report["overall"] = overall
out = "/home/user/tool-results/data-analysis/ph-p0/model-c/parity_report_2026-11-20.json"
json.dump(report, open(out, "w"), indent=2)
print("OVERALL:", overall)
worst = max((d["max_abs_diff"], v, n) for n, r in report["cities"].items()
            for v, d in r["variable_diffs"].items())
print(f"Worst value discrepancy across all cities/vars: {worst[0]:.4f} ({worst[1]}, {worst[2]})")
print("Saved:", out)
