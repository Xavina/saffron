# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-11

### Added
- **AI Assistant** — Ask questions about your SpiceDB schema and authorization model, powered by the GitHub Copilot SDK. Opt-in via the `ENABLE_ASSISTANT` flag. Includes AuthZed MCP documentation tools and custom SpiceDB tools (check, expand, lookup-subjects, schema/relationship read). Assistant endpoints (`/api/spicedb/chat`, `/api/spicedb/chat-stream`, `/api/spicedb/assistant-status`) are gated and return 404 when disabled.
- **Schema Graph Visualization** — Interactive System Visualization tab with draggable entity layout and relation tooltips (React Flow + Dagre).
- **Zed Terminal** — Run constrained `zed` CLI commands (schema/relationship/permission subcommands) against the connected instance via `/api/spicedb/terminal`.
- **Theming system** — `saffron` and `authzed` themes with light/dark color modes. Build-time theme generation (`prebuild`/`generate-themes` scripts produce `styles/generated-themes.css` and `lib/generated/themes.ts` from `themes/*/theme.json`).
- **New API endpoints:** `/api/spicedb/terminal`, `/api/spicedb/namespace-count`, `/api/spicedb/chat`, `/api/spicedb/chat-stream`, `/api/spicedb/assistant-status`.
- **Permission Decision Tree visualization** on the Check page; bulk permission checks consolidated into the Check page.

### Changed
- **Core stack upgrades:** Next.js → 15.3.3, React → 19.2.4, Tailwind CSS → 4, TypeScript → 5.9.2.
- **Documentation restructured:** Lean README (features + quick start) plus focused guides under `/doc` (installation, configuration, usage, api, development, troubleshooting), all synced to the actual implementation.
- **Configuration expanded:** Documented environment variables including `SPICEDB_TOKEN`, `SPICEDB_VERSION_ENDPOINT`, `AUTHZED_MCP_URL`, `NEXT_DIST_DIR`, plus Copilot token priority order and smart `SPICEDB_INSECURE` defaults.

### Removed
- **Standalone Permissions page** — Bulk-check functionality moved to the Check page. All authorization testing workflows now consolidated under the Check page.
