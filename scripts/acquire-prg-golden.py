#!/usr/bin/env python3
"""One-off official PRG/UUG acquisition helper for issue #64.

This file lives only on the temporary acquisition branch. It downloads raw,
official GUGiK address evidence for the municipalities with ACTIVE collection
schedules. The final PR gate will use only a frozen, reviewed snapshot committed
on the feature branch; it will never depend on these live services.
"""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape

WFS_URL = "https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej"
UUG_URL = "https://services.gugik.gov.pl/uug/"
OUT = Path("tmp/prg-acquisition")
OUT.mkdir(parents=True, exist_ok=True)

# KINA/UUG expose the six-digit municipality TERYT without the kind suffix.
MUNICIPALITIES = {
    "koszalin": "326101",
    "manowo": "320904",
    "tychowo": "320104",
}

KOSZALIN_EXACT = [
    "Koszalin, 1 Maja 3",
    "Koszalin, 1 Maja 8",
    "Koszalin, 4 Marca 10",
    "Koszalin, Adama Asnyka 11",
    "Koszalin, Adama Asnyka 14",
    "Koszalin, Aleja Armii Krajowej 9",
    "Koszalin, Aleja Monte Cassino 14",
    "Koszalin, Bałtycka 1",
    "Koszalin, Bogusława II 1-3",
    "Koszalin, Frezji 11",
]

GML_ID = "{http://www.opengis.net/gml/3.2}id"


def local_name(tag: str) -> str:
    return tag.split("}")[-1].split(":")[-1]


def equality(name: str, value: str) -> str:
    return (
        '<fes:PropertyIsEqualTo>'
        f'<fes:ValueReference>{escape(name)}</fes:ValueReference>'
        f'<fes:Literal>{escape(value)}</fes:Literal>'
        '</fes:PropertyIsEqualTo>'
    )


def make_filter(filters: dict[str, str]) -> str:
    predicates = "".join(equality(name, value) for name, value in filters.items())
    if len(filters) > 1:
        predicates = f"<fes:And>{predicates}</fes:And>"
    return f'<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0">{predicates}</fes:Filter>'


def request_bytes(url: str, accept: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "WastePL/0.1 PRG golden acquisition (+https://github.com/endurance71/WastePL)",
            "Accept": accept,
        },
    )
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                body = response.read()
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}")
                return body
        except Exception as exc:  # one-off acquisition utility
            last_error = exc
            time.sleep(2**attempt)
    raise RuntimeError(f"Acquisition failed for {url[:240]}: {last_error}")


def fetch_wfs(filters: dict[str, str], start: int = 0, count: int = 2000) -> bytes:
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typenames": "ms:prg-adresy",
        "startIndex": str(start),
        "count": str(count),
        "filter": make_filter(filters),
    }
    url = f"{WFS_URL}?{urllib.parse.urlencode(params)}"
    return request_bytes(url, "application/gml+xml, text/xml, application/xml")


def fetch_uug(address: str) -> dict[str, object]:
    params = {"request": "GetAddress", "address": address, "srid": "2180"}
    url = f"{UUG_URL}?{urllib.parse.urlencode(params)}"
    body = request_bytes(url, "application/json, text/json, */*")
    return json.loads(body.decode("utf-8"))


def feature_members(root: ET.Element) -> list[ET.Element]:
    members: list[ET.Element] = []
    for child in root.iter():
        if local_name(child.tag) in {"member", "featureMember"} and len(child):
            members.append(child[0])
    return members


def flatten_feature(feature: ET.Element) -> dict[str, object]:
    record: dict[str, object] = {"featureId": feature.attrib.get(GML_ID)}
    for node in feature.iter():
        if node is feature:
            continue
        name = local_name(node.tag)
        text = (node.text or "").strip()
        if not text or len(node):
            continue
        current = record.get(name)
        if current is None:
            record[name] = text
        elif isinstance(current, list):
            current.append(text)
        else:
            record[name] = [current, text]
    return record


def records_from_gml(page: bytes) -> tuple[ET.Element, list[dict[str, object]]]:
    root = ET.fromstring(page)
    return root, [flatten_feature(feature) for feature in feature_members(root)]


def acquire_municipality(label: str, teryt: str) -> dict[str, object]:
    page = fetch_wfs({"teryt": teryt})
    (OUT / f"{label}-{teryt}.gml").write_bytes(page)
    root, records = records_from_gml(page)
    (OUT / f"{label}-{teryt}.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return {
        "label": label,
        "teryt": teryt,
        "featureCount": len(records),
        "rootAttributes": root.attrib,
        "fields": sorted({key for record in records for key in record}),
        "sample": records[:5],
        "gmlBytes": len(page),
    }


def normalize_uug_results(payload: dict[str, object]) -> list[dict[str, object]]:
    value = payload.get("results")
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        return [item for item in value.values() if isinstance(item, dict)]
    return []


def acquire_koszalin_exact() -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for query in KOSZALIN_EXACT:
        payload = fetch_uug(query)
        candidates = normalize_uug_results(payload)
        # UUG intentionally returns fuzzy alternatives. For golden evidence we
        # accept only a full-confidence exact address in the requested TERYT.
        exact = [
            row for row in candidates
            if str(row.get("teryt", "")) == "326101" and str(row.get("accuracy", "")) == "1"
        ]
        if len(exact) != 1:
            raise RuntimeError(f"UUG query {query!r} did not resolve to one exact Koszalin address: {exact}")
        uug = exact[0]
        filters = {
            "teryt": str(uug.get("teryt", "")),
            "simc": str(uug.get("simc", "")),
            "ulic": str(uug.get("ulic", "")),
            "numer": str(uug.get("number", "")),
        }
        page = fetch_wfs(filters, count=20)
        _, wfs_rows = records_from_gml(page)
        if len(wfs_rows) != 1:
            raise RuntimeError(f"Exact WFS lookup for {query!r} returned {len(wfs_rows)} rows: {wfs_rows}")
        results.append({"query": query, "uug": uug, "wfs": wfs_rows[0]})
    (OUT / "koszalin-exact-uug-wfs.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return results


def main() -> None:
    summaries = [acquire_municipality(label, teryt) for label, teryt in MUNICIPALITIES.items()]
    koszalin_exact = acquire_koszalin_exact()
    summary = {
        "wfsSource": WFS_URL,
        "uugSource": UUG_URL,
        "service": "GUGiK PRG/KINA WFS + UUG",
        "githubRunId": os.environ.get("GITHUB_RUN_ID", "local"),
        "municipalities": summaries,
        "koszalinExactCount": len(koszalin_exact),
    }
    (OUT / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
