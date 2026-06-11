# Development Guide

[← Back to README](../README.md)

## Tech Stack

- **Frontend**: Next.js 15.3.3, React 19.2.4, Tailwind CSS 4, TypeScript 5.9.2
- **Backend**: Next.js API routes
- **Database**: SpiceDB (via gRPC API, using @authzed/authzed-node 1.6.1)
- **Editor**: CodeMirror (@uiw/react-codemirror + @codemirror/lang-javascript + @codemirror/language)
- **Visualization**: React Flow (@xyflow/react 12.10.2) with Dagre layout (@dagrejs/dagre 3.0.0)
- **Assistant**: GitHub Copilot SDK (@github/copilot-sdk 0.3.0) + AuthZed MCP (@modelcontextprotocol/client 2.0.0-alpha.2)
- **Rendering**: react-markdown 10.1.0 (with remark-gfm, remark-breaks, react-syntax-highlighter)
- **Validation**: Zod 4.3.6
- **Icons**: Tabler Icons React (@tabler/icons-react 3.43.0)

## Local Development Commands

```bash
npm run dev               # Start development server on port 7777
npm run prebuild          # Generate themes (runs automatically before build)
npm run build             # Build for production
npm start                 # Start production server
npm run lint              # Run Next.js linter
npm run generate-themes   # Manually generate theme CSS/TypeScript from themes/*/theme.json
```

**Theme Generation:**  
The `prebuild` and `generate-themes` scripts read `themes/*/theme.json` files and generate:
- `styles/generated-themes.css` - CSS custom properties for each theme
- `lib/generated/themes.ts` - TypeScript theme metadata

Theme generation runs automatically before `npm run build` via the `prebuild` script. On WSL systems, the build output directory is `.next-wsl` instead of `.next`.

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

**When Saffron runs in Docker:**
- SpiceDB gRPC: `spicedb:50051` (internal network)

**Note:** All core operations use gRPC (port 50051) exclusively. Port 8443 is only used as an optional HTTP version endpoint and is not required for normal operations.
