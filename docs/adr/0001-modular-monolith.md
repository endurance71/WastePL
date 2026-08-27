# ADR-0001: Start as a modular monolith

## Decision
PoC uses one monorepo with API and worker sharing stable domain/contracts packages.

## Why
The main risk is data correctness, provenance and parser reliability, not request throughput.
A modular monolith minimizes operational overhead and makes end-to-end tests easier.

## Consequences
- Keep module boundaries explicit.
- Parsing runs in worker jobs, never in user HTTP requests.
- Modules may be extracted later if measurements justify it.
