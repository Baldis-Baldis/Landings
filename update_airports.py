#!/usr/bin/env python3
"""Refresh airfield data for the Landings app from OurAirports (public domain).

Downloads airports.csv, runways.csv and airport-frequencies.csv from
https://github.com/davidmegginson/ourairports-data and writes:

  data/airports-eu.json   - airfields in SK, DE, PL, AT (Czech list stays from the VFR manual in index.html)
  data/airport-info.json  - runways and radio frequencies for Czech and neighbouring airfields (informative only)

A file is only rewritten when its content really changed, so the monthly
GitHub Action makes a commit only when OurAirports changed something.
Standard library only; run:  python update_airports.py
"""
import csv, io, json, os, re, sys, urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/"
FOREIGN = {"SK": ("LZ",), "DE": ("ED", "ET"), "PL": ("EP",), "AT": ("LO",)}
TYPES = ("small_airport", "medium_airport", "large_airport")


def fetch_csv(name):
    req = urllib.request.Request(SRC + name, headers={"User-Agent": "Landings-app data update"})
    with urllib.request.urlopen(req, timeout=120) as r:
        text = r.read().decode("utf-8")
    rows = list(csv.DictReader(io.StringIO(text)))
    if len(rows) < 1000:
        sys.exit(f"{name}: suspiciously few rows ({len(rows)}), aborting")
    return rows


def czech_codes():
    """Codes of the Czech airfields defined in index.html (from the VFR manual)."""
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    m = re.search(r"const DATA = (\[.*?\]);", html, re.S)
    if not m:
        sys.exit("could not find the Czech airfield list (const DATA) in index.html")
    return [a["code"] for a in json.loads(m.group(1))]


def app_code(r, cc):
    """Same rule as the app: real ICAO code if there is one, otherwise the OurAirports ident."""
    for c in (r["icao_code"], r["gps_code"], r["ident"]):
        if c and re.fullmatch(r"[A-Z]{4}", c) and c.startswith(FOREIGN[cc]):
            return c, True
    return r["ident"], False


def surface(s):
    s = (s or "").strip().lower()
    if not s or s in ("unk", "u", "unknown"):
        return ""
    if s.startswith(("asp", "asf", "bit", "tar", "a")) and not s.startswith("ag"):
        return "asp"
    if s.startswith(("con", "pem", "beton", "c")):
        return "con"
    if s.startswith(("gras", "grs", "turf", "g", "tr", "rasen")) and not s.startswith(("grv", "grav", "gre")):
        return "grs"
    if s.startswith(("grv", "grav", "gre", "kies", "štěrk")):
        return "grv"
    if s.startswith(("paved", "hard")):
        return "paved"
    return s[:12]


def ft_to_m(v):
    try:
        return round(float(v) * 0.3048)
    except (TypeError, ValueError):
        return None


def write_if_changed(path, payload, compare_key):
    """Write JSON only when `compare_key` content differs from the existing file."""
    full = os.path.join(ROOT, path)
    try:
        old = json.load(open(full, encoding="utf-8"))
        if old.get(compare_key) == payload[compare_key]:
            print(f"{path}: no change")
            return False
    except (OSError, ValueError):
        pass
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{path}: updated")
    return True


def main():
    airports = fetch_csv("airports.csv")
    runways = fetch_csv("runways.csv")
    freqs = fetch_csv("airport-frequencies.csv")
    today = date.today().isoformat()

    # --- neighbouring countries ---
    eu, seen, ident_to_code = [], set(), {}
    for r in airports:
        cc = r["iso_country"]
        if cc not in FOREIGN or r["type"] not in TYPES:
            continue
        code, icao = app_code(r, cc)
        if code in seen:
            continue
        seen.add(code)
        ident_to_code[r["ident"]] = code
        eu.append({
            "code": code, "name": re.sub(r"\s+", " ", r["name"]).strip(),
            "lat": round(float(r["latitude_deg"]), 5), "lon": round(float(r["longitude_deg"]), 5),
            "elev": r["elevation_ft"] or "", "town": r["municipality"] or "",
            "slz": (not icao) and r["type"] == "small_airport", "cc": cc,
        })
    eu.sort(key=lambda o: (o["cc"], o["name"]))

    # --- Czech airfields: match the VFR-manual codes to OurAirports records ---
    cz = set(czech_codes())
    for r in airports:
        if r["iso_country"] != "CZ":
            continue
        for alias in (r["ident"], r["gps_code"], r["icao_code"], r["local_code"]):
            if alias in cz:
                ident_to_code[r["ident"]] = alias
                break

    # --- runways and frequencies (informative) ---
    info = {}
    for r in runways:
        code = ident_to_code.get(r["airport_ident"])
        if not code or r["closed"] == "1":
            continue
        name = "/".join(x for x in (r["le_ident"], r["he_ident"]) if x)
        info.setdefault(code, {}).setdefault("r", []).append(
            [name, ft_to_m(r["length_ft"]), ft_to_m(r["width_ft"]), surface(r["surface"]), 1 if r["lighted"] == "1" else 0])
    for r in freqs:
        code = ident_to_code.get(r["airport_ident"])
        if not code or not r["frequency_mhz"]:
            continue
        try:
            mhz = f"{float(r['frequency_mhz']):.3f}"
        except ValueError:
            continue
        item = [r["type"].strip().upper(), r["description"].strip(), mhz]
        lst = info.setdefault(code, {}).setdefault("f", [])
        if item not in lst:
            lst.append(item)
    for v in info.values():
        v.get("r", []).sort(key=lambda x: -(x[1] or 0))
    info = dict(sorted(info.items()))

    src = "OurAirports (public domain), https://ourairports.com/data/"
    write_if_changed("data/airports-eu.json", {"source": src, "generated": today, "airports": eu}, "airports")
    write_if_changed("data/airport-info.json", {"source": src, "generated": today, "info": info}, "info")
    found_cz = sum(1 for c in cz if c in info)
    print(f"{len(eu)} foreign airfields; info for {len(info)} airfields ({found_cz} of {len(cz)} Czech)")


if __name__ == "__main__":
    main()
