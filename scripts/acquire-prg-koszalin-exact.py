#!/usr/bin/env python3
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape

WFS_URL = "https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej"
UUG_URL = "https://services.gugik.gov.pl/uug/"
OUT = Path("tmp/koszalin-exact")
OUT.mkdir(parents=True, exist_ok=True)
QUERIES = [
    "Koszalin, 1 Maja 3",
    "Koszalin, 1 Maja 8",
    "Koszalin, 4 Marca 10",
    "Koszalin, Adama Asnyka 11",
    "Koszalin, Adama Asnyka 14",
    "Koszalin, Aleja Armii Krajowej 9",
    "Koszalin, Aleja Monte Cassino 14",
    "Koszalin, Bałtycka 1",
    "Koszalin, Frezji 11",
]
GML_ID = "{http://www.opengis.net/gml/3.2}id"


def request_bytes(url: str, accept: str) -> bytes:
    req = urllib.request.Request(url, headers={
        "User-Agent": "WastePL/0.1 PRG golden acquisition (+https://github.com/endurance71/WastePL)",
        "Accept": accept,
    })
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as response:
                return response.read()
        except Exception as exc:
            last = exc
            time.sleep(2**attempt)
    raise RuntimeError(f"request failed: {last}")


def uug(query: str) -> dict[str, object]:
    url = UUG_URL + "?" + urllib.parse.urlencode({"request": "GetAddress", "address": query, "srid": "2180"})
    payload = json.loads(request_bytes(url, "application/json, */*").decode("utf-8"))
    value = payload.get("results", [])
    candidates = value if isinstance(value, list) else list(value.values()) if isinstance(value, dict) else []
    exact = [row for row in candidates if isinstance(row, dict) and str(row.get("teryt")) == "326101" and str(row.get("accuracy")) == "1"]
    if len(exact) != 1:
        raise RuntimeError(f"{query!r}: expected one exact UUG candidate, got {exact}")
    return exact[0]


def equality(name: str, value: str) -> str:
    return f"<fes:PropertyIsEqualTo><fes:ValueReference>{escape(name)}</fes:ValueReference><fes:Literal>{escape(value)}</fes:Literal></fes:PropertyIsEqualTo>"


def exact_wfs(row: dict[str, object]) -> dict[str, object]:
    filters = {key: str(row.get(key, "")) for key in ("teryt", "simc", "ulic")}
    filters["numer"] = str(row.get("number", ""))
    xml_filter = '<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:And>' + ''.join(equality(k, v) for k, v in filters.items()) + '</fes:And></fes:Filter>'
    params = {
        "service": "WFS", "version": "2.0.0", "request": "GetFeature",
        "typenames": "ms:prg-adresy", "count": "20", "filter": xml_filter,
    }
    page = request_bytes(WFS_URL + "?" + urllib.parse.urlencode(params), "application/gml+xml, text/xml")
    root = ET.fromstring(page)
    features = []
    for member in root.iter():
        if member.tag.split('}')[-1] not in {"member", "featureMember"} or not len(member):
            continue
        feature = member[0]
        record: dict[str, object] = {"featureId": feature.attrib.get(GML_ID)}
        for node in feature.iter():
            if node is feature or len(node):
                continue
            text = (node.text or "").strip()
            if text:
                record[node.tag.split('}')[-1]] = text
        features.append(record)
    if len(features) != 1:
        raise RuntimeError(f"WFS exact lookup {filters} returned {len(features)} features")
    return features[0]


def main() -> None:
    rows = []
    for query in QUERIES:
        address = uug(query)
        rows.append({"query": query, "uug": address, "wfs": exact_wfs(address)})
    payload = {
        "wfsSource": WFS_URL,
        "uugSource": UUG_URL,
        "excludedSourceOnlyCollectionPoint": "Koszalin, Bogusława II 1-3",
        "excludedReason": "official schedule location is a number range, not one exact PRG address point",
        "rows": rows,
    }
    (OUT / "koszalin-exact-uug-wfs.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"exactCount": len(rows), "queries": QUERIES}, ensure_ascii=False))


if __name__ == "__main__":
    main()
