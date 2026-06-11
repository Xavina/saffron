# API Endpoints

[← Back to README](../README.md)

All API routes are under `pages/api/spicedb/` and use gRPC to communicate with SpiceDB.

## Core Operations

- **`GET /api/spicedb/stats`** - Dashboard statistics; relationship counts per namespace; schema hash
- **`GET /api/spicedb/health`** - gRPC connection health probe
- **`GET /api/spicedb/resources`** - Resource types with relations/permissions from schema

## Schema & Relationships

- **`GET /api/spicedb/schema`** - Returns current schema text
- **`POST /api/spicedb/schema`** - Write schema; accepts raw schema string OR JSON object body (converts JSON→string)
- **`GET /api/spicedb/relationships`** - Paginated list of relationships with optional filters
- **`POST /api/spicedb/relationships`** - Create OR delete relationships based on body fields:
  - **Create**: requires `resource`, `relation`, `subject`
  - **Delete**: requires `resourceType`, `resourceId`, `subjectType`, `subjectId`
  - Note: There is no DELETE method; both operations use POST
- **`GET /api/spicedb/namespace-count`** - Count relationships/subjects per namespace (pagination + retry; may return approximate/partial data on timeout)

## Authorization Testing

- **`POST /api/spicedb/check`** - Permission check with optional context and tracing
- **`POST /api/spicedb/expand`** - Permission tree expansion
- **`POST /api/spicedb/lookup-subjects`** - Find subjects with a given permission

## Terminal

- **`POST /api/spicedb/terminal`** - Execute constrained `zed` CLI commands (schema/relationship/permission subcommands only)

## Assistant

The following endpoints are gated by `ENABLE_ASSISTANT` and return 404 when disabled:

- **`GET /api/spicedb/assistant-status`** - Assistant configuration and readiness status
- **`POST /api/spicedb/chat`** - Send chat message to assistant; returns JSON response
- **`POST /api/spicedb/chat-stream`** - Streaming assistant response with metadata in response headers
