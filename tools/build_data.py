"""One-off data builder: writes data/countries.js and downloads flags/*.svg.

Sources: mledoze/countries (names, capitals, regions), World Bank API
(population, land area, GDP per capita - latest available year), flagcdn.com (flags).
Run from the project root:  python tools/build_data.py
"""
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTRA_CODES = {"TW", "PS", "XK", "HK"}  # non-UN entries added to reach ~200

# Fallbacks for entities the World Bank lacks or leaves blank (approximate, latest known).
MANUAL = {
    "TW": {"population": 23400000, "gdp": 33000},
    "KP": {"population": 26500000, "gdp": 1250},
    "ER": {"population": 3700000, "gdp": 650},
    "SS": {"population": 11300000, "gdp": 450},
    "SY": {"population": 23200000, "gdp": 850},
    "VA": {"population": 800, "gdp": 150000, "area": 0.49},
    "TW_area": 35410,
}
CAPITAL_FIX = {"BO": "Sucre", "NL": "Amsterdam", "ZA": "Pretoria", "LK": "Sri Jayawardenepura Kotte",
               "TW": "Taipei", "PS": "Ramallah", "XK": "Pristina", "HK": "Hong Kong"}
NAME_FIX = {"CD": "DR Congo", "CG": "Republic of the Congo", "CI": "Ivory Coast", "CZ": "Czechia",
            "MK": "North Macedonia", "SZ": "Eswatini", "TL": "Timor-Leste", "US": "United States",
            "GB": "United Kingdom", "KR": "South Korea", "KP": "North Korea", "PS": "Palestine",
            "MM": "Myanmar", "CV": "Cape Verde", "FM": "Micronesia", "RU": "Russia", "TW": "Taiwan",
            "HK": "Hong Kong", "XK": "Kosovo", "VA": "Vatican City", "BS": "Bahamas", "GM": "Gambia"}


# Transcontinental countries: first entry is the one shown as "the answer", all are accepted.
CONTINENT_FIX = {"RU": ["Europe", "Asia"], "TR": ["Asia", "Europe"], "KZ": ["Asia", "Europe"],
                 "EG": ["Africa", "Asia"], "GE": ["Asia", "Europe"], "AZ": ["Asia", "Europe"],
                 "AM": ["Asia", "Europe"], "CY": ["Europe", "Asia"]}


def continents_for(cca2, region, subregion):
    if cca2 in CONTINENT_FIX:
        return CONTINENT_FIX[cca2]
    if region == "Americas":
        return ["South America" if subregion == "South America" else "North America"]
    return [region]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "guess-the-country/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def wb_latest(indicator):
    """Return {iso3: latest non-null value} for a World Bank indicator."""
    out, page = {}, 1
    while True:
        url = (f"https://api.worldbank.org/v2/country/all/indicator/{indicator}"
               f"?format=json&per_page=20000&date=2018:2026&page={page}")
        meta, rows = json.loads(get(url))
        for row in rows or []:
            if row["value"] is None:
                continue
            code = row["countryiso3code"]
            if code not in out or row["date"] > out[code][0]:
                out[code] = (row["date"], row["value"])
        if page >= meta["pages"]:
            break
        page += 1
    return {k: v[1] for k, v in out.items()}


def main():
    base = json.loads(get("https://raw.githubusercontent.com/mledoze/countries/master/countries.json"))
    pop = wb_latest("SP.POP.TOTL")
    area = wb_latest("AG.LND.TOTL.K2")
    gdp = wb_latest("NY.GDP.PCAP.CD")

    countries, missing = [], []
    for c in base:
        cca2, cca3 = c["cca2"], c["cca3"]
        if cca2 == "XK":
            cca3 = "XKX"  # World Bank code for Kosovo
        if cca2 == "VA" or not (c.get("independent") or cca2 in EXTRA_CODES):
            continue
        if not c.get("capital") and cca2 not in CAPITAL_FIX:
            missing.append((cca2, "capital"))
            continue
        man = MANUAL.get(cca2, {})
        entry = {
            "code": cca2.lower(),
            "name": NAME_FIX.get(cca2, c["name"]["common"]),
            "alt": sorted({c["name"]["official"], c["name"]["common"]} |
                          set(c.get("altSpellings", [])[1:4]) - {NAME_FIX.get(cca2, c["name"]["common"])}),
            "capital": CAPITAL_FIX.get(cca2, c["capital"][0]),
            "region": c["region"],
            "subregion": c.get("subregion", ""),
            "continents": continents_for(cca2, c["region"], c.get("subregion", "")),
            "population": int(pop.get(cca3) or man.get("population") or 0),
            "area": max(1, round(float(man.get("area") or area.get(cca3) or c.get("area") or 0))),
            "gdp": round(float(gdp.get(cca3) or man.get("gdp") or 0)),
        }
        if cca2 == "TW":
            entry["area"] = MANUAL["TW_area"]
        for field in ("population", "area", "gdp"):
            if not entry[field]:
                missing.append((cca2, field))
        countries.append(entry)

    countries.sort(key=lambda e: e["name"])
    # drop entries lacking any numeric field so ranking questions stay valid
    bad = {code for code, _ in missing}
    countries = [e for e in countries if e["code"].upper() not in bad]

    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "countries.js"), "w", encoding="utf-8") as f:
        f.write("// Generated by tools/build_data.py - do not edit by hand.\n")
        f.write("const COUNTRIES = " + json.dumps(countries, ensure_ascii=False, indent=1) + ";\n")

    flag_dir = os.path.join(ROOT, "flags")
    os.makedirs(flag_dir, exist_ok=True)
    for e in countries:
        path = os.path.join(flag_dir, e["code"] + ".svg")
        if os.path.exists(path):
            continue
        try:
            with open(path, "wb") as f:
                f.write(get(f"https://flagcdn.com/{e['code']}.svg"))
        except Exception as ex:
            print("flag failed", e["code"], ex)

    print(f"{len(countries)} countries written")
    print("dropped/missing:", missing)


if __name__ == "__main__":
    sys.exit(main())
