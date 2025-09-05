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

- Node.js 16+
- Running SpiceDB instance (HTTP API enabled)

## Quick Start

1. **Clone and install**

   ```bash
   git clone https://github.com/dreaminhex/saffron.git
   cd saffron
   npm install
   ```

2. **Start SpiceDB with HTTP API**

   ```bash
   docker run -d --rm -p 50051:50051 -p 8443:8443 \
     authzed/spicedb serve \
     --grpc-preshared-key "your-token-here" \
     --http-enabled
   ```

3. **Configure environment**

   ```bash
   # Create .env.local
   SPICEDB_URL=http://localhost:8443
   SPICEDB_TOKEN=your-token-here
   ```

4. **Start the UI**

   ```bash
   npm run dev
   ```

   Open [http://localhost:7777](http://localhost:7777)

### Run with Docker

1. **Build the Docker image**

```bash
docker build -t saffron .
```

2. **Configure environment variables**

Update the .env file under `./examples/spicedb` with your desired values.

3. **Run the container**

```bash
docker-compose up --build
```

4. **Access the application**

Open your browser and navigate to `http://localhost:7777`

## Configuration

Environment variables in `.env.local`:

```bash
SPICEDB_URL=http://localhost:8443    # SpiceDB HTTP API endpoint
SPICEDB_TOKEN=your-token-here        # Pre-shared key for authentication
SAFFRON_PORT=7777
```

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

## Development

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
```

## License

GPL v3

## Links

- [SpiceDB Documentation](https://authzed.com/docs)
- [SpiceDB GitHub](https://github.com/authzed/spicedb)
- [Next.js Documentation](https://nextjs.org/docs)
