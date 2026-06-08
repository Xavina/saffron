# Linus — History

## Core Context

- **Project:** A Next.js admin UI for SpiceDB that manages schemas, relationships, and permission checks via a gRPC backend proxy.
- **Role:** Backend Dev
- **Joined:** 2026-04-02T15:36:02.445Z

## Learnings

<!-- Append learnings below -->
- 2026-04-29: When adding Copilot SDK orchestration to a server route, keep the frontend contract stable and expose existing SpiceDB capabilities as explicit backend tools instead of letting the runtime reach beyond the service boundary.
- 2025-01-21: Created theme build script at `scripts/generate-themes.js` that discovers themes from `themes/*/theme.json` and generates CSS (`styles/generated-themes.css`) and TypeScript (`lib/generated/themes.ts`) outputs. The script gracefully handles missing themes and is wired into Next.js build via `prebuild` script. CSS variables always use `--saffron-*` prefix regardless of theme name (existing convention). Generated files are excluded from git via `.gitignore`.
