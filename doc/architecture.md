# Architecture

## 1. Purpose and Scope

Saffron is a Next.js 15 application for operating and inspecting SpiceDB. It provides a browser UI for schema editing/visualization, relationship management, permission evaluation, health/status checks, and a constrained terminal-like interface for selected `zed` workflows.

This document describes the current runtime architecture and the main technical trade-offs.

## 2. High-Level Structure

Saffron follows a simple two-layer shape:

- **UI layer (`pages/`, `components/`)**: React pages render workflows and call local API routes.
- **API layer (`pages/api/spicedb/`)**: Next.js server routes proxy requests to SpiceDB using the AuthZed Node client.

Shared SpiceDB client setup lives in `lib/spicedb.js`, which centralizes endpoint normalization, token handling, and client reuse.

## 3. Frontend Architecture

### 3.1 Page model

The app uses file-based routes under `pages/` for primary domains:

- `dashboard.tsx`
- `schema.tsx`
- `relationships.tsx`
- `permissions.tsx`
- `check.tsx`
- `terminal.tsx`
- `assistant.tsx` (feature-flag gated)

`pages/_app.tsx` provides global layout concerns such as page title handling, theme provider wiring, and a route-transition loading indicator.

### 3.2 UI state and persistence

- **Schema graph positions** are persisted in IndexedDB (`components/SchemaGraph.tsx`) with migration support from legacy localStorage.
- **Dashboard stats** are cache-hydrated from localStorage and then refreshed from API, with background exact-count upgrades.
- **Theme selection** is resolved in `lib/theme.ts`, including backward-compatible aliases (`company -> materialise`, `authed -> authzed`).

### 3.3 UX behavior

- Route changes show a global loading bar/pill and progress cursor.
- Permissions UI uses real API-backed checks (`/api/spicedb/check`) with trace rendering, replacing prior mocked behavior.

## 4. Backend/API Architecture

### 4.1 API gateway role

The API layer acts as a thin façade over SpiceDB gRPC operations:

- schema read/write
- relationship read/write/delete
- permission check / expand / lookup-subjects
- stats/health helpers
- constrained terminal command mapping

### 4.2 Reliability patterns

`/api/spicedb/namespace-count` includes resilience for large datasets and transient gRPC faults:

- page timeouts
- bounded retries with exponential backoff
- partial approximate responses instead of hard-fail on transient errors

Dashboard code consumes these responses and progressively upgrades approximate namespace counts in the background.

### 4.3 Operational constraints

Terminal execution (`/api/spicedb/terminal`) is command-parsed and limited to supported subcommands (not arbitrary shell execution), but still represents a sensitive operational endpoint.

## 5. Runtime and Build Notes

- Next.js dist directory is runtime-aware (`next.config.mjs`), using `.next-wsl` on WSL to avoid mixed-cache conflicts with Windows paths.
- Theme assets and generated theme artifacts are produced during `prebuild` via `scripts/generate-themes.js`.

## 6. Current Risks and Gaps

1. Sensitive API routes are not consistently protected with authentication/authorization controls.
2. There is no first-class automated test harness (`package.json` has no `test` script), increasing regression risk.
3. Some page-level modules are still large and state-heavy, making future changes harder to reason about.
4. Terminal-style mutation/query capability requires stronger guardrails (authz, audit, and rate controls) for non-local usage.

## 7. Recommended Architecture Work

1. Add an explicit API security layer (authn/authz + route policy) for all mutation and sensitive read paths.
2. Introduce a minimal automated test baseline for API contracts and core UI flows.
3. Add structured audit events around schema/relationship/terminal operations.
4. Incrementally extract shared request/state orchestration from large pages into reusable modules.
