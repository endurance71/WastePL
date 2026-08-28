<!-- Source: https://docs.google.com/document/d/1cWOdT6W2oxQthjpIsHaBYn6QxlIAux_pbfDbU2rsdvU/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 03 — WastePL Data Standard v0.1

[Oryginał w Google Docs](https://docs.google.com/document/d/1cWOdT6W2oxQthjpIsHaBYn6QxlIAux_pbfDbU2rsdvU/edit)

WASTEPL DATA STANDARD v0.1
Robocza specyfikacja modelu danych odpadowych dla Polski


Data: 27.08.2026
Status: DRAFT


1. CEL STANDARDU


WastePL Data Standard ma zapewnić wspólny sposób reprezentowania danych odpadowych niezależnie od tego, czy źródłem jest PDF, XLSX, strona HTML, API operatora, system gminny czy ręcznie zatwierdzony wpis.


Standard powinien być:
• prosty do implementacji,
• wersjonowany,
• niezależny od konkretnego dostawcy,
• zgodny z oficjalnymi identyfikatorami TERYT/PRG,
• zdolny do opisywania wyjątków adresowych,
• audytowalny,
• rozszerzalny o realtime.


2. ZASADA PROJEKTOWA


Oddzielamy:
A. dane źródłowe,
B. dane znormalizowane,
C. reguły pokrycia adresowego,
D. dane prezentacyjne.


Nigdy nie traktujemy PDF jako modelu danych.


3. GŁÓWNE ENCJE


municipality
Jednostka samorządowa.


locality
Miejscowość według SIMC.


street
Ulica według ULIC.


address
Punkt/adres powiązany z PRG.


service_area
Rejon, sektor, trasa lub inna logiczna grupa nieruchomości obsługiwana wspólnym harmonogramem.


coverage_rule
Reguła określająca, jakie adresy należą do service_area.


waste_fraction
Typ/frakcja odpadów.


collection_event
Konkretny termin odbioru dla danej frakcji i service_area.


facility
PSZOK lub inny punkt zbiórki.


facility_acceptance
Informacja, jakie odpady przyjmuje punkt i na jakich zasadach.


deposit_return_point
Punkt zwrotu opakowań kaucyjnych.


alert
Komunikat, zmiana harmonogramu lub incydent.


source
Oficjalne źródło danych.


source_artifact
Konkretny pobrany dokument, plik lub odpowiedź API.


dataset_version
Wersja zestawu danych wygenerowana z określonych źródeł.


4. MUNICIPALITY


Minimalne pola:
• id — wewnętrzny identyfikator,
• terc — oficjalny kod TERC,
• name,
• type,
• voivodeship,
• county,
• active.


Przykład:
{
  "id": "mun_bobolice",
  "terc": "...",
  "name": "Bobolice",
  "type": "urban_rural",
  "voivodeship": "zachodniopomorskie",
  "active": true
}


5. SERVICE AREA


service_area nie musi być polygonem.


Może oznaczać:
• sektor,
• trasę,
• rejon,
• typ zabudowy,
• grupę miejscowości,
• dowolny zbiór adresów korzystających z jednego harmonogramu.


Pola:
• id,
• municipality_id,
• external_name,
• service_type,
• building_type,
• valid_from,
• valid_to,
• source_id.


6. COVERAGE RULE


To jeden z najważniejszych elementów standardu.


Obsługiwane typy reguł:
• municipality,
• locality,
• street,
• street_number_range,
• street_numbers,
• odd_numbers,
• even_numbers,
• explicit_address,
• postal_code — tylko pomocniczo,
• geospatial_polygon — opcjonalnie,
• building_type,
• include,
• exclude.


Przykład — cała miejscowość:
{
  "type": "locality",
  "simc": "..."
}


Przykład — konkretna ulica:
{
  "type": "street",
  "simc": "...",
  "ulic": "..."
}


Przykład — wybrane numery:
{
  "type": "street_numbers",
  "simc": "...",
  "ulic": "...",
  "numbers": ["16", "30", "34", "40A"]
}


Przykład — zakres:
{
  "type": "street_number_range",
  "from": 1,
  "to": 51,
  "parity": "odd"
}


Przykład — wyjątek:
{
  "type": "exclude",
  "address_ids": ["..."]
}


7. WASTE FRACTION


Standardowe kody robocze:
• mixed_waste,
• bio,
• paper,
• glass,
• plastics_metals,
• bulky,
• green_waste,
• ash,
• textiles,
• ewaste,
• tires,
• construction,
• hazardous,
• medicines,
• batteries,
• other.


Każda frakcja powinna mieć:
• canonical_code,
• local_label,
• display_name,
• color_hint — tylko prezentacyjne,
• aliases.


Przykład:
{
  "canonical_code": "plastics_metals",
  "local_label": "Metale i tworzywa sztuczne",
  "aliases": ["plastik", "żółty worek", "metale i plastik"]
}


8. COLLECTION EVENT


Minimalne pola:
• id,
• service_area_id,
• waste_fraction,
• collection_date,
• start_time — opcjonalne,
• end_time — opcjonalne,
• status,
• source_id,
• dataset_version,
• confidence.


Statusy:
• scheduled,
• changed,
• cancelled,
• completed — tylko jeśli mamy dane realtime,
• unknown.


Przykład:
{
  "service_area_id": "bobolice_zone_01",
  "waste_fraction": "plastics_metals",
  "collection_date": "2026-09-14",
  "status": "scheduled",
  "confidence": 0.99
}


9. SOURCE


Każdy rekord powinien być możliwy do prześledzenia do źródła.


Pola:
• id,
• municipality_id,
• owner_name,
• source_type,
• source_url,
• reuse_basis,
• authority_level,
• active.


source_type:
• official_api,
• municipal_web,
• bip,
• operator_web,
• xlsx,
• csv,
• pdf,
• image,
• manual_verified,
• partner_api.


authority_level — propozycja:
1. verified_partner
2. official_municipality
3. official_operator
4. official_publication
5. other_public_source
6. community


10. SOURCE ARTIFACT


Pola:
• id,
• source_id,
• retrieved_at,
• published_at,
• url,
• content_type,
• etag,
• last_modified,
• sha256,
• parser,
• parser_version,
• extraction_status.


11. VERSIONING


Każdy import tworzy dataset_version.


Pola:
• id,
• municipality_id,
• created_at,
• valid_from,
• valid_to,
• source_artifact_ids,
• change_summary,
• status.


Status:
• draft,
• validating,
• active,
• superseded,
• rejected,
• rolled_back.


12. CONFIDENCE


Confidence nie powinien być wyłącznie „wynikiem AI”.


Na ocenę powinny wpływać:
• typ źródła,
• deterministyczność parsera,
• zgodność z poprzednią wersją,
• kompletność danych,
• walidacja adresowa,
• walidacja człowieka,
• zgodność z drugim oficjalnym źródłem.


Proponowane klasy:
• 0.99–1.00 — verified,
• 0.95–0.99 — high,
• 0.80–0.95 — review recommended,
• <0.80 — nie publikować automatycznie.


13. VERIFICATION STATUS


• verified_by_municipality,
• verified_by_operator,
• verified_internal,
• official_source_unverified,
• review_required,
• disputed.


14. FACILITY — PSZOK I INNE PUNKTY


Pola:
• id,
• facility_type,
• name,
• municipality_id,
• address,
• lat,
• lon,
• opening_hours,
• phone,
• website,
• eligibility_rules,
• source_id,
• verified_at.


facility_type:
• pszok,
• mobile_pszok,
• ewaste_point,
• textile_point,
• battery_point,
• medicine_point,
• bulky_point,
• reuse_point,
• other.


15. FACILITY ACCEPTANCE


Pola:
• facility_id,
• waste_fraction,
• accepted,
• limit_value,
• limit_unit,
• conditions,
• required_documents,
• valid_from,
• valid_to.


Przykład:
{
  "facility_id": "pszok_xyz",
  "waste_fraction": "tires",
  "accepted": true,
  "limit_value": 4,
  "limit_unit": "pcs_per_household_year",
  "conditions": "odpady wyłącznie od mieszkańców objętych systemem gminnym"
}


16. DEPOSIT RETURN POINT


Pola:
• id,
• name,
• location,
• return_type,
• accepted_container_types,
• operator,
• opening_hours,
• realtime_status — opcjonalne,
• source_id,
• verified_at.


return_type:
• automatic_rvm,
• manual,
• mixed.


accepted_container_types:
• pet,
• can,
• reusable_glass.


17. ALERT


Typy:
• collection_changed,
• collection_cancelled,
• additional_collection,
• facility_closed,
• facility_hours_changed,
• operator_issue,
• general_notice.


Pola:
• id,
• municipality_id,
• service_area_ids,
• severity,
• title,
• body,
• starts_at,
• ends_at,
• source_id.


18. STATIC VS REALTIME


WastePL Static:
• harmonogramy,
• service areas,
• PSZOK,
• punkty,
• zasady.


WastePL Realtime:
• nagłe zmiany,
• awarie,
• zamknięcia,
• przesunięcia,
• status punktów,
• wykonanie odbioru — tylko z integracji operatorskiej.


19. FORMATY WYMIANY


Rekomendowane:
• JSON — główny format API,
• CSV — prosty eksport/import,
• GeoJSON — punkty i geodane,
• ICS — kalendarz użytkownika,
• Webhook — zmiany i realtime.


20. API — PIERWSZY KONTRAKT


GET /v1/resolve-address
Wejście: tekst/adres.
Wyjście: PRG/TERYT + municipality.


GET /v1/collection
Parametry: address_id lub adres.
Wyjście: najbliższe collection events.


GET /v1/facilities
Parametry: lat/lon, municipality, waste_fraction.
Wyjście: PSZOK i inne punkty.


GET /v1/deposit-return-points
Parametry: lat/lon, radius, container_type.


GET /v1/alerts
Parametry: municipality/service_area.


21. PRZYKŁADOWA ODPOWIEDŹ API


{
  "address": {
    "display": "...",
    "terc": "...",
    "simc": "...",
    "ulic": "..."
  },
  "municipality": {
    "name": "Bobolice",
    "terc": "..."
  },
  "service_area": {
    "id": "bobolice_01"
  },
  "next_collections": [
    {
      "date": "2026-09-14",
      "fraction": "plastics_metals",
      "status": "scheduled"
    }
  ],
  "data_quality": {
    "verification_status": "official_source_unverified",
    "confidence": 0.99,
    "updated_at": "2026-08-27T12:00:00Z"
  },
  "source": {
    "owner": "Gmina Bobolice",
    "url": "..."
  }
}


22. ZASADY KOMPATYBILNOŚCI


• Nigdy nie zmieniamy znaczenia istniejącego pola w tej samej major version.
• Nowe opcjonalne pola mogą być dodawane w minor version.
• Canonical waste codes są stabilne.
• Lokalne nazwy nie mogą zastępować canonical_code.
• Źródło i wersja są obowiązkowe dla danych publikowanych produkcyjnie.
• Nie publikujemy zdarzenia bez rozstrzygniętego zakresu service_area.


23. OTWARTOŚĆ STANDARDU


Rekomendacja:
Specyfikacja WastePL powinna być opublikowana publicznie na GitHubie na licencji pozwalającej na implementację przez inne podmioty.


Komercyjne mogą pozostać:
• importer,
• hosting,
• dashboard,
• aplikacje,
• warstwa walidacji,
• historyczny dataset,
• API o gwarantowanej jakości/SLA,
• integracje partnerskie.


24. OTWARTE PYTANIA DO v0.2


• dokładny model budynków wielorodzinnych,
• harmonogramy zależne od administratora osiedla,
• harmonogramy workowe vs pojemnikowe,
• reguły świąteczne,
• identyfikacja tras operatorów,
• model wykonywania odbioru realtime,
• zasady licencyjne dla publicznego datasetu,
• standard kodowania lokalnych frakcji niestandardowych.
