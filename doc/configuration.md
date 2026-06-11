# Configuration Guide

[← Back to README](../README.md)

## Environment Variables

Create a `.env.local` file in the root directory. The default values are:

```bash
SPICEDB_ENDPOINT=localhost:50051       # Default: localhost:50051
SPICEDB_PRESHARED_KEY=saffron-dev-key  # Alternative: SPICEDB_TOKEN
SPICEDB_INSECURE=true                  # Smart default: true for localhost/spicedb, false otherwise
```

**SpiceDB Connection:**
- `SPICEDB_ENDPOINT` - gRPC endpoint (default: `localhost:50051`)
- `SPICEDB_PRESHARED_KEY` or `SPICEDB_TOKEN` - Authentication token (fallback: `somerandomkeyhere`)
- `SPICEDB_INSECURE` - Use insecure gRPC connection (smart default: `true` for `localhost`/`spicedb` hostnames, `false` otherwise)
- `SPICEDB_VERSION_ENDPOINT` - Optional explicit HTTP version endpoint (rarely needed)

**Build Configuration:**
- `NEXT_DIST_DIR` - Custom build directory (defaults to `.next`; automatically set to `.next-wsl` on WSL)

> **Note:** If you do not set these, the backend will fall back to defaults (`localhost:50051` and `somerandomkeyhere`). Always use `.env.local` for local development.

## Assistant Configuration

The Assistant page uses the GitHub Copilot SDK on the backend and provides access to:
- SpiceDB tools: `check`, `expand`, `lookup-subjects`, schema read, relationships read
- AuthZed MCP documentation tools (via MCP server)

**Enable the feature:**

```bash
ENABLE_ASSISTANT=true
```

If the flag is unset or set to `false`, the Assistant navigation entry stays hidden and the Assistant page and API routes return 404.

**Set Copilot authentication** (priority order):

```bash
COPILOT_GITHUB_TOKEN=...
# or
GITHUB_TOKEN=...
# or
GH_TOKEN=...
```

The system checks tokens in this order: `COPILOT_GITHUB_TOKEN` → `GITHUB_TOKEN` → `GH_TOKEN`.

**Optional configuration:**

```bash
COPILOT_MODEL=...              # or GITHUB_COPILOT_MODEL (pin a specific model)
AUTHZED_MCP_URL=...            # Default: https://mcp.authzed.com
```

**Conversation persistence:**  
Session/conversation IDs are stored in browser localStorage under `saffron.spicedb.assistant.conversationId`.

For local SpiceDB development, `.env.local` should look like:

```bash
SPICEDB_ENDPOINT=localhost:50051
SPICEDB_PRESHARED_KEY=test-key
SPICEDB_INSECURE=true
```

For a hosted SpiceDB instance, use the hosted gRPC endpoint and disable insecure mode:

```bash
SPICEDB_ENDPOINT=https://<your-spicedb-host>:443
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

The `docker-compose.yml` file defines three services, but **by default only the Saffron UI runs**:

- **postgres** - PostgreSQL database (SpiceDB's datastore) - **COMMENTED OUT by default**
- **spicedb** - Authorization service on `localhost:50051` (gRPC) - **COMMENTED OUT by default**
- **saffron** - Next.js UI application on `localhost:7777` - **ACTIVE by default**

**To run the full stack with Docker Compose:**
1. Uncomment the `postgres` and `spicedb` services in `docker-compose.yml`
2. Uncomment the `depends_on` section in the `saffron` service
3. Run `docker-compose up -d`
4. Run migrations and initialize data as described in the Installation Guide

**Alternative:** Run SpiceDB separately (see Manual SpiceDB Setup in Installation Guide) and point `SPICEDB_ENDPOINT` at it in `.env.local`.

All services share a `saffron-network` for internal communication when uncommented.

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
