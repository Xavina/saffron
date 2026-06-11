# Configuration Guide

[← Back to README](../README.md)

## Environment Variables

Create a `.env.local` file in the root directory. The default values are:

```bash
SPICEDB_ENDPOINT=localhost:50051
SPICEDB_PRESHARED_KEY=saffron-dev-key
SPICEDB_INSECURE=true
```

> **Note:** If you do not set these, the backend will fall back to defaults (`localhost:50051` and `somerandomkeyhere`). Always use `.env.local` for local development.

## Assistant Configuration

The Assistant page uses the GitHub Copilot SDK on the backend and calls the same SpiceDB server-side tools as the rest of the app.

Enable the feature for both the UI and the API routes:

```bash
ENABLE_ASSISTANT=true
```

If the flag is unset or set to `false`, the Assistant navigation entry stays hidden and the Assistant page and API routes remain unavailable.

Set Copilot authentication with one of these environment variables:

```bash
COPILOT_GITHUB_TOKEN=...
# or
GITHUB_TOKEN=...
# or
GH_TOKEN=...
```

Optionally pin a model with `COPILOT_MODEL` or `GITHUB_COPILOT_MODEL`. If neither is set, the assistant uses the host default Copilot model.

For local SpiceDB development, `.env.local` should look like:

```bash
SPICEDB_ENDPOINT=localhost:50051
SPICEDB_PRESHARED_KEY=test-key
SPICEDB_INSECURE=true
```

For a hosted SpiceDB instance, use the hosted gRPC endpoint and disable insecure mode:

```bash
SPICEDB_ENDPOINT=https://spicedb.grpc.mcp.test.mimics.cloud:443
SPICEDB_PRESHARED_KEY=authzed
SPICEDB_INSECURE=false
```

## UI Themes

The UI now uses theme tokens. The active theme is set on the root element with:

```html
<html data-theme="saffron|authzed" data-color-mode="light|dark">
```

Theme values live in `styles/globals.css` under:

- `:root[data-theme="saffron"][data-color-mode="light"]`
- `:root[data-theme="saffron"][data-color-mode="dark"]`
- `:root[data-theme="authzed"][data-color-mode="light"]`
- `:root[data-theme="authzed"][data-color-mode="dark"]`

Preview `authzed` instantly in browser with `?theme=authzed` (for example: `http://localhost:7777/dashboard?theme=authzed`).  
The selected theme persists in localStorage under `saffron.ui.theme`.

## Docker Compose Services

The `docker-compose.yml` defines three services:

- **postgres** - PostgreSQL database (SpiceDB's datastore) on internal network
- **spicedb** - Authorization service
  - gRPC API: `localhost:50051`
- **saffron** - Next.js UI application on `localhost:7777`

All services share a `saffron-network` for internal communication.

## Mock Data

The initialization scripts (`init-spicedb.sh` / `init-spicedb.ps1`) load a sample organizational structure:

**Users:**
- `ceo`, `cto`, `an_eng_director`, `an_eng_manager`, `an_engineer`
- `it_admin`, `an_external_user`, `a_villain`

**Groups (nested hierarchy):**
- `csuite` → `engineering` → `applications` → `productname`

**Resources:**
- `promserver` - Managed by productname team, viewed by engineering
- `jira` - Managed by engineering managers, viewed by all engineering

**Organization:**
- `org1` - Contains all groups and resources
