# Installation Guide

[← Back to README](../README.md)

## Prerequisites

- Node.js 18+
- Docker & Docker Compose (for containerized setup)

## Quick Start

### Option 1: Docker Compose (Recommended)

The easiest way to get started with both SpiceDB and Saffron:

1. **Clone and install**

   ```bash
   git clone https://github.com/dreaminhex/saffron.git
   cd saffron
   npm install
   ```

2. **Enable full stack in docker-compose.yml**

   The default `docker-compose.yml` only runs the Saffron UI. To run PostgreSQL and SpiceDB as well:
   - Open `docker-compose.yml`
   - Uncomment the `postgres` and `spicedb` service definitions
   - Uncomment the `depends_on` section in the `saffron` service

3. **Start everything with Docker Compose**

   ```bash
   docker-compose up -d
   ```

   This starts:
   - PostgreSQL (SpiceDB's datastore)
   - SpiceDB (authorization service)
   - Saffron UI

4. **Run database migrations (first time only)**

   ```bash
   docker-compose exec spicedb spicedb datastore migrate head --datastore-engine postgres --datastore-conn-uri "postgres://spicedb:spicedb@postgres:5432/spicedb?sslmode=disable"
   ```

5. **Initialize with mock data**

   **Windows (PowerShell):**
   ```powershell
   .\init-spicedb.ps1
   ```

   **Linux/Mac/WSL:**
   ```bash
   chmod +x init-spicedb.sh
   ./init-spicedb.sh
   ```

6. **Access the application**

   Open [http://localhost:7777](http://localhost:7777)

### Option 2: Local Development

For development, run SpiceDB in Docker but Saffron locally:

1. **Clone and install**

   ```bash
   git clone https://github.com/dreaminhex/saffron.git
   cd saffron
   npm install
   ```

2. **Enable SpiceDB services in docker-compose.yml**

   - Open `docker-compose.yml`
   - Uncomment the `postgres` and `spicedb` service definitions

3. **Start only SpiceDB services**

   ```bash
   docker-compose up -d postgres spicedb
   ```

4. **Run database migrations (first time only)**

   ```bash
   docker-compose exec spicedb spicedb datastore migrate head --datastore-engine postgres --datastore-conn-uri "postgres://spicedb:spicedb@postgres:5432/spicedb?sslmode=disable"
   ```

5. **Initialize SpiceDB with mock data**

   **Windows (PowerShell):**
   ```powershell
   .\init-spicedb.ps1
   ```

   **Linux/Mac/WSL:**
   ```bash
   chmod +x init-spicedb.sh
   ./init-spicedb.sh
   ```

6. **Run Saffron locally**

   ```bash
   npm run dev
   ```

   The `.env.local` file is already configured to connect to the correct SpiceDB gRPC endpoint. If you change ports or run SpiceDB elsewhere, update this file accordingly.

   Open [http://localhost:7777](http://localhost:7777)

### Option 3: Manual SpiceDB Setup

If you want to run SpiceDB without Docker Compose (requires manual PostgreSQL setup):

1. **Start PostgreSQL**

   ```bash
   docker run -d --name spicedb-postgres \
     -e POSTGRES_USER=spicedb \
     -e POSTGRES_PASSWORD=spicedb \
     -e POSTGRES_DB=spicedb \
     -p 5432:5432 \
     postgres:15-alpine
   ```

2. **Start SpiceDB with gRPC API**

   ```bash
    docker run -d --name spicedb \
       -p 50051:50051 \
     -e SPICEDB_GRPC_PRESHARED_KEY="saffron-dev-key" \
     -e SPICEDB_DATASTORE_ENGINE=postgres \
     -e SPICEDB_DATASTORE_CONN_URI="postgres://spicedb:spicedb@host.docker.internal:5432/spicedb?sslmode=disable" \
       authzed/spicedb serve
   ```

3. **Run database migrations**

   ```bash
   docker exec spicedb spicedb datastore migrate head \
     --datastore-engine postgres \
     --datastore-conn-uri "postgres://spicedb:spicedb@host.docker.internal:5432/spicedb?sslmode=disable"
   ```

4. **Initialize with mock data**

   ```bash
   chmod +x init-spicedb.sh
   ./init-spicedb.sh
   ```

5. **Configure environment**

   Create `.env.local`:
   ```bash
   # gRPC API (used by all Saffron backend routes)
   SPICEDB_ENDPOINT=localhost:50051
   SPICEDB_PRESHARED_KEY=saffron-dev-key
   SPICEDB_INSECURE=true
   ```

6. **Start the UI**

   ```bash
   npm run dev
   ```

   Open [http://localhost:7777](http://localhost:7777)
