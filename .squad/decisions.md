# Squad Decisions

## Active Decisions

- 2026-04-29: Issue #10 first slice ships as a deterministic assistant over existing SpiceDB APIs instead of introducing an LLM or external agent runtime.
	- Owner: Danny
	- Context: The issue needs schema guidance plus permission and relationship help, and the fastest safe path is to build on the current API surface.
	- Trade-offs: This avoids extra infrastructure, prompt-safety expansion, and secret-management overhead, but narrows the UX to operational, summary-driven responses.
	- Follow-up: If broader natural-language coverage is needed later, keep this deterministic route as the tool layer and add orchestration on top.
- 2026-04-29: The SpiceDB chat route runs on a GitHub Copilot SDK session that exposes the existing SpiceDB operations as backend tools.
	- Owner: Linus
	- Context: `pages/api/spicedb/chat.js` needed more flexible natural-language handling while preserving the current frontend contract and the existing SpiceDB service boundary.
	- Constraints: Allow only the custom backend tools, fail clearly when Copilot auth or runtime startup is unavailable, and keep SpiceDB access behind the existing server boundary.
	- Validation: Live POSTs to `/api/spicedb/chat` returned HTTP 200 with a Copilot-generated schema summary, and file diagnostics were clean.
- 2026-04-29: Reuse the GitHub Copilot SDK session id as the assistant conversation identifier across chat and streaming requests.
	- Owner: Linus
	- Context: The backend and assistant UI both needed a stable conversation id so follow-up prompts could reuse Copilot session memory without adding a separate transcript store.
	- Constraints: Accept either `sessionId` or `conversationId`, return the active id through both JSON and streaming responses, and replace stale ids with a fresh active session instead of failing the request.
	- Validation: Two-turn memory validation returned BANANA on both turns when the same session id was reused.
- 2026-04-29: Keep `POST /api/spicedb/chat` as the existing JSON surface and add two narrow companion routes instead of overloading the original contract.
	- Owner: Linus
	- Context: The assistant page already targets separate status and streaming endpoints; dedicated routes avoid breaking existing callers expecting `{ reply }` JSON from the original chat route.
	- Routes: `GET /api/spicedb/assistant-status` for readiness, auth/runtime state, and model metadata; `POST /api/spicedb/chat/stream` for browser-consumable chunked text streaming.
	- Constraints: Status should actively probe Copilot runtime and return 503 with clear message when auth or setup is missing; stream failures should fail fast before writing when possible, and close clearly if runtime failure occurs after streaming starts.
- 2026-04-08: Treat lookup-subject results in the Check UI as nested subject references, reading `subject.object.objectType` and `subject.object.objectId` with fallback to flattened fields.
	- Owner: Rusty
	- Context: The lookup-subjects API returns subjects in the same nested shape used elsewhere in the app; previous UI assumed flattened shape, rendering as just `:`.
	- Resolution: Updated Check UI to correctly read nested object structure, matching API response shape.
- 2026-04-29: Replace mocked Single Check and Bulk Check flows on the Permissions page with real `POST /api/spicedb/check` calls.
	- Owner: Rusty
	- Context: Permissions page needed integration with live SpiceDB checks instead of mocked responses.
	- Approach: Reused Check page's `permissionship` normalization rules so numeric and string enum responses render consistently across both pages.
	- Preservation: Kept existing Permissions page structure and local history UX intact by adapting API responses into the page's existing result/history shape.
- 2026-06-11: Move Bulk Check from Permissions page to Check page.
	- Owner: Rusty
	- Context: Bulk checking is conceptually closer to other check operations (Permission Check, Expand Permission, Lookup Subjects) than to the permissions overview.
	- Implementation: Ported BulkCheckForm type, bulkCheckForm state, and performBulkCheck handler to Check page; added "Bulk Check" tab positioned immediately after "Permission Check" tab; simplified Permissions page to single-check-only workflow.
	- Validation: Build completed with zero TypeScript errors; no linting issues.
	- Trade-offs: Permissions page now has only one function; Check page navigation expanded from 3 to 4 tabs.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
