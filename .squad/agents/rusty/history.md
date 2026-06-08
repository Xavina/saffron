# Rusty — History

## Core Context

- **Project:** A Next.js admin UI for SpiceDB that manages schemas, relationships, and permission checks via a gRPC backend proxy.
- **Role:** Frontend Dev
- **Joined:** 2026-04-02T15:36:02.430Z

## Learnings

<!-- Append learnings below -->
- Lookup Subjects results on the Check page come back as nested subject references (`subject.object.objectType/objectId`), so the UI must not assume flattened `objectType/objectId` fields.
- The Permissions page must normalize `permissionship` values the same way as the Check page because SpiceDB responses can arrive as numeric enums or string enum names.
- Assistant messages should only pass through markdown rendering when strong markdown signals are present; otherwise render plain text with preserved line breaks to avoid accidental markdown interpretation.
- Theme system wired to use auto-discovered themes from `lib/generated/themes.ts`, imported CSS from `styles/generated-themes.css`, and accepts optional `configuredTheme` prop in `ThemeProvider` sourced from `themes.config.json` in `_app.tsx`. Existing hardcoded theme blocks remain in `globals.css` until generated file is confirmed live.
- Key files: `lib/theme.ts`, `components/ThemeProvider.tsx`, `pages/_app.tsx`, `styles/globals.css`, `lib/generated/.gitkeep`
