#!/usr/bin/env bash
# Container integration test for Traefik-UI.
#
# Builds the production image with the project's Containerfile, starts the
# full base stack (Traefik + Traefik-UI), waits for /api/health, exercises
# the auth flow, and tears everything down.
#
# Prerequisites: podman (preferred) or docker, curl, jq
# Usage: ./scripts/test-container-integration.sh

set -euo pipefail

echo "=== Traefik-UI Container Integration Tests ==="
echo ""

# ---- Preflight checks ----------------------------------------------------
if ! command -v curl &> /dev/null; then
  echo "ERROR: curl not found. Please install curl."
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "ERROR: jq not found. Please install jq (e.g. 'brew install jq')."
  exit 1
fi

# ---- Detect container runtime -------------------------------------------
if command -v podman &> /dev/null; then
  RUNTIME="podman"
elif command -v docker &> /dev/null; then
  RUNTIME="docker"
else
  echo "ERROR: Neither podman nor docker found. Please install one."
  exit 1
fi

echo "Using container runtime: $RUNTIME"
echo ""

# Use a test-specific compose overlay so the database starts fresh
# (ephemeral named volume). This guarantees first-run admin password
# generation every time the test runs.
COMPOSE_FILES="-f compose.yml -f compose.test.yml"

# ---- Ensure clean teardown on any exit ----------------------------------
cleanup() {
  local exit_code=$?
  echo ""
  echo "--- Cleaning up stack (down -v) ---"
  $RUNTIME compose $COMPOSE_FILES down -v --remove-orphans &> /dev/null || true
  if [ $exit_code -eq 0 ]; then
    echo "=== PASS: container integration tests ==="
  else
    echo "=== FAIL: container integration tests (exit $exit_code) ==="
  fi
  exit $exit_code
}
trap cleanup EXIT INT TERM

# ---- 1. Build the image -------------------------------------------------
echo "--- Building image (traefik-ui:test) ---"
$RUNTIME build -f Containerfile -t traefik-ui:test .

# ---- 2. Start the stack -------------------------------------------------
echo ""
echo "--- Starting stack ---"
$RUNTIME compose $COMPOSE_FILES up -d

# ---- 3. Wait for /api/health -------------------------------------------
echo ""
echo "--- Waiting for http://localhost:3000/api/health ---"
HEALTH_URL="http://localhost:3000/api/health"
HEALTHY=0
for i in $(seq 1 30); do
  RESPONSE=$(curl -sf -o /tmp/health.json -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || true)
  if [ "$RESPONSE" = "200" ]; then
    STATUS=$(jq -r '.status // "unknown"' /tmp/health.json 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "ok" ] || [ "$STATUS" = "degraded" ]; then
      echo "Health check passed after ${i} attempt(s): status=$STATUS"
      HEALTHY=1
      break
    fi
  fi
  echo "  attempt $i/30: not ready yet (http=$RESPONSE)"
  sleep 2
done

if [ "$HEALTHY" -ne 1 ]; then
  echo ""
  echo "ERROR: /api/health never returned ok/degraded within 60s"
  echo ""
  echo "--- traefik-proxy logs (tail 100) ---"
  $RUNTIME logs traefik-proxy --tail 100 || true
  echo ""
  echo "--- traefik-ui logs (tail 100) ---"
  $RUNTIME logs traefik-ui --tail 100 || true
  exit 1
fi

# ---- 4. Verify login flow ----------------------------------------------
echo ""
echo "--- Reading admin password from container logs ---"
PASSWORD=$($RUNTIME logs traefik-ui 2>&1 | grep "Password:" | head -1 | awk '{print $NF}')
if [ -z "$PASSWORD" ]; then
  echo "ERROR: could not extract admin password from traefik-ui logs"
  $RUNTIME logs traefik-ui --tail 50 || true
  exit 1
fi
echo "Got admin password (length: ${#PASSWORD})"

echo ""
echo "--- POST /api/auth/login ---"
LOGIN_HTTP=$(curl -s -o /tmp/login.json -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"$PASSWORD\"}" \
  "http://localhost:3000/api/auth/login")

if [ "$LOGIN_HTTP" != "200" ]; then
  echo "ERROR: login returned HTTP $LOGIN_HTTP"
  echo "Response body:"
  cat /tmp/login.json || true
  echo ""
  $RUNTIME logs traefik-ui --tail 50 || true
  exit 1
fi

TOKEN=$(jq -r '.token // empty' /tmp/login.json)
if [ -z "$TOKEN" ]; then
  echo "ERROR: login response did not contain a 'token' field"
  echo "Response body:"
  cat /tmp/login.json
  exit 1
fi
echo "Login OK, token length: ${#TOKEN}"

# ---- 5. Verify authenticated /api/dashboard ----------------------------
echo ""
echo "--- GET /api/dashboard (authenticated) ---"
DASH_HTTP=$(curl -s -o /tmp/dashboard.json -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/dashboard")

if [ "$DASH_HTTP" != "200" ]; then
  echo "ERROR: /api/dashboard returned HTTP $DASH_HTTP"
  echo "Response body:"
  cat /tmp/dashboard.json || true
  echo ""
  $RUNTIME logs traefik-ui --tail 50 || true
  exit 1
fi
echo "Dashboard OK (HTTP 200)"

# ---- Success — trap will print PASS summary ---------------------------
echo ""
echo "All checks passed:"
echo "  [PASS] image built"
echo "  [PASS] /api/health responded ok/degraded"
echo "  [PASS] login flow returned a token"
echo "  [PASS] authenticated /api/dashboard returned 200"
