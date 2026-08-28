<!-- Source: https://docs.google.com/document/d/1g65DSKAgZEKtUgJ-QzCQXcf_VgVEI8z5Xmt8MIGybN8/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 11 — WastePL JSON Schema v0.1

[Oryginał w Google Docs](https://docs.google.com/document/d/1g65DSKAgZEKtUgJ-QzCQXcf_VgVEI8z5Xmt8MIGybN8/edit)

WASTEPL — JSON SCHEMA v0.1
Status: machine-readable draft for normalized data
Data: 27.08.2026


1. CEL
Ten schemat jest kanoniczną reprezentacją znormalizowanego pakietu danych WastePL. W repo powinien znaleźć się jako schemas/wastepl-v0.1.schema.json. JSON Schema służy do walidacji outputu parserów przed publikacją do bazy/API.


2. SCHEMA — draft 2020-12


{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://wastepl.pl/schemas/wastepl-v0.1.schema.json",
  "title": "WastePL Normalized Dataset v0.1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "municipality", "serviceAreas", "collectionEvents", "sources"],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "const": "0.1.0"
    },
    "municipality": { "$ref": "#/$defs/municipality" },
    "serviceAreas": {
      "type": "array",
      "items": { "$ref": "#/$defs/serviceArea" }
    },
    "collectionEvents": {
      "type": "array",
      "items": { "$ref": "#/$defs/collectionEvent" }
    },
    "facilities": {
      "type": "array",
      "default": [],
      "items": { "$ref": "#/$defs/facility" }
    },
    "alerts": {
      "type": "array",
      "default": [],
      "items": { "$ref": "#/$defs/alert" }
    },
    "sources": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/source" }
    }
  },
  "$defs": {
    "uuid": {
      "type": "string",
      "format": "uuid"
    },
    "isoDate": {
      "type": "string",
      "format": "date"
    },
    "isoDateTime": {
      "type": "string",
      "format": "date-time"
    },
    "municipality": {
      "type": "object",
      "additionalProperties": false,
      "required": ["terc", "name"],
      "properties": {
        "id": { "$ref": "#/$defs/uuid" },
        "terc": { "type": "string", "minLength": 4, "maxLength": 10 },
        "name": { "type": "string", "minLength": 1 },
        "municipalityType": {
          "type": ["string", "null"],
          "enum": ["URBAN", "RURAL", "URBAN_RURAL", "DISTRICT_CITY", "OTHER", null]
        },
        "voivodeshipCode": { "type": ["string", "null"] },
        "countyCode": { "type": ["string", "null"] }
      }
    },
    "sourceFormat": {
      "type": "string",
      "enum": ["API", "JSON", "CSV", "XLSX", "HTML", "PDF_TEXT", "PDF_SCAN", "IMAGE", "ICS", "OTHER"]
    },
    "ownerType": {
      "type": "string",
      "enum": ["MUNICIPALITY", "MUNICIPAL_COMPANY", "WASTE_OPERATOR", "DEPOSIT_OPERATOR", "OTHER_PUBLIC", "OTHER"]
    },
    "verificationStatus": {
      "type": "string",
      "enum": ["VERIFIED", "OFFICIAL_SOURCE", "UNVERIFIED", "REVIEW_REQUIRED"]
    },
    "quality": {
      "type": "object",
      "additionalProperties": false,
      "required": ["verificationStatus", "confidence", "retrievedAt"],
      "properties": {
        "verificationStatus": { "$ref": "#/$defs/verificationStatus" },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "retrievedAt": { "$ref": "#/$defs/isoDateTime" },
        "publishedAt": {
          "anyOf": [
            { "$ref": "#/$defs/isoDateTime" },
            { "type": "null" }
          ]
        },
        "validFrom": {
          "anyOf": [
            { "$ref": "#/$defs/isoDate" },
            { "type": "null" }
          ]
        },
        "validTo": {
          "anyOf": [
            { "$ref": "#/$defs/isoDate" },
            { "type": "null" }
          ]
        },
        "warnings": {
          "type": "array",
          "default": [],
          "items": { "type": "string" }
        }
      }
    },
    "source": {
      "type": "object",
      "additionalProperties": false,
      "required": ["sourceKey", "url", "ownerType", "format", "artifact"],
      "properties": {
        "sourceKey": { "type": "string", "minLength": 1 },
        "url": { "type": "string", "format": "uri" },
        "ownerType": { "$ref": "#/$defs/ownerType" },
        "ownerName": { "type": ["string", "null"] },
        "format": { "$ref": "#/$defs/sourceFormat" },
        "reuseBasis": { "type": ["string", "null"] },
        "reuseTerms": {
          "type": ["object", "null"],
          "additionalProperties": true
        },
        "artifact": {
          "type": "object",
          "additionalProperties": false,
          "required": ["sha256", "retrievedAt", "parserKey", "parserVersion"],
          "properties": {
            "sha256": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{64}$"
            },
            "retrievedAt": { "$ref": "#/$defs/isoDateTime" },
            "publishedAt": {
              "anyOf": [
                { "$ref": "#/$defs/isoDateTime" },
                { "type": "null" }
              ]
            },
            "validFrom": {
              "anyOf": [
                { "$ref": "#/$defs/isoDate" },
                { "type": "null" }
              ]
            },
            "validTo": {
              "anyOf": [
                { "$ref": "#/$defs/isoDate" },
                { "type": "null" }
              ]
            },
            "parserKey": { "type": "string", "minLength": 1 },
            "parserVersion": { "type": "string", "minLength": 1 },
            "extractionConfidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            "storageUri": { "type": ["string", "null"] }
          }
        }
      }
    },
    "buildingType": {
      "type": ["string", "null"],
      "enum": ["SINGLE_FAMILY", "MULTI_FAMILY", "MIXED", "OTHER", null]
    },
    "coverageRuleType": {
      "type": "string",
      "enum": ["MUNICIPALITY", "LOCALITY", "STREET", "NUMBER_RANGE", "EXPLICIT_NUMBERS", "EXPLICIT_ADDRESS", "EXCLUDE"]
    },
    "coverageRule": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "priority"],
      "properties": {
        "type": { "$ref": "#/$defs/coverageRuleType" },
        "priority": { "type": "integer", "minimum": 0 },
        "simc": { "type": ["string", "null"] },
        "ulic": { "type": ["string", "null"] },
        "localityName": { "type": ["string", "null"] },
        "streetName": { "type": ["string", "null"] },
        "numberFrom": { "type": ["integer", "null"], "minimum": 1 },
        "numberTo": { "type": ["integer", "null"], "minimum": 1 },
        "parity": {
          "type": ["string", "null"],
          "enum": ["ALL", "ODD", "EVEN", null]
        },
        "explicitNumbers": {
          "type": "array",
          "default": [],
          "items": { "type": "string" }
        },
        "explicitAddress": { "type": ["string", "null"] },
        "exclude": {
          "type": ["object", "null"],
          "additionalProperties": true
        },
        "note": { "type": ["string", "null"] }
      }
    },
    "serviceArea": {
      "type": "object",
      "additionalProperties": false,
      "required": ["key", "name", "coverage"],
      "properties": {
        "key": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1 },
        "buildingType": { "$ref": "#/$defs/buildingType" },
        "validFrom": {
          "anyOf": [
            { "$ref": "#/$defs/isoDate" },
            { "type": "null" }
          ]
        },
        "validTo": {
          "anyOf": [
            { "$ref": "#/$defs/isoDate" },
            { "type": "null" }
          ]
        },
        "coverage": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/coverageRule" }
        }
      }
    },
    "wasteFractionCode": {
      "type": "string",
      "enum": ["MIXED", "BIO", "PAPER", "GLASS", "METALS_PLASTICS", "GREEN", "BULKY", "ASH", "TEXTILES", "OTHER"]
    },
    "collectionEvent": {
      "type": "object",
      "additionalProperties": false,
      "required": ["serviceAreaKey", "fraction", "date", "status", "sourceKey", "quality"],
      "properties": {
        "serviceAreaKey": { "type": "string", "minLength": 1 },
        "fraction": { "$ref": "#/$defs/wasteFractionCode" },
        "fractionLabelSource": { "type": ["string", "null"] },
        "date": { "$ref": "#/$defs/isoDate" },
        "status": {
          "type": "string",
          "enum": ["SCHEDULED", "CHANGED", "CANCELLED", "COMPLETED"]
        },
        "note": { "type": ["string", "null"] },
        "sourceKey": { "type": "string", "minLength": 1 },
        "fingerprint": { "type": ["string", "null"] },
        "quality": { "$ref": "#/$defs/quality" }
      }
    },
    "facilityKind": {
      "type": "string",
      "enum": ["PSZOK", "DEPOSIT_RVM", "DEPOSIT_MANUAL", "ELECTRONICS", "TEXTILES", "BATTERIES", "MEDICINES", "OTHER"]
    },
    "facility": {
      "type": "object",
      "additionalProperties": false,
      "required": ["key", "kind", "name", "location", "sourceKey", "quality"],
      "properties": {
        "key": { "type": "string", "minLength": 1 },
        "kind": { "$ref": "#/$defs/facilityKind" },
        "name": { "type": "string", "minLength": 1 },
        "address": { "type": ["string", "null"] },
        "location": {
          "type": "object",
          "additionalProperties": false,
          "required": ["lat", "lon"],
          "properties": {
            "lat": { "type": "number", "minimum": -90, "maximum": 90 },
            "lon": { "type": "number", "minimum": -180, "maximum": 180 }
          }
        },
        "openingHours": {
          "type": ["object", "null"],
          "additionalProperties": true
        },
        "acceptedWaste": {
          "type": "array",
          "default": [],
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["code", "label"],
            "properties": {
              "code": { "type": "string" },
              "label": { "type": "string" },
              "conditions": {
                "type": ["object", "null"],
                "additionalProperties": true
              },
              "limits": {
                "type": ["object", "null"],
                "additionalProperties": true
              }
            }
          }
        },
        "rulesUrl": { "type": ["string", "null"], "format": "uri" },
        "sourceKey": { "type": "string", "minLength": 1 },
        "quality": { "$ref": "#/$defs/quality" }
      }
    },
    "alert": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "title", "body", "startsAt", "sourceKey", "quality"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["SCHEDULE_CHANGE", "DELAY", "CANCELLATION", "FACILITY_CLOSURE", "SERVICE_NOTICE", "OTHER"]
        },
        "serviceAreaKey": { "type": ["string", "null"] },
        "title": { "type": "string", "minLength": 1 },
        "body": { "type": "string", "minLength": 1 },
        "startsAt": { "$ref": "#/$defs/isoDateTime" },
        "endsAt": {
          "anyOf": [
            { "$ref": "#/$defs/isoDateTime" },
            { "type": "null" }
          ]
        },
        "sourceKey": { "type": "string", "minLength": 1 },
        "quality": { "$ref": "#/$defs/quality" }
      }
    }
  }
}


3. REGUŁY, KTÓRYCH SAM JSON SCHEMA NIE WYMUSI
Po walidacji strukturalnej pipeline musi wykonać walidację domenową:
• każdy collectionEvent.serviceAreaKey musi istnieć w serviceAreas,
• każdy sourceKey musi istnieć w sources,
• daty collectionEvent muszą mieścić się w okresie ważności źródła/strefy, jeśli okres jest podany,
• numberFrom <= numberTo,
• serviceArea coverage nie może powodować nierozwiązanego konfliktu o tym samym priorytecie/specyficzności,
• hash artifactu musi odpowiadać rzeczywistym bajtom pliku,
• wydarzenie z REVIEW_REQUIRED nie może trafić do produkcyjnego endpointu jako pewny harmonogram.


4. MINIMALNY POPRAWNY FIXTURE


{
  "schemaVersion": "0.1.0",
  "municipality": {
    "terc": "example",
    "name": "Gmina testowa"
  },
  "serviceAreas": [
    {
      "key": "area-1",
      "name": "Rejon 1",
      "buildingType": "SINGLE_FAMILY",
      "coverage": [
        {
          "type": "LOCALITY",
          "priority": 100,
          "simc": "example",
          "localityName": "Miejscowość testowa",
          "explicitNumbers": []
        }
      ]
    }
  ],
  "collectionEvents": [
    {
      "serviceAreaKey": "area-1",
      "fraction": "BIO",
      "fractionLabelSource": "BIO",
      "date": "2026-09-02",
      "status": "SCHEDULED",
      "sourceKey": "source-1",
      "quality": {
        "verificationStatus": "OFFICIAL_SOURCE",
        "confidence": 1,
        "retrievedAt": "2026-08-27T12:00:00Z",
        "warnings": []
      }
    }
  ],
  "facilities": [],
  "alerts": [],
  "sources": [
    {
      "sourceKey": "source-1",
      "url": "https://example.gov.pl/harmonogram.pdf",
      "ownerType": "MUNICIPALITY",
      "ownerName": "Gmina testowa",
      "format": "PDF_TEXT",
      "artifact": {
        "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "retrievedAt": "2026-08-27T12:00:00Z",
        "parserKey": "pdf-table-v0",
        "parserVersion": "0.1.0",
        "extractionConfidence": 1,
        "storageUri": "s3://wastepl-raw/example/source-1/aaaaaaaa.pdf"
      }
    }
  ]
}


5. NEGATYWNE FIXTURES DO TESTÓW
• collection event bez sourceKey,
• confidence > 1,
• nieznana frakcja,
• nieprawidłowy format daty,
• source artifact bez 64-znakowego SHA-256,
• facility poza zakresem lat/lon,
• coverage rule z niedozwolonym typem,
• root z dodatkowym polem spoza specyfikacji.


6. WERSJONOWANIE STANDARDU
Patch: doprecyzowania niełamliwe.
Minor: nowe opcjonalne pola/enumy zachowujące kompatybilność.
Major: zmiany breaking w reprezentacji danych.
Każdy normalized dataset musi deklarować schemaVersion.
