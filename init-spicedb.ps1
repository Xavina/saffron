# Initialize SpiceDB with schema and mock data over gRPC
# Usage: .\init-spicedb.ps1

$ErrorActionPreference = "Stop"

if (-not $env:SPICEDB_ENDPOINT) {
    $env:SPICEDB_ENDPOINT = "localhost:50051"
}
if (-not $env:SPICEDB_PRESHARED_KEY) {
    $env:SPICEDB_PRESHARED_KEY = "saffron-dev-key"
}
if (-not $env:SPICEDB_INSECURE) {
    $env:SPICEDB_INSECURE = "true"
}

$scriptPath = Join-Path $PSScriptRoot "scripts/init-spicedb-grpc.js"
node $scriptPath
