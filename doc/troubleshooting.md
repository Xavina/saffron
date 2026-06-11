# Troubleshooting Guide

[← Back to README](../README.md)

## Port 7777 already in use

The development server hard-codes port 7777. If another process is using this port:

```bash
# Find and stop the process using port 7777
# Windows (PowerShell):
Get-Process -Id (Get-NetTCPConnection -LocalPort 7777).OwningProcess | Stop-Process

# Linux/Mac:
lsof -ti:7777 | xargs kill
```

## gRPC health check timeouts

The health check endpoint (`/api/spicedb/health`) may show transient timeouts (~1500ms/2100ms). This is usually harmless and resolves after a few seconds. If persistent, check SpiceDB logs:

```bash
docker-compose logs spicedb
```

## Namespace count returns approximate data

The `/api/spicedb/namespace-count` endpoint has aggressive timeouts (120s total, 10s per page, 3 retries) and may return approximate or partial data on timeout. This is expected behavior for large datasets.

## Theme generation warnings

The `prebuild` script generates themes from `themes/*/theme.json`. Missing or malformed theme files produce warnings but do not fail the build. Check `themes/` directory structure if themes don't appear correctly.

## WSL build directory

On WSL, the build output directory is automatically set to `.next-wsl` to avoid filesystem performance issues. This is configured via `NEXT_DIST_DIR` in `next.config.mjs`.

## Assistant authentication failures

**Missing or invalid token:**
- Verify `COPILOT_GITHUB_TOKEN`, `GITHUB_TOKEN`, or `GH_TOKEN` is set in `.env.local`
- Check token has required scopes (typically `read:user` and Copilot access)

**Rate limits:**
- Copilot API rate limits may cause temporary failures
- Wait a few minutes and retry

**404 errors:**
- Ensure `ENABLE_ASSISTANT=true` is set in `.env.local`
- Restart the dev server after changing environment variables

## SpiceDB not responding

If the initialization script hangs or SpiceDB isn't responding:

1. Check if SpiceDB migrations have been run:
   ```bash
   docker-compose logs spicedb | grep -i migrate
   ```

2. If you see "datastore is not migrated" errors, run migrations:
   ```bash
   docker-compose exec spicedb spicedb datastore migrate head --datastore-engine postgres --datastore-conn-uri "postgres://spicedb:spicedb@postgres:5432/spicedb?sslmode=disable"
   ```

3. Restart SpiceDB after migration:
   ```bash
   docker-compose restart spicedb
   ```

## Fresh start

To completely reset everything:
```bash
docker-compose down -v
docker-compose up -d
# Run migrations again
docker-compose exec spicedb spicedb datastore migrate head --datastore-engine postgres --datastore-conn-uri "postgres://spicedb:spicedb@postgres:5432/spicedb?sslmode=disable"
# Initialize data
./init-spicedb.sh
```
