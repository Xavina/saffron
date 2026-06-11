# Danny — History

## Core Context

- **Project:** A Next.js admin UI for SpiceDB that manages schemas, relationships, and permission checks via a gRPC backend proxy.
- **Role:** Lead
- **Joined:** 2026-04-02T15:36:02.416Z

## Learnings

<!-- Append learnings below -->
- 2026-04-29: For issue #10, the first shipped chat slice should stay deterministic and reuse existing SpiceDB API routes as the tool surface; broader natural-language behavior, if added later, should orchestrate over that layer instead of replacing it.
- 2026-04-30: Designed auto-discoverable theme system. Schema: `themes/{name}/theme.json` with `displayName`, `logo` (relative path), and `colors.light`/`colors.dark` flat token maps (prefix-stripped). Root `themes.config.json` sets server default. Key files: `themes/saffron/theme.json`, `themes/materialise/theme.json`, `themes.config.json`. Trade-off: mandatory light+dark over optional dark — prevents partial theme bugs.
- 2026-06-XX: README documentation restructure: split 496-line monolithic README into lean landing page + 6 focused doc files under `/doc`. The lean README now shows only features + quick-start Docker path + documentation index, keeping cognitive load low for new users. All original content preserved verbatim in `doc/installation.md`, `doc/configuration.md`, `doc/usage.md`, `doc/api.md`, `doc/development.md`, `doc/troubleshooting.md` with back-links to README. Trade-off: navigation requires jumping between files vs single-file, but maintainability + discoverability improved for teams growing past 3–4 engineers.
- 2026-06-XX: Quick Start readability improvement: restructured single dense bash block into 5 numbered steps with individual headings and separate code fences. Windows and Linux/Mac init commands now clearly labeled and separated, reducing cognitive friction for users copying/pasting commands by OS.
- 2026-06-XX: Added AI Assistant feature to README Features list and updated Documentation index to mention it. Grounded description in doc/configuration.md and doc/usage.md: AI Assistant powered by GitHub Copilot SDK answers questions about SpiceDB schema and authorization, opt-in via `ENABLE_ASSISTANT` flag.
- 2026-06-11: **1.0.0 Milestone Release** — First stable release of the enhanced fork (user chose 1.0.0 over an initially proposed 2.0.0). Consolidated three quarters of development into a single cohesive release: framework upgrades (Next.js 15, React 19, TypeScript 5.9, Tailwind 4), AI Assistant powered by GitHub Copilot SDK with AuthZed MCP integration, schema graph visualization (React Flow + Dagre), Zed Terminal for CLI access, theming system (saffron + authzed with light/dark modes), lean restructured documentation (README + 6 focused guides under `/doc`), and consolidated authorization testing under the Check page. Rationale: 1.0.0 establishes the first stable, feature-complete baseline of the fork — cleaner than a 2.0.0 jump since no prior 1.x line existed to break against. This version anchors the fork's differentiation from the original SpiceDB admin UI.
