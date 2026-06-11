# Usage Guide

[← Back to README](../README.md)

## Assistant

Open the **Assistant** page after setting the Copilot token and SpiceDB connection in `.env.local`.

Verify the backend is ready before using the UI:

```bash
curl http://localhost:7777/api/spicedb/assistant-status
curl -X POST http://localhost:7777/api/spicedb/chat \
   -H 'Content-Type: application/json' \
   -d '{"message":"Explain the schema in one short paragraph."}'
curl -N -X POST http://localhost:7777/api/spicedb/chat-stream \
   -H 'Content-Type: application/json' \
   -d '{"message":"Explain the schema in one short paragraph."}'
```

These endpoints should return a healthy assistant status, a normal JSON response, and a streaming response respectively.

## Schema Management

- Navigate to the **Schema** page
- A default schema has already been loaded - you can edit this from `./examples/spicedb/data/schema.yml`
- Edit your authorization model using SpiceDB schema language
- Use the **Flat View** tab to see parsed namespaces, relations, and permissions
- Use the **System Visualization** tab to view your schema as a graph of entities and relations
- Drag entities in the graph to organize the layout; positions are remembered in browser storage (IndexedDB) when you return from the same browser profile
- Relation labels are shown inline with an overflow tooltip for additional relations
- Save changes directly to SpiceDB

## Relationship Management

- Go to the **Relationships** page
- Add relationships using smart dropdowns:
  - **Resource**: Search existing or create new (e.g., `business:acme-corp`)
  - **Relation**: Auto-populated from your schema (e.g., `owner`, `manager`)
  - **Subject**: Manual entry (e.g., `user:alice`)
- View, search, and filter existing relationships

## Authorization Testing

Use the **Check** page for permission testing with the following features:
- **Permission Check**: Test if a subject has permission on a resource
- **Expand Permission**: Visualize permission trees
- **Lookup Subjects**: Find all subjects with a specific permission

### Example Permission Checks (using mock data):

**✅ Should ALLOW:**

1. **CEO can admin org1**
   - Resource: `organization:org1`
   - Permission: `admin`
   - Subject: `user:ceo`

2. **Engineer can view promserver**
   - Resource: `resource:promserver`
   - Permission: `view`
   - Subject: `user:an_engineer`

3. **CTO can manage jira**
   - Resource: `resource:jira`
   - Permission: `manage`
   - Subject: `user:cto`

4. **External user can view promserver**
   - Resource: `resource:promserver`
   - Permission: `view`
   - Subject: `user:an_external_user`

**❌ Should DENY:**

1. **External user cannot manage promserver**
   - Resource: `resource:promserver`
   - Permission: `manage`
   - Subject: `user:an_external_user`

2. **Villain cannot access jira**
   - Resource: `resource:jira`
   - Permission: `view`
   - Subject: `user:a_villain`

3. **Engineer cannot manage jira** (only view)
   - Resource: `resource:jira`
   - Permission: `manage`
   - Subject: `user:an_engineer`

## Terminal Usage

Use the **Terminal** page for executing `zed` queries against SpiceDB:
- Execute constrained `zed` CLI commands (schema/relationship/permission subcommands only)
- View command output directly in the interface
- Test schema and relationship operations in a command-line style interface
