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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
