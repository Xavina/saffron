#!/bin/bash

# Initialize SpiceDB with schema and mock data over gRPC.
# Usage: ./init-spicedb.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export SPICEDB_ENDPOINT="${SPICEDB_ENDPOINT:-localhost:50051}"
export SPICEDB_PRESHARED_KEY="${SPICEDB_PRESHARED_KEY:-saffron-dev-key}"
export SPICEDB_INSECURE="${SPICEDB_INSECURE:-true}"

node "${SCRIPT_DIR}/scripts/init-spicedb-grpc.js"
