
# The SpiceDB UI

A modern web interface for managing SpiceDB authorization systems. Built with Next.js and Tailwind CSS.

**This codebase was forked from [Saffron](https://github.com/dreaminhex/saffron) and enhaced with new features.**

## Features

1. **Dashboard** - Real-time overview of your SpiceDB instance with stats and activity
1. **gRPC Integration** - All backend operations use SpiceDB's gRPC API (not HTTP endpoints)
1. **Schema Management** - Visual and text-based schema editor with validation
1. **Schema Graph Visualization** - Interactive System Visualization tab with draggable entity layout and relation tooltips
1. **Relationship Management** - CRUD operations with smart dropdowns and search
1. **Authorization Testing** - Permission checks, expansions, subject lookups, and check evaluations shown as a Decision Tree
1. **Zed Terminal** - Run `zed` commands against the connected SpiceDB instance

## Quick Start

### Docker Compose (Recommended)

The easiest way to get started:

```bash
git clone https://github.com/dreaminhex/saffron.git
cd saffron
npm install
docker-compose up -d
docker-compose exec spicedb spicedb datastore migrate head --datastore-engine postgres --datastore-conn-uri "postgres://spicedb:spicedb@postgres:5432/spicedb?sslmode=disable"
# On Windows: .\init-spicedb.ps1 | On Linux/Mac: chmod +x init-spicedb.sh && ./init-spicedb.sh
```

Open [http://localhost:7777](http://localhost:7777)

For other installation options (Local Development, Manual SpiceDB), see [Installation Guide](doc/installation.md).

## Documentation

- **[Installation Guide](doc/installation.md)** - Detailed setup instructions for Docker Compose, local development, and manual SpiceDB configuration
- **[Configuration Guide](doc/configuration.md)** - Environment variables, Assistant setup, UI themes, Docker services, and mock data
- **[Usage Guide](doc/usage.md)** - How to use the UI: Schema Management, Relationships, Authorization Testing, and Terminal
- **[API Endpoints](doc/api.md)** - Reference for all backend API routes
- **[Development Guide](doc/development.md)** - Tech stack, development commands, Docker commands, and service connection details
- **[Troubleshooting Guide](doc/troubleshooting.md)** - Common issues and solutions

## License

GPL v3

## Links

- [SpiceDB Documentation](https://authzed.com/docs)
- [SpiceDB GitHub](https://github.com/authzed/spicedb)
- [Next.js Documentation](https://nextjs.org/docs)
