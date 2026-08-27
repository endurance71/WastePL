# ADR-0005: Deposit-return source precedence, identity and freshness

**Status:** Accepted  
**Date:** 2026-08-27

## Context

Poland's deposit-return system is multi-operator. WastePL cannot assume that one public consumer map or one operator contains the complete national network. The Ministry publishes operator and aggregate network information, but the research checkpoint for Sprint 02 did not identify a Ministry-hosted downloadable/API dataset with all return-point coordinates.

WastePL therefore needs a source policy that remains provider-neutral and prevents stale or inferred machine state from becoming an authoritative consumer claim.

## Decision

### Source hierarchy

Static deposit-point assertions are ranked in this order:

1. `OPERATOR_TELEMETRY_OR_FEED`
2. `OPERATOR_OR_RETAILER_VERIFIED_FEED`
3. `VERIFIED_PUBLISHED_LIST`
4. `PUBLIC_SECTOR_OFFICIAL`
5. `REVIEWED_FALLBACK`

A source registration must define its own freshness TTL. WastePL does not invent one universal lifetime for all providers.

When multiple fresh assertions exist, higher source tier wins. Within the same tier, newer retrieval wins; source key is only the deterministic final tie-breaker.

If same-tier current assertions disagree on point kind or accepted container classes, WastePL may select deterministically for processing but MUST also mark the result `REVIEW_REQUIRED`. It must not union conflicting capabilities silently.

### RVM vs manual return

`DEPOSIT_RVM` and `DEPOSIT_MANUAL` are distinct facility kinds. Accepted packaging is a separate capability (`PET_BOTTLE`, `METAL_CAN`, `REUSABLE_GLASS_BOTTLE`).

A retailer venue can therefore expose both a manual-return facility and an RVM facility without those records being collapsed into one kind.

### Operational status

There is no `isWorking` boolean in the canonical contract.

A non-`UNKNOWN` operational status requires:

- a source key,
- an observation timestamp,
- a source-specific status freshness TTL.

After the TTL expires the assertion is ignored for current operational state and WastePL returns `UNKNOWN`. A stale `TEMPORARILY_UNAVAILABLE` must not keep a machine red forever; a stale `OPERATIONAL` must not keep it green forever.

Opening hours are not operational telemetry.

### Stable identity

Source adapters may emit external identities with a role:

- `POINT` — identity of a return point,
- `VENUE` — identity of the store/site,
- `MACHINE` — identity of a physical RVM asset.

Canonical consumer identity selection is deterministic:

1. prefer a stable `POINT` identity;
2. otherwise use a stable `VENUE` identity plus facility kind;
3. `MACHINE` identity alone is not sufficient to auto-merge a consumer-facing point;
4. without POINT/VENUE identity, automatic cross-source merge is forbidden and the record requires review/candidate matching in Issue #20.

Multiple machine assets can therefore belong to the same RVM venue without creating duplicate map pins, while RVM and manual collection at the same venue remain separate facilities.

Namespaces are normalized by adapters (for example a stable retailer namespace). Two values are considered exact identity matches only when normalized namespace, role and id agree.

### Cross-source fuzzy reconciliation

Address/name/distance similarity is intentionally NOT part of this ADR. It belongs to #20, where low-confidence matches must become review candidates instead of silent merges.

## Never infer

WastePL must not infer any of the following without a timestamped source assertion:

- machine working/broken state,
- machine fullness or remaining capacity,
- queue length,
- whether a retailer currently accepts a specific package class merely because legislation would normally require collection,
- exact machine count at a venue.

## Consequences

- provider APIs can be added later without changing core source semantics;
- public/municipal lists remain useful fallback sources but cannot override a current operator feed;
- stale telemetry degrades to `UNKNOWN` rather than false certainty;
- exact-id deduplication is deterministic and safe;
- fuzzy reconciliation remains an explicit, auditable later layer.
