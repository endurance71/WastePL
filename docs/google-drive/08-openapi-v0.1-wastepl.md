<!-- Source: https://docs.google.com/document/d/1gXQKMN_JeeWqziLxeXH-ROyveq4nBDxR2GeN5Z0_ofQ/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 08 — OpenAPI v0.1 — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/1gXQKMN_JeeWqziLxeXH-ROyveq4nBDxR2GeN5Z0_ofQ/edit)

WASTEPL — OPENAPI v0.1
Status: draft contract for PoC
Data: 27.08.2026


1. CEL
Ten dokument definiuje pierwszy stabilny kontrakt HTTP dla PoC WastePL. API ma oddzielać warstwę źródeł i parserów od aplikacji klienckich. Klient nie powinien wiedzieć, czy dane pochodzą z PDF, XLSX, HTML, API operatora czy panelu gminy.


2. ZASADY KONTRAKTU
• wersjonowanie w ścieżce: /v1,
• identyfikatory kanoniczne zamiast nazw jako klucze relacji,
• adres tekstowy jest wejściem wygodnym, ale po rozwiązaniu adresu preferowany jest addressId,
• każda odpowiedź danych produkcyjnych zawiera informację o źródle, aktualności i poziomie pewności,
• brak danych nie może być maskowany jako „brak odbioru” — zwracamy jawny status i ostrzeżenia,
• wszystkie daty kalendarzowe odbioru: ISO 8601 YYYY-MM-DD,
• wszystkie timestampy: ISO 8601 UTC.


3. OPENAPI 3.1 — KANONICZNY DRAFT


openapi: 3.1.0
info:
  title: WastePL API
  version: 0.1.0
  description: >-
    Ogólnopolska warstwa danych odpadowych. PoC: rozwiązywanie adresu,
    harmonogram odbioru oraz metadane źródła i jakości danych.
servers:
  - url: https://api.wastepl.pl
    description: production placeholder
  - url: http://localhost:3000
    description: local development


tags:
  - name: System
  - name: Addresses
  - name: Collection
  - name: Facilities


paths:
  /v1/health:
    get:
      tags: [System]
      operationId: getHealth
      summary: Health check
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                type: object
                required: [status, time]
                properties:
                  status:
                    type: string
                    const: ok
                  time:
                    type: string
                    format: date-time


  /v1/addresses/resolve:
    get:
      tags: [Addresses]
      operationId: resolveAddress
      summary: Resolve user input to a canonical WastePL address
      parameters:
        - in: query
          name: query
          required: true
          schema:
            type: string
            minLength: 3
          example: "Głowackiego 12, Bobolice"
        - in: query
          name: limit
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 10
            default: 5
      responses:
        '200':
          description: Candidate canonical addresses
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AddressResolveResponse'
        '400':
          $ref: '#/components/responses/BadRequest'


  /v1/collection:
    get:
      tags: [Collection]
      operationId: getCollectionSchedule
      summary: Return collection events for an address
      description: >-
        addressId is preferred. The address parameter is a convenience fallback for PoC.
        If both are supplied, addressId wins.
      parameters:
        - in: query
          name: addressId
          required: false
          schema:
            type: string
            format: uuid
        - in: query
          name: address
          required: false
          schema:
            type: string
            minLength: 3
        - in: query
          name: from
          required: false
          schema:
            type: string
            format: date
        - in: query
          name: days
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 365
            default: 90
      responses:
        '200':
          description: Canonical collection schedule
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CollectionScheduleResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '404':
          description: Address is valid, but WastePL currently has no applicable service area
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '409':
          description: Address maps ambiguously to multiple service areas and requires review
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'


  /v1/facilities:
    get:
      tags: [Facilities]
      operationId: listFacilities
      summary: Return nearby waste facilities and collection points
      parameters:
        - in: query
          name: lat
          required: true
          schema:
            type: number
            minimum: -90
            maximum: 90
        - in: query
          name: lon
          required: true
          schema:
            type: number
            minimum: -180
            maximum: 180
        - in: query
          name: kind
          required: false
          schema:
            $ref: '#/components/schemas/FacilityKind'
        - in: query
          name: radiusKm
          required: false
          schema:
            type: number
            minimum: 0.1
            maximum: 100
            default: 25
      responses:
        '200':
          description: Nearby facilities ordered by distance
          content:
            application/json:
              schema:
                type: object
                required: [items]
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/Facility'


components:
  responses:
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'


  schemas:
    VerificationStatus:
      type: string
      enum: [VERIFIED, OFFICIAL_SOURCE, UNVERIFIED, REVIEW_REQUIRED]


    DataQuality:
      type: object
      required: [verificationStatus, confidence, retrievedAt]
      properties:
        verificationStatus:
          $ref: '#/components/schemas/VerificationStatus'
        confidence:
          type: number
          minimum: 0
          maximum: 1
        retrievedAt:
          type: string
          format: date-time
        publishedAt:
          type: [string, 'null']
          format: date-time
        validFrom:
          type: [string, 'null']
          format: date
        validTo:
          type: [string, 'null']
          format: date
        warnings:
          type: array
          items:
            type: string


    Source:
      type: object
      required: [id, url, ownerType, format]
      properties:
        id:
          type: string
          format: uuid
        url:
          type: string
          format: uri
        ownerType:
          type: string
          enum: [MUNICIPALITY, MUNICIPAL_COMPANY, WASTE_OPERATOR, DEPOSIT_OPERATOR, OTHER_PUBLIC, OTHER]
        format:
          type: string
          enum: [API, JSON, CSV, XLSX, HTML, PDF_TEXT, PDF_SCAN, IMAGE, ICS, OTHER]
        reuseBasis:
          type: [string, 'null']


    Municipality:
      type: object
      required: [id, terc, name]
      properties:
        id:
          type: string
          format: uuid
        terc:
          type: string
        name:
          type: string


    Address:
      type: object
      required: [id, canonicalText, municipality]
      properties:
        id:
          type: string
          format: uuid
        prgId:
          type: [string, 'null']
        canonicalText:
          type: string
        postalCode:
          type: [string, 'null']
        buildingNumber:
          type: string
        locality:
          type: string
        street:
          type: [string, 'null']
        simc:
          type: [string, 'null']
        ulic:
          type: [string, 'null']
        municipality:
          $ref: '#/components/schemas/Municipality'
        location:
          type: [object, 'null']
          properties:
            lat:
              type: number
            lon:
              type: number


    AddressCandidate:
      type: object
      required: [address, score]
      properties:
        address:
          $ref: '#/components/schemas/Address'
        score:
          type: number
          minimum: 0
          maximum: 1


    AddressResolveResponse:
      type: object
      required: [query, items]
      properties:
        query:
          type: string
        items:
          type: array
          items:
            $ref: '#/components/schemas/AddressCandidate'


    WasteFraction:
      type: object
      required: [code, name]
      properties:
        code:
          type: string
          enum:
            - MIXED
            - BIO
            - PAPER
            - GLASS
            - METALS_PLASTICS
            - GREEN
            - BULKY
            - ASH
            - TEXTILES
            - OTHER
        name:
          type: string


    CollectionEvent:
      type: object
      required: [id, date, fraction, status]
      properties:
        id:
          type: string
          format: uuid
        date:
          type: string
          format: date
        fraction:
          $ref: '#/components/schemas/WasteFraction'
        status:
          type: string
          enum: [SCHEDULED, CHANGED, CANCELLED, COMPLETED]
        note:
          type: [string, 'null']


    ServiceArea:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        buildingType:
          type: [string, 'null']
          enum: [SINGLE_FAMILY, MULTI_FAMILY, MIXED, OTHER, null]


    CollectionScheduleResponse:
      type: object
      required: [address, municipality, serviceArea, events, source, quality]
      properties:
        address:
          $ref: '#/components/schemas/Address'
        municipality:
          $ref: '#/components/schemas/Municipality'
        serviceArea:
          $ref: '#/components/schemas/ServiceArea'
        events:
          type: array
          items:
            $ref: '#/components/schemas/CollectionEvent'
        source:
          $ref: '#/components/schemas/Source'
        quality:
          $ref: '#/components/schemas/DataQuality'


    FacilityKind:
      type: string
      enum: [PSZOK, DEPOSIT_RVM, DEPOSIT_MANUAL, ELECTRONICS, TEXTILES, BATTERIES, MEDICINES, OTHER]


    Facility:
      type: object
      required: [id, kind, name, lat, lon]
      properties:
        id:
          type: string
          format: uuid
        kind:
          $ref: '#/components/schemas/FacilityKind'
        name:
          type: string
        address:
          type: [string, 'null']
        lat:
          type: number
        lon:
          type: number
        distanceKm:
          type: [number, 'null']
        openingHours:
          type: [object, 'null']
          additionalProperties: true
        acceptedWasteCodes:
          type: array
          items:
            type: string
        quality:
          $ref: '#/components/schemas/DataQuality'


    ErrorResponse:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          examples: [ADDRESS_NOT_FOUND, SERVICE_AREA_NOT_FOUND, SERVICE_AREA_AMBIGUOUS, INVALID_REQUEST]
        message:
          type: string
        details:
          type: [object, 'null']
          additionalProperties: true


4. PRZYKŁADOWA ODPOWIEDŹ /v1/collection


{
  "address": {
    "id": "7dca6b6d-7ca7-4f48-b833-111111111111",
    "prgId": "PRG:example",
    "canonicalText": "ul. Przykładowa 12, 76-020 Bobolice",
    "postalCode": "76-020",
    "buildingNumber": "12",
    "locality": "Bobolice",
    "street": "Przykładowa",
    "simc": "...",
    "ulic": "...",
    "municipality": {
      "id": "...",
      "terc": "...",
      "name": "Bobolice"
    },
    "location": { "lat": 54.0, "lon": 16.5 }
  },
  "municipality": { "id": "...", "terc": "...", "name": "Bobolice" },
  "serviceArea": {
    "id": "...",
    "name": "Rejon 1 — zabudowa jednorodzinna",
    "buildingType": "SINGLE_FAMILY"
  },
  "events": [
    {
      "id": "...",
      "date": "2026-09-02",
      "fraction": { "code": "BIO", "name": "Bioodpady" },
      "status": "SCHEDULED",
      "note": null
    }
  ],
  "source": {
    "id": "...",
    "url": "https://example.gov.pl/harmonogram.pdf",
    "ownerType": "MUNICIPALITY",
    "format": "PDF_TEXT",
    "reuseBasis": "official_public_source"
  },
  "quality": {
    "verificationStatus": "OFFICIAL_SOURCE",
    "confidence": 0.99,
    "retrievedAt": "2026-08-27T12:00:00Z",
    "publishedAt": "2026-07-22T00:00:00Z",
    "validFrom": "2026-07-22",
    "validTo": "2026-12-31",
    "warnings": []
  }
}


5. REGUŁY BŁĘDÓW
ADDRESS_NOT_FOUND — nie znaleziono wiarygodnego adresu w resolverze.
SERVICE_AREA_NOT_FOUND — adres istnieje, lecz nie mamy aktualnego mapowania do strefy.
SERVICE_AREA_AMBIGUOUS — więcej niż jedna reguła ma ten sam najwyższy priorytet.
SOURCE_STALE — źródło istnieje, ale przekroczyło dopuszczalny freshness threshold.
SOURCE_REVIEW_REQUIRED — parser wykrył zmianę, której nie można bezpiecznie opublikować automatycznie.


6. KRYTERIA STABILIZACJI v0.1
Kontrakt może zostać oznaczony jako PoC-stable, gdy:
• działa resolver adresowy dla co najmniej dwóch gmin pilotażowych,
• /v1/collection przechodzi testy golden-data na minimum 30 adresach,
• odpowiedź zawsze wskazuje źródło i jakość danych,
• nie występują ciche fallbacki między strefami,
• przykładowy klient webowy może działać bez wiedzy o formacie danych źródłowych.
