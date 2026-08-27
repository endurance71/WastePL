# ADR-0002: Source artifacts are immutable

Every unique source payload is addressed by SHA-256 and stored immutably.
The normalized records retain a reference to the artifact that produced them.

This enables auditability, reproducible parser tests, historical diffs and safe rollback.
