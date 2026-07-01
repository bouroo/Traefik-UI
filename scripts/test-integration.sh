#!/usr/bin/env bash
set -euo pipefail

# Local integration test script for Traefik-UI
# Prerequisites: podman or docker installed
# Usage: ./scripts/test-integration.sh

echo "=== Traefik-UI Integration Tests ==="
echo ""

# Detect runtime
if command -v podman &> /dev/null; then
  RUNTIME="podman"
elif command -v docker &> /dev/null; then
  RUNTIME="docker"
else
  echo "ERROR: Neither podman nor docker found. Please install one."
  exit 1
fi

echo "Using container runtime: $RUNTIME"

# Build the project first
echo ""
echo "Building project..."
bun run build

# Run backend integration tests (these manage their own Traefik container)
echo ""
echo "Running backend integration tests..."
cd packages/backend
bun test tests/integration.test.ts
cd ../..

echo ""
echo "=== Integration tests complete ==="
