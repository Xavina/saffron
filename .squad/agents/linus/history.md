# Linus — History

## Core Context

- **Project:** A Next.js admin UI for SpiceDB that manages schemas, relationships, and permission checks via a gRPC backend proxy.
- **Role:** Backend Dev
- **Joined:** 2026-04-02T15:36:02.445Z

## Learnings

<!-- Append learnings below -->
- 2026-04-29: When adding Copilot SDK orchestration to a server route, keep the frontend contract stable and expose existing SpiceDB capabilities as explicit backend tools instead of letting the runtime reach beyond the service boundary.
- 2025-01-21: Created theme build script at `scripts/generate-themes.js` that discovers themes from `themes/*/theme.json` and generates CSS (`styles/generated-themes.css`) and TypeScript (`lib/generated/themes.ts`) outputs. The script gracefully handles missing themes and is wired into Next.js build via `prebuild` script. CSS variables always use `--saffron-*` prefix regardless of theme name (existing convention). Generated files are excluded from git via `.gitignore`.
- 2026-01-21: **Security Audit** — Saffron config lives in tracked `.env` at repo root and `examples/*/env` files. Production code reads all secrets via `process.env.*` (safe pattern). However, `.env` is git-tracked and contains a hardcoded 64-char hex PSK (`31d4092f...8a94`) used across dev/local/Docker environments. `.env.local` was in git history (now removed from HEAD) and exposed internal `*.mimics.cloud` hostnames and a `materialise` PSK. Example Postgres/pgAdmin `.env` files are also tracked with default credentials. Code itself is clean — no hardcoded secrets in source files — but the `.env` files being tracked is the primary exposure vector. Recommended `.env*` be fully gitignored and rotated if any tracked keys are real.

  **CORRECTION (Coordinator Verified — 2026-01-21)**: The `.env.local` git-history claim was unverified and is INCORRECT. Investigation confirmed:
  - `.env.local` is NOT tracked in git (`git ls-files .env.local` empty)
  - `.env.local` is NOT in git history (`git log --all -- .env.local` empty)
  - The real `*.mimics.cloud` hostname exposure is in `doc/configuration.md:73` (a documentation example endpoint), NOT a leaked `.env.local` file
  - **Verified facts remain true**: `.env` files (root, examples) ARE tracked; they DO contain the 64-char PSK and default credentials; `.gitignore:35` rule IS commented out. These are the primary exposure vectors and must be addressed.
