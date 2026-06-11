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
- Dashboard page title was using `text-white` class instead of `text-gray-900`, which made it visually inconsistent with all other page titles (Check, Schema, Relationships, Permissions, Assistant, Terminal). Fixed by changing the h2 className to match the standard pattern across the app.
- System Visualization in `components/SchemaGraph.tsx` uses localStorage with key `saffron.schema-graph.layouts.v1` to persist node positions per schema signature (sorted definition names joined with `|`). The implementation correctly reads from storage on mount (`useEffect` line 470–474), applies stored positions via `applyStoredLayout` (line 227–246), and writes on `onNodeDragStop` (line 517–520). Persistence works correctly **within the same browser profile/origin**. Opening a brand new browser or different profile triggers localStorage isolation; no positions restore because the new environment has empty storage. This matches standard localStorage behavior: same-origin policy means layouts persist for the same browser/profile combo, but not across machines, profiles, or incognito sessions. User expectation of "every time a new browser is open" exceeds localStorage's capability if they mean different profiles or machines. README line 325 claims layouts "are remembered when you return," which is true for same-profile returns but silent about cross-profile/cross-machine limits. Key files: `components/SchemaGraph.tsx`, `pages/schema.tsx`, README.md line 325.
- Moved Bulk Check feature from Permissions page to Check page. Check page tab structure now uses `["check", "bulk", "expand", "lookup"]` array with bulk positioned immediately after check. The bulk tab shares the same API endpoint (`/api/spicedb/check`) and result handling patterns as the single check, using `Promise.all()` to check multiple subjects in parallel. Permissions page simplified to single-check only, removing all bulk-related state, forms, and handlers. Both files compile cleanly and build succeeds. Tab navigation pattern in check.tsx maps tab IDs to labels via inline ternary expressions. Key files: `pages/check.tsx`, `pages/permissions.tsx`.
