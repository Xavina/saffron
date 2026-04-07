# App Analysis

## 1. Overview

Saffron is a Next.js 15 application that provides a browser UI for working with SpiceDB. The repository combines a React-based frontend with Next.js API routes that proxy requests to SpiceDB over gRPC via the AuthZed Node client.

The product scope is practical and focused: schema management, relationship management, permission checks, health/status views, and a terminal-style interface for selected `zed` operations. The overall shape is suitable for local development and demos, but several implementation areas still read as prototype-grade rather than production-ready.

## 2. Architecture

The architecture is straightforward. UI pages under `pages/` call local API routes under `pages/api/spicedb/`, and those routes share a small client wrapper in `lib/spicedb.js` for endpoint normalization, token loading, and gRPC client reuse.

This split is a reasonable starting point because it keeps SpiceDB credentials on the server side and centralizes connection logic. The trade-off is that the API layer is currently very thin, so cross-cutting concerns such as authentication, authorization, input governance, rate limiting, and auditability are mostly absent from the request path.

## 3. Frontend Assessment

The frontend appears easy to navigate and aligned with the repo goal of being a usable SpiceDB UI. The feature set described in the README is reflected in the page structure, and the app-level layout keeps the experience cohesive.

The main gap is that `pages/permissions.tsx` still uses mocked results generated with `setTimeout`, `Math.random()`, and local history state rather than the real permission-check API. That means one of the core workflows can give convincing but non-authoritative answers, which weakens trust in the UI and makes the product analysis of authorization behavior incomplete.

## 4. Backend Assessment

The backend is effectively a Next.js API façade over SpiceDB. `lib/spicedb.js` is a useful integration seam and handles endpoint normalization and client construction cleanly enough for the current size of the project.

The main concern is exposure. Routes such as schema writes, relationship writes/deletes, permission checks, terminal execution, and health/history access do not show any evident protection in the code reviewed. If these endpoints are exposed outside a trusted development environment, they become sensitive operational surfaces that could leak authorization data or allow unauthorized mutation of the SpiceDB model and relationships.

The terminal endpoint is especially notable because it accepts a user-provided command string and maps it into supported `zed`-style actions. Even with limited subcommands, this increases the need for strict request validation, authentication, and auditing.

## 5. Testing and Quality

There is no evident automated test setup in the repository as reviewed. `package.json` exposes `dev`, `build`, `start`, and `lint`, but no test script, and the code examined does not indicate a current unit, integration, or end-to-end test harness.

That leaves core behaviors such as API validation, SpiceDB error handling, and page-to-route integration largely dependent on manual verification. For a tool that manages authorization state, that is a meaningful quality gap.

## 6. Key Risks

- The permissions UI currently presents mocked results, which can mislead users about real authorization outcomes.
- Sensitive API routes appear unprotected, creating risk if the app is deployed beyond a local or otherwise trusted environment.
- Default or fallback connection/token behavior in `lib/spicedb.js` is convenient for development but unsafe if carried into broader environments without stronger configuration discipline.
- The terminal-style endpoint expands the operational attack surface and needs tighter controls than a normal read-only admin page.
- The absence of evident automated tests increases regression risk across schema, relationship, and permission workflows.

## 7. Recommended Next Steps

1. Replace the mocked logic in `pages/permissions.tsx` with calls to the real permission-check API and clearly surface request and response states.
2. Add authentication and route-level authorization to all sensitive `pages/api/spicedb/*` endpoints before treating this as anything beyond a local admin tool.
3. Establish a minimum automated test baseline: API route tests for request validation and SpiceDB error handling, plus one end-to-end smoke path for the main user flows.
4. Tighten operational safeguards around schema mutation, relationship mutation, and terminal actions with better validation, logging, and environment-specific controls.