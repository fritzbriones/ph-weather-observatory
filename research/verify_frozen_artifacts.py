
#!/usr/bin/env python3
"""
verify_frozen_artifacts.py (REV 2)
Hardened Research-Integrity Safeguard for Philippine Weather Probability Observatory (V3).

REV 2 changes (2026-11-20):
  - REQUIRED_FROZEN_INVENTORY corrected to the ACTUAL V2.0 frozen artifacts
    (the previous list named placeholder paths that do not exist in V2.0).
  - AUTHORITY_SHA256 embeds the independently verified V2.0 baseline hashes
    (verified against the V2.0 GitHub Release asset V2.0-SHA256SUMS.txt and
    the repo's own src/data/SHA256SUMS.txt; both cross-checked 4/4 on
    2026-11-20). `generate` and `verify` both fail if the working files do
    not match this authority: the baseline can never be silently regenerated
    from whatever happens to be in the working directory.
  - Additive artifacts (e.g., research/rolling_origin_coefficients.csv,
    src/data/reliability-bins.json) are added ONLY through the explicit
    `add-artifact` subcommand, which requires a provenance note, is refused
    for the four authoritative V2.0 files, and never alters their hashes.
  - audit-copy now requires source_file to be listed in the frozen manifest.

Enforced governance rules (unchanged in spirit):
1. IMMUTABLE BASELINE: refuses to overwrite an existing frozen manifest without an
   explicit force flag; refuses to generate when working files deviate from the
   established V2.0 authority hashes; refuses to re-define the authoritative four.
2. COMPLETE INVENTORY: detects modified AND missing/deleted frozen files.
3. FIELD-EXACT COPY AUDIT: validates every displayed UI metric against its exact
   (city_id, source_file, json_path) target - never global number pooling.
"""

import argparse
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# ---------------------------------------------------------------------------
# ESTABLISHED V2.0 AUTHORITY (do not edit without a dated, reviewed decision)
# ---------------------------------------------------------------------------

# Independently verified on 2026-11-20 by three routes that must agree:
#   (a) recomputation from the live repository (raw.githubusercontent.com, main)
#   (b) the repo's own src/data/SHA256SUMS.txt
#   (c) the GitHub Release archive for tag V2.0 (asset V2.0-SHA256SUMS.txt)

AUTHORITY_BASELINE_TAG = "V2.0"
AUTHORITY_BASELINE_COMMIT = "c2971594a779d09bf5f965b3a040efe52e8eba33"

AUTHORITY_SHA256: Dict[str, str] = {
    "src/data/cities.json":
        "478cbd8ae25c7f3155499a99fa2df77eb88b427af8f03f983cb5859497e68c77",
    "src/data/city-summary.json":
        "ecb17a2949ebfd620eeb9ea58a948d640351f4b5e902ca0f715648aa0b0a438b",
    "src/data/island-comparison.json":
        "7f159f8f7febbbb643cd4253398ba1666072ef536eaeb6f6b877f8c20474c592",
    "src/data/model-comparison.json":
        "09b21336f927c20a0174a9ea33cd172d9d89ad978fddb79e4a885bc85e9b2369",
}

REPO_DATA_MANIFEST = "src/data/SHA256SUMS.txt"

REQUIRED_FROZEN_INVENTORY: List[str] = sorted(AUTHORITY_SHA256.keys())

MANIFEST_PATH = Path("research/FROZEN-SHA256-MANIFEST.json")


def compute_sha256(filepath: Path) -> str:
    """Compute exact SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    with filepath.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def get_git_tag_commit(tag_name: str = AUTHORITY_BASELINE_TAG) -> str:
    """Return the commit SHA the tag points at, or '' if unavailable."""
    try:
        res = subprocess.run(
            ["git", "rev-parse", f"{tag_name}^{{commit}}"],
            capture_output=True,
            text=True,
            check=True,
        )
        return res.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""


def check_authority(errors: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Verify the working directory's four authoritative V2.0 files against the
    embedded authority hashes.
    """
    verified: Dict[str, Dict[str, Any]] = {}

    for rel_path, expected_hash in sorted(AUTHORITY_SHA256.items()):
        p = Path(rel_path)

        if not p.is_file():
            errors.append(
                f"AUTHORITY FILE MISSING: {rel_path} "
                f"(expected hash {expected_hash})"
            )
            continue

        actual = compute_sha256(p)

        if actual != expected_hash:
            errors.append(
                f"AUTHORITY HASH MISMATCH: {rel_path}\n"
                f"    V2.0 authority: {expected_hash}\n"
                f"    working file:   {actual}\n"
                f"    REFUSING: the baseline cannot be (re)defined from working files."
            )
        else:
            verified[rel_path] = {
                "sha256": actual,
                "size_bytes": p.stat().st_size
            }

    dm = Path(REPO_DATA_MANIFEST)

    if dm.is_file():
        try:
            for line in dm.read_text(encoding="utf-8").splitlines():
                line = line.strip()

                if not line:
                    continue

                parts = line.split()

                if len(parts) != 2:
                    continue

                file_hash, name = parts
                rel = f"src/data/{name}"

                if rel in AUTHORITY_SHA256 and file_hash != AUTHORITY_SHA256[rel]:
                    errors.append(
                        f"REPO MANIFEST CONFLICT: {REPO_DATA_MANIFEST} lists a "
                        f"different hash for {name} than the established V2.0 "
                        f"authority. Resolve before proceeding."
                    )

        except OSError as exc:
            errors.append(f"Could not read {REPO_DATA_MANIFEST}: {exc}")

    return verified


def load_manifest(manifest_file: Path) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(manifest_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(
            f"[FAIL] Cannot read manifest {manifest_file}: {exc}",
            file=sys.stderr
        )
        return None


def cmd_generate(args: argparse.Namespace) -> int:
    """
    Write the initial frozen manifest ONLY IF the working directory reproduces
    the established V2.0 authority byte-for-byte.
    """

    manifest_file = Path(args.manifest)

    if manifest_file.exists() and not args.force_overwrite_baseline:
        print(
            f"[BLOCKED] Refusing to overwrite existing baseline manifest: {manifest_file}\n"
            "          Overwriting a frozen manifest can mask unauthorized edits to V2.0 data.\n"
            "          If you are intentionally re-initializing from verified V2.0, pass --force-overwrite-baseline.",
            file=sys.stderr,
        )
        return 1

    tag_commit = get_git_tag_commit(args.tag)

    if (
        tag_commit
        and args.tag == AUTHORITY_BASELINE_TAG
        and tag_commit != AUTHORITY_BASELINE_COMMIT
    ):
        print(
            f"[BLOCKED] Git tag '{args.tag}' now points at {tag_commit}, but the "
            f"established V2.0 baseline commit is {AUTHORITY_BASELINE_COMMIT}.\n"
            "          Refusing to re-baseline against a moved tag.",
            file=sys.stderr,
        )
        return 1

    if not tag_commit and not args.allow_no_git:
        print(
            f"[BLOCKED] Git tag '{args.tag}' not found in repository.\n"
            "          Ensure V2.0 is tagged before locking the baseline manifest.",
            file=sys.stderr,
        )
        return 1

    errors: List[str] = []
    verified = check_authority(errors)

    if errors or len(verified) != len(AUTHORITY_SHA256):
        print(
            "[FAIL] Working directory does NOT reproduce the established V2.0 "
            "baseline. Manifest generation aborted (no silent re-baselining).",
            file=sys.stderr,
        )

        for err in errors:
            print(f"  * {err}", file=sys.stderr)

        return 1

    manifest_payload = {
        "baseline_tag": args.tag,
        "baseline_commit": tag_commit or "UNVERIFIED_NO_GIT",
        "authority": "V2.0 Release asset V2.0-SHA256SUMS.txt (independently verified 2026-11-20)",
        "required_inventory": REQUIRED_FROZEN_INVENTORY,
        "files": verified,
        "additive_artifacts": {},
    }

    manifest_file.parent.mkdir(parents=True, exist_ok=True)

    manifest_file.write_text(
        json.dumps(manifest_payload, indent=2) + "\n",
        encoding="utf-8"
    )

    print(
        f"[OK] Generated frozen baseline manifest ({len(verified)} authoritative files, "
        f"hashes from the established V2.0 authority) -> {manifest_file}"
    )

    return 0


def manifest_keys(manifest: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Union of authoritative and additive entries recorded in the manifest."""

    out: Dict[str, Dict[str, Any]] = dict(manifest.get("files", {}))
    out.update(manifest.get("additive_artifacts", {}))

    return out


def cmd_add_artifact(args: argparse.Namespace) -> int:
    """
    Explicit, reviewed addition of a NEW artifact to the manifest.
    """

    if args.path in AUTHORITY_SHA256:
        print(
            f"[BLOCKED] {args.path} is one of the four authoritative V2.0 files. "
            "Its hash is fixed by the established baseline and cannot be re-added.",
            file=sys.stderr,
        )
        return 1

    if len((args.note or "").strip()) < 20:
        print(
            "[BLOCKED] A provenance/note of at least 20 characters is required "
            "(document the source artifact this file was derived from, byte-exactly).",
            file=sys.stderr,
        )
        return 1

    manifest_file = Path(args.manifest)
    manifest = load_manifest(manifest_file)

    if manifest is None:
        return 1

    p = Path(args.path)

    if not p.is_file():
        print(f"[FAIL] Artifact not found: {args.path}", file=sys.stderr)
        return 1

    existing = manifest.get("additive_artifacts", {})

    if args.path in existing and not args.replace:
        print(
            f"[BLOCKED] {args.path} already recorded. Use --replace with a note "
            "explaining why the artifact is being redefined.",
            file=sys.stderr,
        )
        return 1

    existing[args.path] = {
        "sha256": compute_sha256(p),
        "size_bytes": p.stat().st_size,
        "added_date": args.date if args.date else None,
        "provenance_note": args.note.strip(),
    }

    manifest["additive_artifacts"] = dict(sorted(existing.items()))

    manifest_file.write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8"
    )

    print(
        f"[OK] Recorded additive artifact {args.path} with provenance note."
    )

    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    """
    Verify completeness and exact hashes of all frozen artifacts, and re-assert
    the embedded V2.0 authority for the four baseline files.
    """

    manifest_file = Path(args.manifest)

    if not manifest_file.is_file():
        print(f"[FAIL] Manifest not found: {manifest_file}", file=sys.stderr)
        return 1

    manifest = load_manifest(manifest_file)

    if manifest is None:
        return 1

    entries = manifest_keys(manifest)

    # 1) The four authoritative files must match the EMBEDDED authority.

    authority_errors: List[str] = []

    for rel_path, expected_hash in sorted(AUTHORITY_SHA256.items()):
        p = Path(rel_path)

        if not p.is_file():
            authority_errors.append(f"MISSING AUTHORITY FILE: {rel_path}")
            continue

        actual = compute_sha256(p)

        if actual != expected_hash:
            authority_errors.append(
                f"AUTHORITY HASH MISMATCH: {rel_path}\n"
                f"    expected (V2.0 authority): {expected_hash}\n"
                f"    actual:                     {actual}"
            )

    # 2) Every recorded artifact must exist and match its recorded hash.

    errors: List[str] = list(authority_errors)

    for rel_path in sorted(entries):
        p = Path(rel_path)

        if not p.is_file():
            errors.append(f"MISSING FILE: {rel_path}")
            continue

        expected_hash = entries[rel_path]["sha256"]
        actual = compute_sha256(p)

        if actual != expected_hash:
            errors.append(
                f"HASH MISMATCH: {rel_path}\n"
                f"    expected: {expected_hash}\n"
                f"    actual:   {actual}"
            )

        if rel_path in AUTHORITY_SHA256 and expected_hash != AUTHORITY_SHA256[rel_path]:
            errors.append(
                f"MANIFEST TAMPERING: {rel_path} is recorded with a non-authority hash."
            )

    for rel_path, expected_hash in AUTHORITY_SHA256.items():
        rec = entries.get(rel_path)

        if rec is None:
            errors.append(f"AUTHORITY FILE NOT IN MANIFEST: {rel_path}")

        elif rec["sha256"] != expected_hash:
            errors.append(f"MANIFEST/WORKING CONFLICT on {rel_path}.")

    if errors:
        print(
            "[FAIL] Frozen research integrity check FAILED:",
            file=sys.stderr
        )

        for err in errors:
            print(f"  * {err}", file=sys.stderr)

        return 1

    n_total = len(AUTHORITY_SHA256) + max(
        len(manifest.get("additive_artifacts", {})), 0
    )

    print(
        f"[OK] All frozen artifacts verified intact against {manifest_file} "
        f"(4 authoritative + {n_total - 4} additive)."
    )

    return 0


def resolve_json_path(data: Any, json_path: str) -> Any:
    """Resolve a dot/bracket path against a parsed JSON object."""

    current = data

    tokens = json_path.replace("[", ".").replace("]", "").split(".")

    for token in tokens:
        if token == "":
            continue

        if isinstance(current, dict):
            if token not in current:
                raise KeyError(
                    f"Key '{token}' not found while traversing '{json_path}'"
                )

            current = current[token]

        elif isinstance(current, list):
            try:
                current = current[int(token)]
            except (ValueError, IndexError) as exc:
                raise KeyError(
                    f"Invalid list index '{token}' in '{json_path}'"
                ) from exc

        else:
            raise KeyError(
                f"Cannot traverse into scalar at '{token}' in '{json_path}'"
            )

    return current


def cmd_audit_copy(args: argparse.Namespace) -> int:
    """
    Field-exact verification of V3 plain-language UI copy against frozen JSON values.

    Transforms:
      - "exact": displayed == frozen (1e-9 tolerance)
      - "round_int": displayed == round(frozen)
      - "percent_exact": displayed == frozen * 100 (1e-6 tolerance)
      - "percent_round_int": displayed == round(frozen * 100)
    """

    if cmd_verify(args) != 0:
        print(
            "[ABORT] Cannot audit UI copy: frozen artifacts failed verification.",
            file=sys.stderr
        )
        return 1

    manifest = load_manifest(Path(args.manifest))

    if manifest is None:
        return 1

    declared_files = set(manifest_keys(manifest).keys())

    copy_path = Path(args.copy_manifest)

    if not copy_path.is_file():
        print(
            f"[FAIL] Copy manifest not found: {copy_path}",
            file=sys.stderr
        )
        return 1

    payload = json.loads(copy_path.read_text(encoding="utf-8"))
    cards = payload.get("cards", [])

    if not cards:
        print(
            f"[FAIL] No 'cards' entries found in {copy_path}",
            file=sys.stderr
        )
        return 1

    json_cache: Dict[str, Any] = {}
    errors: List[str] = []

    for idx, entry in enumerate(cards):
        city_id = entry.get("city_id", "<missing_city_id>")
        source_file = entry.get("source_file", "")
        json_path = entry.get("json_path", "")
        displayed = entry.get("displayed_value")
        transform = entry.get("transform", "exact")
        rendered_text = entry.get("rendered_text", "")

        if not source_file or not json_path or displayed is None:
            errors.append(
                f"Entry #{idx} ({city_id}): missing required keys."
            )
            continue

        if source_file not in declared_files:
            errors.append(
                f"Entry #{idx} ({city_id}): source_file '{source_file}' is not a "
                "declared frozen artifact in the manifest. UI copy may only cite "
                "verified frozen sources."
            )
            continue

        if city_id != "global" and city_id.lower() not in json_path.lower():
            errors.append(
                f"Entry #{idx} ({city_id}): json_path '{json_path}' does not "
                f"reference city_id '{city_id}'."
            )
            continue

        if source_file not in json_cache:
            sp = Path(source_file)

            if not sp.is_file():
                errors.append(
                    f"Entry #{idx} ({city_id}): source_file missing: {sp}"
                )
                continue

            json_cache[source_file] = json.loads(
                sp.read_text(encoding="utf-8")
            )

        try:
            raw_val = resolve_json_path(
                json_cache[source_file],
                json_path
            )

        except KeyError as exc:
            errors.append(f"Entry #{idx} ({city_id}): {exc}")
            continue

        if not isinstance(raw_val, (int, float)) or isinstance(raw_val, bool):
            errors.append(
                f"Entry #{idx} ({city_id}): target non-numeric ({raw_val!r})."
            )
            continue

        if transform == "exact":
            expected_num: Union[int, float] = raw_val

            match = math.isclose(
                float(displayed),
                float(expected_num),
                rel_tol=1e-9,
                abs_tol=1e-9
            )

        elif transform == "round_int":
            expected_num = round(float(raw_val))
            match = displayed == expected_num

        elif transform == "percent_exact":
            expected_num = float(raw_val) * 100.0

            match = math.isclose(
                float(displayed),
                expected_num,
                rel_tol=1e-7,
                abs_tol=1e-6
            )

        elif transform == "percent_round_int":
            expected_num = round(float(raw_val) * 100.0)
            match = displayed == expected_num

        else:
            errors.append(
                f"Entry #{idx} ({city_id}): unsupported transform '{transform}'."
            )
            continue

        if not match:
            errors.append(
                f"VALUE MISMATCH in Entry #{idx} ({city_id}) at "
                f"{source_file}::{json_path}\n"
                f"    frozen raw value: {raw_val}\n"
                f"    expected ({transform}): {expected_num}\n"
                f"    displayed_value:  {displayed}"
            )
            continue

        if rendered_text and str(displayed) not in rendered_text:
            errors.append(
                f"TEXT MISMATCH in Entry #{idx} ({city_id}): displayed_value "
                f"'{displayed}' not found in rendered_text: {rendered_text!r}"
            )

    if errors:
        print(
            "[FAIL] Field-exact UI copy audit FAILED:",
            file=sys.stderr
        )

        for err in errors:
            print(f"  * {err}", file=sys.stderr)

        return 1

    print(
        f"[OK] Field-exact audit passed for all {len(cards)} UI entries "
        "against frozen JSONs."
    )

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify frozen V2.0 research artifacts and field-exact V3 UI copy. (REV 2)"
    )

    parser.add_argument(
        "--manifest",
        default=str(MANIFEST_PATH),
        help="Path to frozen SHA-256 manifest JSON"
    )

    sub = parser.add_subparsers(
        dest="command",
        required=True
    )

    p_gen = sub.add_parser(
        "generate",
        help="Generate the frozen manifest FROM THE ESTABLISHED V2.0 authority"
    )

    p_gen.add_argument("--tag", default=AUTHORITY_BASELINE_TAG)
    p_gen.add_argument("--force-overwrite-baseline", action="store_true")
    p_gen.add_argument("--allow-no-git", action="store_true")
    p_gen.set_defaults(func=cmd_generate)

    p_add = sub.add_parser(
        "add-artifact",
        help="Explicitly record a NEW additive artifact with provenance"
    )

    p_add.add_argument(
        "path",
        help="Repo-relative path of the new artifact"
    )

    p_add.add_argument(
        "--note",
        required=True,
        help="Provenance note (>=20 chars): source artifact + derivation"
    )

    p_add.add_argument(
        "--date",
        default=None,
        help="Addition date (YYYY-MM-DD)"
    )

    p_add.add_argument(
        "--replace",
        action="store_true",
        help="Allow redefinition of an existing additive entry"
    )

    p_add.set_defaults(func=cmd_add_artifact)

    p_ver = sub.add_parser(
        "verify",
        help="Verify inventory completeness and SHA-256 hashes"
    )

    p_ver.set_defaults(func=cmd_verify)

    p_aud = sub.add_parser(
        "audit-copy",
        help="Audit field-exact city/bin mappings in V3 UI copy"
    )

    p_aud.add_argument("copy_manifest")
    p_aud.set_defaults(func=cmd_audit_copy)

    args = parser.parse_args()

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
