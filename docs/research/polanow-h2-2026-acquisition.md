# Polanów H2 2026 — acquisition evidence

> Verified: 2026-08-29. This document records source-acquisition evidence for issue #76. It is research evidence only and does not activate Polanów collection data.

## Official parent

Canonical H2 publication:

`https://bip.polanow.pl/harmonogram-odbioru-odpadow-komunalnych---ii-polrocze-2026/d/70/2846/`

The official BIP states that the schedule covers 2026-07-01 through 2026-12-31 and was published on 2026-06-24. The parent enumerates exactly 15 attachments.

## Canonical attachment wrappers

1. `b9dd65849fc6ebcb56cb8e3ce17710d5` — Garbno — `1782289119_Polanow-1.pdf`
2. `9f0e8b36296c7a6b81235ac1e4be7f3d` — Kościernica
3. `2ab2d7615a89d857c47d062ae014d941` — Bukowo / Dadzewo / Domachowo / Jacinki / Krytno / Karsina / Karsinka / Nacław / Nadbór / Osetno / Powidz / Puławy / Rekowo / Rzyszczewko / Sowinko / Stołpie / Świerczyna — `1782289185_Polanow-3.pdf`
4. `9a984d281708c4c9d9fe024fac0a9239` — Bożenice / Buszyno / Doły / Komorowo / Krąg / Rochowo / Rzeczyca Mała / Rzeczyca Wielka / Warblewo / Wielin
5. `968f3890565a70325ab530f2bc0ba475` — Bagnica / Bartlewo / Cetuń / Chróstowo / Czyżewo / Głusza / Gilewo / Jeżewo / Kierzkowo / Liszkowo / Łąkie / Nowy Żelibórz / Pokrzywno / Pyszki / Racław / Rosocha / Samostrzel / Stary Żelibórz / Zagaje / Żydowo
6. `5918114e4f59bc84e1ee2ad0d3b70691` — Polanów city route A + Smugi — `1782289363_Polanow-6.pdf`
7. `739219b35502eab379a558a2abbea937` — Polanów city route B + Knieja
8. `4e5fd68092b90c967e3d82c68792834b` — Chocimino / Chocimino Leśne / Dzikowo / Jaromierz Polanowski / Łokwica / Wietrzno / Trzebaw
9. `d5e1d06dcff13dbd33f682e757935b2f` — Dalimierz / Gołogóra / Gosław / Gostkowo / Kępiny / Kopaniec / Lipki / Piaskowo / Pieczyska / Stare Wiatrowo / Zdzieszewo
10. `fed8ae9e9000fa15c8c4cf0e685a5706` — Kania / Przybrodzie / Racibórz Polanowski / Strzeżewo
11. `49d6930b8ca21e09c479347689eee6b0` — difficult access set A — `1782289693_Polanow-utrudnione-PN.pdf`
12. `024df25d6be612cb1573eb6f0f2e213d` — difficult access set B
13. `46c336882c6fb4a6588505d7e72de3df` — multi-family Polanów — `1782289798_Polanow-W1.pdf`
14. `c587315871df63c17b42d0df02bdfe11` — multi-family Nacław / Żydowo
15. `9420a0f8990601e55eda78db3074ac22` — multi-family Krąg / Rzeczyca Wielka — `1782289875_Polanow-W3.pdf`

All sampled wrappers report PGK Koszalin as producer, creation date 2026-06-24 and publication end date 2026-12-31.

## CMS download semantics

Attachment wrapper pages expose a relative link shaped as:

`pobierz.php?d=zal&id=<attachment-hash>`

Resolving this string relative to the nested wrapper URL produces an invalid path such as:

`/zalacznik/<hash>/70/2846/pobierz.php?d=zal&id=<hash>`

and returns HTTP 404.

The same BIP CMS exposes attachment downloads canonically from the origin root:

`https://bip.polanow.pl/pobierz.php?d=zal&id=<attachment-hash>`

This root-level `pobierz.php?d=zal&id=...` pattern is independently observable on indexed Polanów BIP attachments. Therefore a child-artifact resolver must resolve this CMS link against the site origin, not against the wrapper path.

## Safety constraints for implementation

- accept only `https://bip.polanow.pl/zalacznik/<32-hex>/70/2846/` H2 wrapper identities;
- extract and verify the same 32-hex attachment id from the wrapper and download link;
- resolve `pobierz.php?d=zal&id=<id>` against `https://bip.polanow.pl/`;
- reject H1 document id `2660` and any wrapper outside parent document `2846`;
- freeze content SHA-256 after successful child capture;
- do not activate difficult-access or multi-family children until service-area overlap rules are independently deterministic;
- do not promote Polanów to ACTIVE until production runtime, real PRG reference gate, replay and API post-gates pass.

## Current blocker after this research

The previous blocker `H2_CHILD_SET_ENUMERATED_BUT_STABLE_PDF_CAPTURE_NOT_YET_PROVEN` is narrowed to runtime verification of the origin-root attachment resolver and SHA capture.

No collection source is activated by this document.
