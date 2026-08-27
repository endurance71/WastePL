# PDF_TEXT fixtures

These are minimal text-layer excerpts used to regression-test deterministic parsers. They are not copies of the complete third-party PDF documents.

Sources verified on 2026-08-27:

- `manowo-2ab-2026.txt` — PGK Koszalin, Gmina Manowo, `https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/manowo/2AB.pdf`
- `koszalin-bio-2026.txt` — PGK Koszalin, multi-family BIO schedule, `https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/koszalin2/bio.pdf`
- `koszalin-sr2-ambiguous-2026.txt` — PGK Koszalin, Sector II, `https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/koszalin/sr2.pdf?ver5=`

The production adapter receives provenance from the immutable raw `source_artifacts` record. The fixture SHA used in tests identifies the exact fixture input, while production uses the SHA-256 of the actual source artifact.
