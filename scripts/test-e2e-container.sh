#!/usr/bin/env bash
set -euo pipefail

# E2E test script against containerized Traefik-UI
# Prerequisites: podman compose, bun
# Usage: ./scripts/test-e2e-container.sh

echo "=== Traefik-UI E2E Container Tests ==="

# Check if containers are running
if ! command -v podman &> /dev/null; then
  echo "ERROR: podman not found"
  exit 1
fi

# Start the stack if not running
if ! podman ps --format '{{.Names}}' | grep -q 'traefik-ui'; then
  echo "Starting container stack..."
  podman compose up -d --build
  echo "Waiting for services to be ready..."
  sleep 10
else
  echo "Container stack already running"
fi

# Verify health
echo "Checking health..."
HEALTH=$(curl -sf http://localhost:3000/api/health | jq -r '.status' 2>/dev/null || echo "unreachable")
if [ "$HEALTH" != "ok" ] && [ "$HEALTH" != "degraded" ]; then
  echo "ERROR: Traefik-UI health check failed: $HEALTH"
  echo "Container logs:"
  podman logs traefik-ui --tail 50
  exit 1
fi
echo "Health check: $HEALTH"

# Install Playwright browsers
echo ""
echo "Installing Playwright browsers..."
cd packages/frontend
bunx playwright install --with-deps chromium

# Run E2E tests against container
echo ""
echo "Running E2E tests against container..."
bun run e2e:container

cd ../..
echo ""
echo "=== E2E container tests complete ==="
