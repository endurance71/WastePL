# ADR-0003: Model collection coverage with address rules

Default representation is rule-based rather than GIS polygons.

Specificity:
`EXPLICIT_ADDRESS > EXPLICIT_NUMBERS > NUMBER_RANGE > STREET > LOCALITY > MUNICIPALITY`.

`EXCLUDE` rules subtract coverage. Equal top-ranked matches across different service areas
must produce an ambiguity requiring review; the system never uses silent first-match wins.
