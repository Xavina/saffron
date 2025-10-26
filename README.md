# SpiceDB UI

A modern web interface for managing SpiceDB authorization systems. Built with Next.js and Tailwind CSS.

## Screenshots

## Features

1. **Dashboard** - Real-time overview of your SpiceDB instance with stats and activity
1. **Schema Management** - Visual and text-based schema editor with validation
1. **Relationship Management** - CRUD operations with smart dropdowns and search
1. **Authorization Testing** - Permission checks, expansions, and subject lookups
1. **Zed Terminal** - Run `zed` commands against the connected SpiceDB instance

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

2. **Start everything with Docker Compose**

   ```bash
   docker-compose up -d
   ```

   This starts:
   - PostgreSQL (SpiceDB's datastore)
   - SpiceDB (authorization service)
   - Saffron UI

3. **Run database migrations (first time only)**

   ```bash
   docker-compose exec spicedb spicedb datastore migrate head --datastore-engine postgres --datastore-conn-uri "postgres://spicedb:spicedb@postgres:5432/spicedb?sslmode=disable"
   ```

4. **Initialize with mock data**

   **Windows (PowerShell):**
   ```powershell
   .\init-spicedb.ps1
   ```

   **Linux/Mac/WSL:**
   ```bash
   chmod +x init-spicedb.sh
   ./init-spicedb.sh
   ```

5. **Access the application**

   Open [http://localhost:7777](http://localhost:7777)

### Option 2: Local Development

For development, run SpiceDB in Docker but Saffron locally:

1. **Clone and install**

   ```bash
   git clone https://github.com/dreaminhex/saffron.git
   cd saffron
   npm install
   ```

2. **Start only SpiceDB services**

   ```bash
   docker-compose up -d postgres spicedb
   ```

3. **Run database migrations (first time only)**

   ```bash
   docker-compose exec spicedb spicedb datastore migrate head --datastore-engine postgres --datastore-conn-uri "postgres://spicedb:spicedb@postgres:5432/spicedb?sslmode=disable"
   ```

4. **Initialize SpiceDB with mock data**

   **Windows (PowerShell):**
   ```powershell
   .\init-spicedb.ps1
   ```

   **Linux/Mac/WSL:**
   ```bash
   chmod +x init-spicedb.sh
   ./init-spicedb.sh
   ```

5. **Run Saffron locally**

   ```bash
   npm run dev
   ```

   The `.env.local` file is already configured to connect to `localhost:50051`

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

2. **Start SpiceDB with HTTP API**

   ```bash
   docker run -d --name spicedb \
     -p 50051:50051 -p 8443:8443 \
     -e SPICEDB_GRPC_PRESHARED_KEY="saffron-dev-key" \
     -e SPICEDB_DATASTORE_ENGINE=postgres \
     -e SPICEDB_DATASTORE_CONN_URI="postgres://spicedb:spicedb@host.docker.internal:5432/spicedb?sslmode=disable" \
     authzed/spicedb serve --http-enabled
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
   # HTTP API (used by UI for schema, relationships, permissions)
   SPICEDB_URL=http://localhost:8443
   SPICEDB_TOKEN=saffron-dev-key

   # gRPC API (used by Terminal/Zed CLI)
   SPICEDB_ENDPOINT=localhost:50051
   SPICEDB_PRESHARED_KEY=saffron-dev-key
   SPICEDB_INSECURE=true
   ```

6. **Start the UI**

   ```bash
   npm run dev
   ```

   Open [http://localhost:7777](http://localhost:7777)

## Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# HTTP API (used by UI for schema, relationships, permissions)
SPICEDB_URL=http://localhost:8443
SPICEDB_TOKEN=saffron-dev-key

# gRPC API (used by Terminal/Zed CLI)
SPICEDB_ENDPOINT=localhost:50051
SPICEDB_PRESHARED_KEY=saffron-dev-key
SPICEDB_INSECURE=true
```

### Docker Compose Services

The `docker-compose.yml` defines three services:

- **postgres** - PostgreSQL database (SpiceDB's datastore) on internal network
- **spicedb** - Authorization service
  - gRPC API: `localhost:50051`
  - HTTP API: `localhost:8443`
- **saffron** - Next.js UI application on `localhost:7777`

All services share a `saffron-network` for internal communication.

### Mock Data

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

## Usage

### 1. Schema Management

- Navigate to the **Schema** page
- A default schema has already been loaded - you can edit this from `./examples/spicedb/data/schema.yml`
- Edit your authorization model using SpiceDB schema language
- Use the visual view to see parsed namespaces, relations, and permissions
- Save changes directly to SpiceDB

### 2. Relationship Management

- Go to the **Relationships** page
- Add relationships using smart dropdowns:
  - **Resource**: Search existing or create new (e.g., `business:acme-corp`)
  - **Relation**: Auto-populated from your schema (e.g., `owner`, `manager`)
  - **Subject**: Manual entry (e.g., `user:alice`)
- View, search, and filter existing relationships

### 3. Authorization Testing

- Use the **Check** page for permission testing:
  - **Permission Check**: Test if a subject has permission on a resource
  - **Expand Permission**: Visualize permission trees
  - **Lookup Subjects**: Find all subjects with a specific permission

### 4. Terminal Usage

- Use the **Terminal** page for executing `zed` queries against the database

## API Endpoints

The UI creates several API routes:

- `GET /api/spicedb/stats` - Dashboard statistics
- `GET /api/spicedb/health` - Connection health check
- `GET /api/spicedb/activity` - Recent activity feed
- `GET /api/spicedb/resources` - Available resources and relations
- `GET|POST /api/spicedb/schema` - Schema management
- `GET|POST|DELETE /api/spicedb/relationships` - Relationship CRUD
- `POST /api/spicedb/check` - Permission checking
- `POST /api/spicedb/expand` - Permission expansion
- `POST /api/spicedb/lookup-subjects` - Subject lookup

## Tech Stack

- **Frontend**: Next.js 13+, React, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: SpiceDB (via HTTP API)
- **Styling**: Tailwind CSS with custom components
- **Icons**: Tabler

## Troubleshooting

### SpiceDB not responding

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

### Fresh start

To completely reset everything:
```bash
docker-compose down -v
docker-compose up -d
# Run migrations again
docker-compose exec spicedb spicedb datastore migrate head --datastore-engine postgres --datastore-conn-uri "postgres://spicedb:spicedb@postgres:5432/spicedb?sslmode=disable"
# Initialize data
./init-spicedb.sh
```

## Development

### Local Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
```

### Docker Commands

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

### Connecting to Services

**When Saffron runs locally:**
- SpiceDB gRPC: `localhost:50051`
- SpiceDB HTTP: `http://localhost:8443`

**When Saffron runs in Docker:**
- SpiceDB gRPC: `spicedb:50051` (internal network)
- SpiceDB HTTP: `http://spicedb:8443` (internal network)

## License

GPL v3

## Links

- [SpiceDB Documentation](https://authzed.com/docs)
- [SpiceDB GitHub](https://github.com/authzed/spicedb)
- [Next.js Documentation](https://nextjs.org/docs)
