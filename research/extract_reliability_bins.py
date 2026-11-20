#!/usr/bin/env python3
"""
extract_reliability_bins.py
Deterministic extraction of src/data/reliability-bins.json from the frozen
research record artifact om_hourly_reliability.json.
GOVERNANCE (V3 spec rule 3: no recomputation of historical results):
- Every value in the output is a byte-preserving pass-through of the source
fields. No statistic is recomputed, no rounding is changed, no filtering
or re-binning is applied.
- Field mapping (source -> output):
city                 -> cities[city]
"n hours"            -> n_hours
"hourly wet rate"    -> hourly_wet_rate
"mean prob"          -> mean_prob_pct
"hourly Brier"       -> hourly_brier
"base rate Brier"    -> base_rate_brier
bins[i] = [range, n, observed_freq]
-> bins[i] = {range, n, observed_freq}
- The source artifact's own window (as recorded: 11,641 h/city, May 2024 -
Aug 2025 hourly window as originally pulled, incl. Dec 6 h23) is carried
through unchanged and documented in the metadata block. Partial-day
exclusions (Dec 4-6) applied to the MODEL runs in verification round 2
do not alter this artifact; the difference is at most 1 hour per city.
Usage: python3 extract_reliability_bins.py <source.json> <output.json>
"""
import hashlib
import json
import sys
from pathlib import Path

def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def main() -> int:
    if len(sys.argv) != 3:
        print("usage: extract_reliability_bins.py <source.json> <output.json>", file=sys.stderr)
        return 1
        
    src_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    src = json.loads(src_path.read_text(encoding="utf-8"))
    cities = {}
    
    for entry in src:
        city = entry["city"]
        bins = [
            {"range": b[0], "n": b[1], "observed_freq": b[2]}
            for b in entry["bins"]
        ]
        cities[city] = {
            "n_hours": entry["n hours"],
            "bin_hours": sum(b["n"] for b in bins),  # source convention: bins cover p 0-99 only
            "hourly_wet_rate": entry["hourly wet rate"],
            "mean_prob_pct": entry["mean prob"],
            "hourly_brier": entry["hourly Brier"],
            "base_rate_brier": entry["base rate Brier"],
            "bins": bins,
        }
        
        # Documentation check: bins cover the p 0-99 hours; the source artifact
        # excludes p=100 hours from binning (verified against the raw hourly CSV:
        # bin counts equal the count of 0 <= p < 100 hours). n_hours is the full
        # valid-hour count recorded in the source (11,641 h/city incl. p=100).
        print(f"[info] {city}: n_hours={cities[city]['n_hours']}, "
              f"bin_hours={cities[city]['bin_hours']} (p 0-99 convention)")
              
    payload = {
        "meta": {
            "description": "Per-city reliability bins for the V3 plain-language city cards. "
                           "Deterministic pass-through extraction; no values recomputed.",
            "source_artifact": "om_hourly_reliability.json",
            "source_sha256": sha256_of(src_path),
            "extraction_script": "research/extract_reliability_bins.py",
            "window": "May 2024 - Aug 2025 hourly series as recorded in the source artifact "
                      "(11,641 valid hours/city as pulled; includes Dec 6, 2024 h23). Model-side "
                      "round-2 exclusions (Dec 4-6) were not applied to this artifact.",
            "bin_convention": "Source bins cover forecast probabilities of 0-99%; hours with "
                              "p=100 are recorded in n_hours and the Brier fields but are not "
                              "binned. bin_hours = sum of bin counts (p 0-99 hours).",
            "frozen_record_note": "Part of the frozen research record; bin observed_freq "
                                  "values are the archived source values, not recomputed.",
        },
        "cities": dict(sorted(cities.items())),
    }
    
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"[OK] Extracted {len(cities)} cities -> {out_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
