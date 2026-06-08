# Danny — History

## Core Context

- **Project:** A Next.js admin UI for SpiceDB that manages schemas, relationships, and permission checks via a gRPC backend proxy.
- **Role:** Lead
- **Joined:** 2026-04-02T15:36:02.416Z

## Learnings

<!-- Append learnings below -->
- 2026-04-29: For issue #10, the first shipped chat slice should stay deterministic and reuse existing SpiceDB API routes as the tool surface; broader natural-language behavior, if added later, should orchestrate over that layer instead of replacing it.
- 2026-04-30: Designed auto-discoverable theme system. Schema: `themes/{name}/theme.json` with `displayName`, `logo` (relative path), and `colors.light`/`colors.dark` flat token maps (prefix-stripped). Root `themes.config.json` sets server default. Key files: `themes/saffron/theme.json`, `themes/materialise/theme.json`, `themes.config.json`. Trade-off: mandatory light+dark over optional dark — prevents partial theme bugs.
