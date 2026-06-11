# Troubleshooting Guide

[← Back to README](../README.md)

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
