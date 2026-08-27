# ADR-0003: Model collection coverage with address rules

Default representation is rule-based rather than GIS polygons.

Specificity:
`EXPLICIT_ADDRESS > EXPLICIT_NUMBERS > NUMBER_RANGE > STREET > LOCALITY > MUNICIPALITY`.

## Resolution contract

1. Only active service areas valid for the requested date are considered.
2. `EXCLUDE` rules are evaluated before include rules and subtract the matching address from that service area completely.
3. For every remaining service area, the highest-specificity matching include rule is selected.
4. `priority` breaks ties only between rules with the same specificity. It never overrides a more specific rule.
5. If different service areas have equal top specificity and equal priority, the result is `AMBIGUOUS`; the system never uses silent first-match wins.
6. Resolution exposes the matching rule id, rule type, specificity and priority so callers can explain why an address matched.

## Number matching

`NUMBER_RANGE` evaluates the leading numeric component of a building number. For example `12A` belongs to numeric range `10..20` and is even. `ODD` and `EVEN` parity constraints are applied to that numeric component.

`EXPLICIT_NUMBERS` compares normalized building-number strings (trimmed, case-insensitive and whitespace-insensitive), so `12A` and `12 a` are equivalent.

## EXCLUDE payload

The database row uses `rule_type = 'EXCLUDE'` and stores the selector to subtract in `exclusion_payload`. The payload uses one of the regular include selector types and their fields, for example:

```json
{
  "type": "EXPLICIT_ADDRESS",
  "addressId": "<address uuid>"
}
```

Both camelCase and snake_case field names are accepted by the PostgreSQL adapter to make ingestion migrations tolerant of source-adapter conventions.
