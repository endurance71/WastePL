#!/usr/bin/env python3
"""One-off acquisition helper for issue #64.

This file lives only on the temporary acquisition branch. It downloads raw,
official GUGiK PRG WFS responses for the three municipalities that currently
have ACTIVE collection schedules. The resulting artifacts are inspected and a
small, frozen evidence snapshot is later committed on the real feature branch.
No production or pull-request gate depends on this live request.
"""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

BASE_URL = "https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej"
OUT = Path("tmp/prg-acquisition")
OUT.mkdir(parents=True, exist_ok=True)

# KINA/UUG expose the six-digit municipality TERYT without the kind suffix.
MUNICIPALITIES = {
    "koszalin": "326101",
    "manowo": "320904",
    "tychowo": "320104",
}


def local_name(tag: str) -> str:
    return tag.split("}")[-1].split(":")[-1]


def make_filter(teryt: str) -> str:
    return (
        '<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0">'
        '<fes:PropertyIsEqualTo>'
        '<fes:ValueReference>teryt</fes:ValueReference>'
        f'<fes:Literal>{teryt}</fes:Literal>'
        '</fes:PropertyIsEqualTo>'
        '</fes:Filter>'
    )


def fetch_page(teryt: str, start: int, count: int = 2000) -> bytes:
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typenames": "ms:prg-adresy",
        "startIndex": str(start),
        "count": str(count),
        "filter": make_filter(teryt),
    }
    url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "WastePL/0.1 PRG golden acquisition (+https://github.com/endurance71/WastePL)",
            "Accept": "application/gml+xml, text/xml, application/xml",
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
        except Exception as exc:  # acquisition utility: report/retry network errors
            last_error = exc
            time.sleep(2**attempt)
    raise RuntimeError(f"WFS acquisition failed for TERYT {teryt}: {last_error}")


def feature_members(root: ET.Element) -> list[ET.Element]:
    members: list[ET.Element] = []
    for child in root.iter():
        if local_name(child.tag) in {"member", "featureMember"} and len(child):
            members.append(child[0])
    return members


def flatten_feature(feature: ET.Element) -> dict[str, object]:
    record: dict[str, object] = {}
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


def acquire(label: str, teryt: str) -> dict[str, object]:
    page = fetch_page(teryt, 0)
    gml_path = OUT / f"{label}-{teryt}.gml"
    gml_path.write_bytes(page)

    root = ET.fromstring(page)
    members = feature_members(root)
    records = [flatten_feature(feature) for feature in members]
    (OUT / f"{label}-{teryt}.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
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


def main() -> None:
    summaries = [acquire(label, teryt) for label, teryt in MUNICIPALITIES.items()]
    summary = {
        "source": BASE_URL,
        "service": "GUGiK Krajowa Integracja Numeracji Adresowej / PRG WFS",
        "acquiredAt": os.environ.get("GITHUB_RUN_ID", "local"),
        "municipalities": summaries,
    }
    (OUT / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
