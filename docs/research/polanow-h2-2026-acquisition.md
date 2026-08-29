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

This root-level `pobierz.php?d=zal&id=...` pattern is independently observable on indexed Polanów BIP attachments. The strict resolver therefore resolves this CMS link against the site origin, not against the wrapper path.

## Live acquisition proof

Isolated GitHub Actions run `33270288429` (`polanow-h2-acquisition-probe`, 2026-08-29) executed from a non-production probe branch. It used no production database, bucket or queue. All 15 canonical H2 wrappers resolved to origin-root attachment downloads, returned a body with the `%PDF-` signature, and were hashed before the report was archived.

| Child | SHA-256 |
| --- | --- |
| 01 Garbno | `d578df780951f1f391fa81007bd61e8048f001e1fca771a4561408c4c8913643` |
| 02 Kościernica | `bc3b2f430c561f0260a6d81e09479520ad0724518fe0f6932374d3eeaca38945` |
| 03 rural set A | `14e1ea008b34297750331f526bf3f8981d184205401fb82b83919fc5918cd9ab` |
| 04 rural set B | `24cf9023ab74d295e154fe0502bbf20ac35913a6d488e3ca318339ee3b183c53` |
| 05 rural set C | `a7d18df9cb40d4cc71810f4f41558a5863faa702b7b62b8b992d4d7644cd348b` |
| 06 Polanów route A | `97353c460373f520431c8221c2b30501facdd05af7b7bcbc216de55c6aa96a69` |
| 07 Polanów route B | `abc931a2985dd6540eb7039d83a8efde6c9ebd716759c3a9a2c7305afc8dc0f5` |
| 08 rural set D | `b611c0beef308b3ed50388158f7192b4b1c73cee22b30cadb6e8334c1ed25560` |
| 09 rural set E | `7ebc124edfe07b441a4e83c2e23226bca7c967b43e6472151c2662344b1721d3` |
| 10 rural set F | `c28292e1408a6d365cffafb5d09bb021a62c44817d9ce0c5bf4a9bacf9477728` |
| 11 difficult access A | `9a8daee424f7b3736cde010df6b81e5333911a4d8abcdcd72fc7e74b00ce87ba` |
| 12 difficult access B | `14cdec38ba3631937d9394aad27a712d25af70a2873416a73e4b3e76bb4fef3c` |
| 13 multi-family Polanów | `c8fab3cb37afb68d59840ff3ee83244de1aba3963c40b61ea2fe300f96e39513` |
| 14 multi-family Nacław/Żydowo | `963849141b1c796cdcf9c6c15c638076c20cf56b74495d03db9be561c72ac7ea` |
| 15 multi-family Krąg/Rzeczyca Wielka | `179ca57591f02175f77e0fe87875154c8af210b699495a97afb5b391250f25d6` |

The report artifact is `polanow-h2-acquisition-report-33270288429` (artifact id `9719895614`). The acquisition gate is therefore no longer blocked on stable child capture.

## Safety constraints for implementation

- accept only `https://bip.polanow.pl/zalacznik/<32-hex>/70/2846/` H2 wrapper identities;
- extract and verify the same 32-hex attachment id from the wrapper and download link;
- resolve `pobierz.php?d=zal&id=<id>` against `https://bip.polanow.pl/`;
- reject H1 document id `2660` and any wrapper outside parent document `2846`;
- keep the frozen SHA evidence above separate from future drift observations;
- do not activate difficult-access or multi-family children until service-area overlap rules are independently deterministic;
- do not promote Polanów to ACTIVE until parser/template, real PRG reference, production runtime, replay and API post-gates pass.

## Current blocker after live capture

`H2_PARSER_TEMPLATE_AND_SERVICE_AREA_GATE_NOT_YET_COMPLETE`

Stable H2 child acquisition is proven. The next work item is representative PDF text/template analysis followed by a source-backed, non-overlapping service-area model. No collection source is activated by this document.
