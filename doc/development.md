# Development Guide

[← Back to README](../README.md)

## Tech Stack

- **Frontend**: Next.js 13+, React, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: SpiceDB (via gRPC API)
- **Styling**: Tailwind CSS with custom components
- **Icons**: Tabler

## Local Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
```

## Docker Commands

```bash
# Start all services (Saffron, SpiceDB, PostgreSQL)
docker-compose up -d

# Start only SpiceDB services (for local Saffron development)
docker-compose up -d postgres spicedb

# View logs
docker-compose logs -f saffron
docker-compose logs -f spicedb

# Stop services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Rebuild Saffron container
docker-compose up -d --build saffron
```

## Connecting to Services

**When Saffron runs locally:**
- SpiceDB gRPC: `localhost:50051`
- SpiceDB HTTP: `http://localhost:8443`

**When Saffron runs in Docker:**
- SpiceDB gRPC: `spicedb:50051` (internal network)
- SpiceDB HTTP: `http://spicedb:8443` (internal network)
